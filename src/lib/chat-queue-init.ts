/**
 * Side-effect module: import this to wire the chat queue flush handler
 * to Gemini + TTS + action-bus broadcast.
 */
import { chat } from "@/lib/gemini";
import { streamSpeech } from "@/lib/gemini-live";
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
import { setFlushHandler, getHistory, pushHistory } from "@/lib/chat-queue";
import { pauseIdle, resumeIdle } from "@/lib/idle-behavior";

// ── Tag parsing (extracted from route.ts) ────────────────────────────

const TAG_REGEX = /^\[([A-Z_]+)\]\s*/;
const LANG_REGEX = /\[LANG:([a-z]{2,5})\]\s*/i;
const STRAY_TAG_REGEX = /\[([A-Z][A-Z_]{1,20})\]\s*/g;

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

// All known tags — used to strip stray tags embedded mid-response
const knownTags = new Set([
  ...Object.keys(tagToGesture),
  ...Object.keys(tagToEmote),
  ...Object.keys(tagToSkill),
]);

export function parseTags(raw: string) {
  // Strip leading junk (thinking artifacts like "_\n", "}\n", whitespace)
  let remaining = raw.replace(/^[\s_{}*#]+/, "");
  let gesture: GestureReaction = "uncertain";
  let emote: EmoteCommand | null = null;
  let skillId: string | null = null;
  let language: string | undefined;

  // Extract [LANG:xx] tag (can appear anywhere)
  const langMatch = remaining.match(LANG_REGEX);
  if (langMatch) {
    language = langMatch[1].toLowerCase();
    remaining = remaining.replace(LANG_REGEX, "");
  }

  const firstMatch = remaining.match(TAG_REGEX);
  if (firstMatch) {
    const tag = firstMatch[1];
    if (tag in tagToSkill) {
      // Performance skill overrides gesture+emote
      skillId = tagToSkill[tag];
      remaining = remaining.replace(TAG_REGEX, "");
      return { response: remaining.trim(), gesture, emote, skillId, language };
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

  // Strip any stray action tags the model embedded mid-response
  // Remove ALL [UPPER_CASE] tags — known or unknown — they're not for the viewer
  remaining = remaining.replace(STRAY_TAG_REGEX, "");

  return { response: remaining.trim(), gesture, emote, skillId, language };
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

  // Step 1: Get structured text response from chat() (tags + text)
  let raw: string;
  try {
    raw = await chat(messages, systemPrompt);
  } catch (err) {
    console.error("[chat-queue-init] Gemini API error:", err);
    // Clear "thinking" on the client so it doesn't hang
    emitAction({ type: "ai-audio-end", id: responseId });
    return;
  }

  const { response, gesture, emote, skillId } = parseTags(raw);

  // Skip empty responses (Gemini sometimes returns only tags or whitespace)
  if (!response) {
    console.warn("[chat-queue-init] Empty response after parsing, skipping");
    emitAction({ type: "ai-audio-end", id: responseId });
    return;
  }

  // Save AI response to history
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

  // Pause idle — avatar is about to animate
  pauseIdle();

  // Broadcast text + gesture immediately
  emitAction({
    type: "ai-response",
    id: responseId,
    response,
    gesture,
    emote,
    skillId,
  });

  // Step 2: Stream audio via Live API (non-blocking — audio plays while text is shown)
  streamSpeech(response, (chunk) => {
    emitAction({ type: "ai-audio-chunk", id: responseId, audioData: chunk });
  })
    .then(() => {
      emitAction({ type: "ai-audio-end", id: responseId });
    })
    .catch((err) => {
      console.error("[chat-queue-init] Live API TTS error:", err);
      emitAction({ type: "ai-audio-end", id: responseId });
    })
    .finally(() => {
      resumeIdle();
    });

});
