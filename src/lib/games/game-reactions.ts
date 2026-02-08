/**
 * Triggers Bob to react to game events (start, win, loss).
 * Kept separate from game-manager to avoid circular imports
 * (chat-queue-init → game-manager → chat-queue-init).
 */
import type { GameState, TwentyQGameState } from "./game-types";
import { buildGameSystemPrompt, buildTwentyQQuestionPrompt } from "./game-prompts";
import { resolveQuestionOnManager } from "./game-manager";
import { chat } from "@/lib/gemini";
import { streamSpeech } from "@/lib/gemini-live";
import { getChannelFromDB } from "@/lib/mock-data";
import { buildActionSystemPrompt } from "@/lib/avatar-actions";
import { parseTags } from "@/lib/chat-queue-init";
import { emitAction } from "@/lib/action-bus";
import { getHistory, pushHistory, acquireProcessingLock, releaseProcessingLock } from "@/lib/chat-queue";
import { pauseIdle, resumeIdle } from "@/lib/idle-behavior";

const STREAMER_ID = "late-night-ai";

const LOCK_RETRY_MS = 2000;

export async function triggerGameReaction(gameState: GameState): Promise<void> {
  if (!acquireProcessingLock()) {
    await new Promise((r) => setTimeout(r, LOCK_RETRY_MS));
    if (!acquireProcessingLock()) {
      console.log("[game-reactions] Lock still held — skipping reaction, Bob will comment naturally");
      return;
    }
  }

  try {
    const channel = await getChannelFromDB(STREAMER_ID);
    if (!channel) return;

    const history = getHistory();
    const gamePrompt = buildGameSystemPrompt(gameState);

    let nudge: string;
    if (gameState.status === "won") {
      nudge = "\nThe game just ended — CHAT WON! Celebrate! 1-2 sentences max.";
    } else if (gameState.status === "lost") {
      nudge = "\nThe game just ended — CHAT LOST! React dramatically. 1-2 sentences max.";
    } else if (gameState.type === "twentyq") {
      nudge = "\nA new 20 Questions game just started! Announce the category and hype chat up. Tell them to type /ask <question>. 1-2 sentences max.";
    } else {
      nudge = "\nA new hangman game just started! Announce it to chat and hype them up. 1-2 sentences max.";
    }

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
  } finally {
    releaseProcessingLock();
  }
}

// ── 20Q per-question reaction ───────────────────────────────────────

/**
 * Called async after /ask or /answer. Sends the question to Gemini,
 * parses the structured response, resolves the question on the manager,
 * and speaks Bob's reaction.
 */
export async function triggerTwentyQQuestionReaction(
  gameState: TwentyQGameState,
  question: string,
  isGuess: boolean,
): Promise<void> {
  if (!acquireProcessingLock()) {
    await new Promise((r) => setTimeout(r, LOCK_RETRY_MS));
    if (!acquireProcessingLock()) {
      // Can't get lock — resolve with fallback so game isn't stuck
      console.log("[game-reactions:20q] Lock held — fallback resolve");
      resolveQuestionOnManager("KINDA", 3, false);
      return;
    }
  }

  try {
    const questionPrompt = buildTwentyQQuestionPrompt(gameState, question, isGuess);

    let raw: string;
    try {
      raw = await chat([], questionPrompt);
    } catch (err) {
      console.error("[game-reactions:20q] Gemini API error:", err);
      // Fallback resolve so game isn't stuck with pendingQuestion: true
      resolveQuestionOnManager("KINDA", 3, false);
      return;
    }

    // Parse structured response
    const { answer, warmth, response, isCorrectGuess } = parseTwentyQResponse(raw, isGuess);

    // Update game state via manager
    const endedGame = resolveQuestionOnManager(answer, warmth, isCorrectGuess);

    // Speak Bob's reaction
    if (response) {
      const responseId = crypto.randomUUID();

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
      });

      streamSpeech(response, (chunk) => {
        emitAction({ type: "ai-audio-chunk", id: responseId, audioData: chunk });
      })
        .then(() => emitAction({ type: "ai-audio-end", id: responseId }))
        .catch((err) => {
          console.error("[game-reactions:20q] TTS error:", err);
          emitAction({ type: "ai-audio-end", id: responseId });
        })
        .finally(() => resumeIdle());

      console.log(`[game-reactions:20q] Bob answered: ${answer} (warmth: ${warmth}) — ${response.substring(0, 60)}...`);

      // If game ended, fire a delayed end-game reaction so the answer TTS plays first
      if (endedGame) {
        setTimeout(() => {
          triggerGameReaction(endedGame).catch(console.error);
        }, 3000);
      }
    }
  } finally {
    releaseProcessingLock();
  }
}

/** Parse Gemini's structured 3-line response for 20Q questions/guesses. */
function parseTwentyQResponse(
  raw: string,
  isGuess: boolean,
): { answer: string; warmth: number; response: string; isCorrectGuess: boolean } {
  const lines = raw.trim().split("\n").map((l) => l.trim());

  let answer = "KINDA";
  let warmth = 3;
  let response = "";
  let isCorrectGuess = false;

  for (const line of lines) {
    if (isGuess && line.toUpperCase().startsWith("CORRECT:")) {
      const val = line.slice(8).trim().toLowerCase();
      isCorrectGuess = val === "yes";
      answer = isCorrectGuess ? "YES" : "NO";
    } else if (!isGuess && line.toUpperCase().startsWith("ANSWER:")) {
      const val = line.slice(7).trim().toUpperCase();
      if (val === "YES" || val === "NO" || val === "KINDA") answer = val;
    } else if (line.toUpperCase().startsWith("WARMTH:")) {
      const num = parseInt(line.slice(7).trim(), 10);
      if (num >= 1 && num <= 5) warmth = num;
    } else if (line.toUpperCase().startsWith("RESPONSE:")) {
      response = line.slice(9).trim();
    }
  }

  // Fallback: if no response parsed, use the whole raw text
  if (!response) {
    response = raw.trim().substring(0, 200);
  }

  return { answer, warmth, response, isCorrectGuess };
}
