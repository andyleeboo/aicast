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
  buildActionSystemPrompt,
  buildBatchSystemPrompt,
} from "@/lib/avatar-actions";
import { emitAction } from "@/lib/action-bus";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { setFlushHandler, getHistory, pushHistory } from "@/lib/chat-queue";

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

export function parseTags(raw: string) {
  let remaining = raw;
  let gesture: GestureReaction = "uncertain";
  let emote: EmoteCommand | null = null;

  const firstMatch = remaining.match(TAG_REGEX);
  if (firstMatch) {
    const tag = firstMatch[1];
    if (tag in tagToGesture) {
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

  return { response: remaining.trim(), gesture, emote };
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

  let raw: string;
  try {
    raw = await chat(messages, systemPrompt);
  } catch (err) {
    console.error("[chat-queue-init] Gemini API error:", err);
    return;
  }

  const { response, gesture, emote } = parseTags(raw);

  // Generate speech audio (graceful degradation)
  const audioData = await textToSpeech(response);

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

  // Insert AI response into Supabase
  const supabase = createServerSupabaseClient();
  if (supabase) {
    await supabase.from("messages").insert({
      channel_id: STREAMER_ID,
      role: "assistant",
      content: response,
    });
  }

  // Broadcast to ALL connected clients via SSE
  emitAction({
    type: "ai-response",
    id: crypto.randomUUID(),
    response,
    audioData,
    gesture,
    emote,
  });
});
