/**
 * Side-effect module: import this to wire the chat queue flush handler
 * to Gemini + TTS + action-bus broadcast.
 */
import { chat, textToSpeech } from "@/lib/gemini";
import { getChannelFromDB } from "@/lib/mock-data";
import type {
  ChatMessage,
  GestureReaction,
  EmoteCommand,
  BatchedChatMessage,
} from "@/lib/types";
import {
  AVATAR_ACTIONS,
  PERFORMANCE_SKILLS,
  buildActionSystemPrompt,
  buildBatchSystemPrompt,
} from "@/lib/avatar-actions";
import { emitAction } from "@/lib/action-bus";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { setFlushHandler, getHistory, pushHistory } from "@/lib/chat-queue";
import { pauseIdle, resumeIdle } from "@/lib/idle-behavior";

// ── Tag parsing (extracted from route.ts) ────────────────────────────

const TAG_REGEX = /^\[([A-Z_]+)\]\s*/;

const tagToGesture: Record<string, GestureReaction> = {
  NOD: "yes",
  SHAKE: "no",
  TILT: "uncertain",
};

const tagToEmote: Record<string, EmoteCommand> = {};
for (const action of AVATAR_ACTIONS) {
  if (action.type === "emote") {
    tagToEmote[action.tag] = action.id.split(":")[1] as EmoteCommand;
  }
}

const tagToSkill: Record<string, string> = {};
for (const skill of PERFORMANCE_SKILLS) {
  tagToSkill[skill.tag] = skill.id;
}

export function parseTags(raw: string) {
  let remaining = raw;
  let gesture: GestureReaction = "uncertain";
  let emote: EmoteCommand | null = null;
  let skillId: string | null = null;

  const firstMatch = remaining.match(TAG_REGEX);
  if (firstMatch) {
    const tag = firstMatch[1];
    if (tag in tagToSkill) {
      // Performance skill overrides gesture+emote
      skillId = tagToSkill[tag];
      remaining = remaining.replace(TAG_REGEX, "");
      return { response: remaining.trim(), gesture, emote, skillId };
    } else if (tag in tagToGesture) {
      gesture = tagToGesture[tag];
      remaining = remaining.replace(TAG_REGEX, "");
    } else if (tag in tagToEmote) {
      emote = tagToEmote[tag];
      remaining = remaining.replace(TAG_REGEX, "");
    }
  }

  const secondMatch = remaining.match(TAG_REGEX);
  if (secondMatch) {
    const tag = secondMatch[1];
    if (!emote && tag in tagToEmote) {
      emote = tagToEmote[tag];
      remaining = remaining.replace(TAG_REGEX, "");
    } else if (gesture === "uncertain" && tag in tagToGesture) {
      gesture = tagToGesture[tag];
      remaining = remaining.replace(TAG_REGEX, "");
    }
  }

  return { response: remaining.trim(), gesture, emote, skillId };
}

// ── Batch formatting (extracted from route.ts) ───────────────────────

const PRIORITY_ORDER: Record<string, number> = {
  donation: 0,
  highlight: 1,
  normal: 2,
};

export function formatBatchForAI(batch: BatchedChatMessage[]): string {
  const sorted = [...batch].sort(
    (a, b) =>
      (PRIORITY_ORDER[a.priority] ?? 2) - (PRIORITY_ORDER[b.priority] ?? 2),
  );

  const lines = sorted.map((msg) => {
    let prefix = "";
    if (msg.priority === "donation" && msg.donationAmount) {
      prefix = `[DONATION $${msg.donationAmount}] `;
    } else if (msg.priority === "highlight") {
      prefix = "[HIGHLIGHTED] ";
    }
    return `${prefix}${msg.username}: ${msg.content}`;
  });

  return `[CHAT BATCH - ${batch.length} message(s)]\n${lines.join("\n")}`;
}

// ── Flush handler ────────────────────────────────────────────────────

const STREAMER_ID = "late-night-ai";

setFlushHandler(async (batch: BatchedChatMessage[]) => {
  const responseId = crypto.randomUUID();

  // Broadcast "thinking" immediately so clients can show a typing indicator
  emitAction({ type: "ai-thinking", id: responseId });

  const channel = await getChannelFromDB(STREAMER_ID);
  if (!channel) {
    console.error("[chat-queue-init] Channel not found:", STREAMER_ID);
    return;
  }

  const batchText = formatBatchForAI(batch);
  const history = getHistory();

  const messages: ChatMessage[] = [
    ...history,
    {
      id: crypto.randomUUID(),
      role: "user",
      content: batchText,
      timestamp: Date.now(),
    },
  ];

  const systemPrompt =
    channel.streamer.personality +
    buildBatchSystemPrompt() +
    buildActionSystemPrompt();

  // Pause idle only while we're about to animate (not during the API call)
  let raw: string;
  try {
    raw = await chat(messages, systemPrompt);
  } catch (err) {
    console.error("[chat-queue-init] Gemini API error:", err);
    return;
  }

  const { response, gesture, emote, skillId } = parseTags(raw);

  // Save AI response to history for future context
  pushHistory({
    id: crypto.randomUUID(),
    role: "user",
    content: batchText,
    timestamp: Date.now(),
  });
  pushHistory({
    id: crypto.randomUUID(),
    role: "assistant",
    content: response,
    timestamp: Date.now(),
  });

  // Pause idle now — avatar is about to play a gesture/emote
  pauseIdle();

  // Broadcast text + gesture immediately — don't wait for TTS
  emitAction({
    type: "ai-response",
    id: responseId,
    response,
    gesture,
    emote,
    skillId,
  });

  // Fire TTS in background — send audio as a follow-up event when ready
  textToSpeech(response)
    .then((audioData) => {
      if (audioData) {
        emitAction({ type: "ai-audio", id: responseId, audioData });
      }
    })
    .catch((err) => {
      console.error("[chat-queue-init] TTS error:", err);
    })
    .finally(() => {
      resumeIdle();
    });

  // Persist to Supabase in background (fire-and-forget)
  const supabase = createServerSupabaseClient();
  if (supabase) {
    supabase
      .from("messages")
      .insert({
        channel_id: STREAMER_ID,
        role: "assistant",
        content: response,
      })
      .then(({ error }) => {
        if (error) console.error("[chat-queue-init] Supabase insert error:", error);
      });
  }
});
