/**
 * Triggers Bob to react to game events (start, win, loss).
 * Kept separate from game-manager to avoid circular imports
 * (chat-queue-init → game-manager → chat-queue-init).
 */
import type { GameState } from "./game-types";
import { buildGameSystemPrompt } from "./game-prompts";
import { chat } from "@/lib/gemini";
import { streamSpeech } from "@/lib/gemini-live";
import { getChannelFromDB } from "@/lib/mock-data";
import { buildActionSystemPrompt } from "@/lib/avatar-actions";
import { parseTags } from "@/lib/chat-queue-init";
import { emitAction } from "@/lib/action-bus";
import { getHistory, pushHistory } from "@/lib/chat-queue";
import { pauseIdle, resumeIdle } from "@/lib/idle-behavior";

const STREAMER_ID = "late-night-ai";

export async function triggerGameReaction(gameState: GameState): Promise<void> {
  const channel = await getChannelFromDB(STREAMER_ID);
  if (!channel) return;

  const history = getHistory();
  const gamePrompt = buildGameSystemPrompt(gameState);

  const nudge =
    gameState.status === "won"
      ? "\nThe game just ended — CHAT WON! Celebrate! 1-2 sentences max."
      : gameState.status === "lost"
        ? "\nThe game just ended — CHAT LOST! React dramatically. 1-2 sentences max."
        : "\nA new hangman game just started! Announce it to chat and hype them up. 1-2 sentences max.";

  const systemPrompt =
    channel.streamer.personality +
    buildActionSystemPrompt() +
    gamePrompt +
    nudge;

  const responseId = crypto.randomUUID();

  let raw: string;
  try {
    raw = await chat([...history], systemPrompt);
  } catch (err) {
    console.error("[game-reactions] Gemini API error:", err);
    return;
  }

  const { response, gesture, emote, skillId, language } = parseTags(raw);
  if (!response) return;

  pushHistory({
    id: crypto.randomUUID(),
    role: "assistant",
    content: response,
    timestamp: Date.now(),
  });

  pauseIdle();

  emitAction({
    type: "ai-response",
    id: responseId,
    response,
    gesture,
    emote,
    skillId,
    language,
  });

  streamSpeech(response, (chunk) => {
    emitAction({ type: "ai-audio-chunk", id: responseId, audioData: chunk });
  })
    .then(() => emitAction({ type: "ai-audio-end", id: responseId }))
    .catch((err) => {
      console.error("[game-reactions] TTS error:", err);
      emitAction({ type: "ai-audio-end", id: responseId });
    })
    .finally(() => resumeIdle());

  console.log(`[game-reactions] Bob reacted to game ${gameState.status}: ${response.substring(0, 80)}...`);
}
