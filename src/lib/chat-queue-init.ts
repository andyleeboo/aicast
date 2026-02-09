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
import { isShutdownSync } from "@/lib/service-config";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getActiveGame } from "@/lib/games/game-manager";
import { buildGameSystemPrompt } from "@/lib/games/game-prompts";

// ── Tag parsing (extracted from route.ts) ────────────────────────────

const TAG_REGEX = /^\[([A-Z_]+)\]\s*/;
const LANG_REGEX = /\[LANG:([a-z]{2,5})\]\s*/i;
const STRAY_TAG_REGEX = /\[([A-Z][A-Z_]{1,20})\]\s*/g;

const tagToGesture: Record<string, GestureReaction> = {
  NOD: "yes",
  SHAKE: "no",
  TILT: "uncertain",
};

const tagToEmote: Record<string, EmoteCommand> = Object.fromEntries(
  AVATAR_ACTIONS
    .filter((a) => a.type === "emote")
    .map((a) => [a.tag, a.id.split(":")[1] as EmoteCommand]),
);

const tagToSkill: Record<string, string> = Object.fromEntries(
  PERFORMANCE_SKILLS.map((s) => [s.tag, s.id]),
);

interface ParsedTags {
  response: string;
  gesture: GestureReaction;
  emote: EmoteCommand | null;
  skillId: string | null;
  language: string | undefined;
}

export function parseTags(raw: string): ParsedTags {
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

const TIER_LABELS: Record<string, string> = {
  red: " RED MEGA",
  gold: " GOLD",
};

export function formatBatchForAI(batch: BatchedChatMessage[]): string {
  const sorted = [...batch].sort(
    (a, b) =>
      (PRIORITY_ORDER[a.priority] ?? 2) - (PRIORITY_ORDER[b.priority] ?? 2),
  );

  const lines = sorted.map((msg) => {
    let prefix = "";
    if (msg.priority === "donation" && msg.donationAmount) {
      const tierLabel = TIER_LABELS[msg.donationTier ?? ""] ?? "";
      prefix = `[SUPERCHAT $${msg.donationAmount}${tierLabel}] `;
    } else if (msg.priority === "highlight") {
      prefix = "[HIGHLIGHTED] ";
    }
    return `${prefix}${msg.username}: ${msg.content}`;
  });

  return `[CHAT BATCH - ${batch.length} message(s)]\n${lines.join("\n")}`;
}

// ── Core batch processing (used by both flush handler and Supabase poller) ──

export async function processChatBatch(batch: BatchedChatMessage[], channelId: string = "late-night-ai"): Promise<void> {
  if (isShutdownSync()) {
    console.log("[chat-queue-init] Shutdown mode — skipping AI response");
    return;
  }

  const responseId = crypto.randomUUID();

  const channel = await getChannelFromDB(channelId);
  if (!channel) {
    console.error("[chat-queue-init] Channel not found:", channelId);
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

  const activeGame = getActiveGame(channelId);
  const gamePrompt = activeGame ? buildGameSystemPrompt(activeGame) : "";

  const systemPrompt =
    channel.streamer.personality +
    buildBatchSystemPrompt() +
    buildActionSystemPrompt() +
    gamePrompt;

  // Step 1: Get structured text response from chat() (tags + text)
  let raw: string;
  try {
    raw = await chat(messages, systemPrompt);
  } catch (err) {
    console.error("[chat-queue-init] Gemini API error:", err);
    // Clear "thinking" on the client so it doesn't hang
    emitAction({ type: "ai-audio-end", id: responseId, channelId });
    return;
  }

  const { response, gesture, emote, skillId, language } = parseTags(raw);

  // Skip empty responses (Gemini sometimes returns only tags or whitespace)
  if (!response) {
    console.warn("[chat-queue-init] Empty response after parsing, skipping");
    emitAction({ type: "ai-audio-end", id: responseId, channelId });
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

  // Persist to Supabase (fire-and-forget — don't block SSE/TTS)
  const supabase = createServerSupabaseClient();
  if (supabase) {
    Promise.resolve(
      supabase
        .from("messages")
        .insert({
          channel_id: channelId,
          role: "assistant",
          content: response,
          username: channel.streamer.name,
        }),
    ).then(({ error }) => {
      if (error) console.error("[chat-queue-init] Supabase insert error:", error.message);
    }).catch((err) => {
      console.error("[chat-queue-init] Supabase insert threw:", err);
    });
  }

  // Pause idle — avatar is about to animate
  pauseIdle();

  // Broadcast text + gesture immediately
  emitAction({
    type: "ai-response",
    id: responseId,
    channelId,
    response,
    gesture,
    emote,
    skillId,
    language,
  });

  console.log(`[chat-queue-init] ${channel.streamer.name} responded to ${batch.length} message(s): ${response.substring(0, 80)}...`);

  // Step 2: Stream audio via Live API (non-blocking — audio plays while text is shown)
  streamSpeech(response, (chunk) => {
    emitAction({ type: "ai-audio-chunk", id: responseId, channelId, audioData: chunk });
  }, channel.streamer.ttsVoice)
    .then(() => {
      emitAction({ type: "ai-audio-end", id: responseId, channelId });
    })
    .catch((err) => {
      console.error("[chat-queue-init] Live API TTS error:", err);
      emitAction({ type: "ai-audio-end", id: responseId, channelId });
    })
    .finally(() => {
      resumeIdle();
    });
}

// Register as flush handler for backward compat (only works when caller
// shares the same globalThis, e.g. within the SSE endpoint).
// Uses dynamic import to avoid circular dependency with proactive-speech.
setFlushHandler(async (batch) => {
  const { getActiveChannelId } = await import("@/lib/proactive-speech");
  return processChatBatch(batch, getActiveChannelId());
});
