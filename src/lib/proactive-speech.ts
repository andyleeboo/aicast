/**
 * Side-effect module: Bob speaks unprompted when viewers are watching but chat is quiet.
 * Import this module to auto-start the proactive speech loop.
 */
import { getViewerCount, emitAction } from "@/lib/action-bus";
import { chat } from "@/lib/gemini";
import { streamSpeech } from "@/lib/gemini-live";
import { getChannelFromDB } from "@/lib/mock-data";
import {
  buildProactiveSystemPrompt,
  buildActionSystemPrompt,
} from "@/lib/avatar-actions";
import {
  acquireProcessingLock,
  releaseProcessingLock,
  getLastActivityTimestamp,
  touchActivity,
  getHistory,
  pushHistory,
} from "@/lib/chat-queue";
import { parseTags } from "@/lib/chat-queue-init";
import { pauseIdle, resumeIdle } from "@/lib/idle-behavior";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import type { ChatMessage } from "@/lib/types";

const MIN_SILENCE_MS = 45_000;
const MAX_SILENCE_MS = 90_000;
const CHECK_INTERVAL_MS = 5_000;
const STREAMER_ID = "late-night-ai";

interface ProactiveState {
  timer: ReturnType<typeof setInterval> | null;
  nextSpeakAt: number;
}

const GLOBAL_KEY = "__proactiveSpeechState" as const;

function getState(): ProactiveState {
  const g = globalThis as unknown as Record<string, ProactiveState>;
  if (!g[GLOBAL_KEY]) {
    g[GLOBAL_KEY] = {
      timer: null,
      nextSpeakAt: Date.now() + randomDelay(),
    };
  }
  return g[GLOBAL_KEY];
}

function randomDelay(): number {
  return MIN_SILENCE_MS + Math.random() * (MAX_SILENCE_MS - MIN_SILENCE_MS);
}

async function maybeSpeakProactively() {
  const now = Date.now();
  const state = getState();

  // Not time yet
  if (now < state.nextSpeakAt) return;

  // No viewers — don't waste tokens
  const viewerCount = getViewerCount();
  if (viewerCount === 0) {
    state.nextSpeakAt = now + randomDelay();
    return;
  }

  // Chat was active recently — wait relative to last activity
  const silenceMs = now - getLastActivityTimestamp();
  if (silenceMs < MIN_SILENCE_MS) {
    state.nextSpeakAt = getLastActivityTimestamp() + randomDelay();
    return;
  }

  // Chat queue is flushing — skip this tick
  if (!acquireProcessingLock()) return;

  // Reset timer immediately so we don't re-enter
  state.nextSpeakAt = now + randomDelay();

  try {
    const channel = await getChannelFromDB(STREAMER_ID);
    if (!channel) {
      console.error("[proactive-speech] Channel not found:", STREAMER_ID);
      return;
    }

    const history = getHistory();
    const messages: ChatMessage[] = [...history];

    const systemPrompt =
      channel.streamer.personality +
      buildProactiveSystemPrompt({
        viewerCount,
        secondsSinceLastMessage: silenceMs / 1000,
      }) +
      buildActionSystemPrompt();

    let raw: string;
    try {
      raw = await chat(messages, systemPrompt);
    } catch (err) {
      console.error("[proactive-speech] Gemini API error:", err);
      return;
    }

    const { response, gesture, emote, skillId } = parseTags(raw);

    // Skip empty responses
    if (!response) {
      console.warn("[proactive-speech] Empty response after parsing, skipping");
      return;
    }

    // Save to rolling history
    pushHistory({
      id: crypto.randomUUID(),
      role: "assistant",
      content: response,
      timestamp: Date.now(),
    });

    // Update activity so we don't immediately trigger again
    touchActivity();

    const responseId = crypto.randomUUID();

    // Pause idle animations while Bob is speaking
    pauseIdle();

    // Broadcast text + gesture
    emitAction({
      type: "ai-response",
      id: responseId,
      response,
      gesture,
      emote,
      skillId,
    });

    // Stream audio via Live API
    streamSpeech(response, (chunk) => {
      emitAction({ type: "ai-audio-chunk", id: responseId, audioData: chunk });
    })
      .then(() => {
        emitAction({ type: "ai-audio-end", id: responseId });
      })
      .catch((err) => {
        console.error("[proactive-speech] Live API TTS error:", err);
        emitAction({ type: "ai-audio-end", id: responseId });
      })
      .finally(() => {
        resumeIdle();
      });

    // Persist to Supabase (fire-and-forget)
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
          if (error)
            console.error("[proactive-speech] Supabase insert error:", error);
        });
    }

    console.log(
      `[proactive-speech] Bob spoke (${viewerCount} viewers, ${Math.round(silenceMs / 1000)}s silence): ${response.substring(0, 80)}...`,
    );
  } finally {
    releaseProcessingLock();
  }
}

// Auto-start on import
const state = getState();
if (!state.timer) {
  state.timer = setInterval(maybeSpeakProactively, CHECK_INTERVAL_MS);
  console.log("[proactive-speech] Started (checking every 5s)");
}
