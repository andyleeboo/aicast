/**
 * Triggers Bob to react to game events (start, win, loss).
 * Kept separate from game-manager to avoid circular imports
 * (chat-queue-init → game-manager → chat-queue-init).
 */
import type {
  GameState,
  TwentyQGameState,
  TriviaGameState,
  WyrGameState,
  HotColdGameState,
} from "./game-types";
import {
  buildGameSystemPrompt,
  buildTwentyQQuestionPrompt,
  buildTriviaJudgePrompt,
  buildWyrReactionPrompt,
  buildHotColdJudgePrompt,
} from "./game-prompts";
import {
  resolveQuestionOnManager,
  resolveTriviaOnManager,
  resolveWyrOnManager,
  resolveHotColdOnManager,
} from "./game-manager";
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
    } else if (gameState.type === "trivia") {
      nudge = "\nA new Trivia Quiz just started! Read the first question to chat with excitement. Tell them to type /answer <answer>. 1-2 sentences max.";
    } else if (gameState.type === "wyr") {
      nudge = "\nA new Would You Rather game just started! Present the first dilemma with enthusiasm. Tell them to type /vote a or /vote b. 1-2 sentences max.";
    } else if (gameState.type === "hotcold") {
      nudge = "\nA new Hot or Cold game just started! Announce the category and tease chat. Tell them to type /guess <word>. 1-2 sentences max.";
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

// ── Shared helper: speak a response and handle TTS ──────────────────

function speakResponse(response: string, endedGame: GameState | null): void {
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
      console.error("[game-reactions] TTS error:", err);
      emitAction({ type: "ai-audio-end", id: responseId });
    })
    .finally(() => resumeIdle());

  // If game ended, fire a delayed end-game reaction so the answer TTS plays first
  if (endedGame) {
    setTimeout(() => {
      triggerGameReaction(endedGame).catch(console.error);
    }, 3000);
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
      speakResponse(response, endedGame);
      console.log(`[game-reactions:20q] Bob answered: ${answer} (warmth: ${warmth}) — ${response.substring(0, 60)}...`);
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

// ── Trivia per-answer reaction ──────────────────────────────────────

export async function triggerTriviaReaction(
  gameState: TriviaGameState,
  viewerAnswer: string,
): Promise<void> {
  if (!acquireProcessingLock()) {
    await new Promise((r) => setTimeout(r, LOCK_RETRY_MS));
    if (!acquireProcessingLock()) {
      console.log("[game-reactions:trivia] Lock held — fallback resolve");
      resolveTriviaOnManager(false);
      return;
    }
  }

  try {
    const prompt = buildTriviaJudgePrompt(gameState, viewerAnswer);

    let raw: string;
    try {
      raw = await chat([], prompt);
    } catch (err) {
      console.error("[game-reactions:trivia] Gemini API error:", err);
      resolveTriviaOnManager(false);
      return;
    }

    const { correct, response } = parseTriviaResponse(raw);
    const endedGame = resolveTriviaOnManager(correct);

    if (response) {
      speakResponse(response, endedGame);
      console.log(`[game-reactions:trivia] Bob judged: ${correct ? "correct" : "wrong"} — ${response.substring(0, 60)}...`);
    }
  } finally {
    releaseProcessingLock();
  }
}

function parseTriviaResponse(raw: string): { correct: boolean; response: string } {
  const lines = raw.trim().split("\n").map((l) => l.trim());

  let correct = false;
  let response = "";

  for (const line of lines) {
    if (line.toUpperCase().startsWith("CORRECT:")) {
      correct = line.slice(8).trim().toLowerCase() === "yes";
    } else if (line.toUpperCase().startsWith("RESPONSE:")) {
      response = line.slice(9).trim();
    }
  }

  if (!response) {
    response = raw.trim().substring(0, 200);
  }

  return { correct, response };
}

// ── WYR per-round reaction ──────────────────────────────────────────

export async function triggerWyrReaction(
  gameState: WyrGameState,
): Promise<void> {
  if (!acquireProcessingLock()) {
    await new Promise((r) => setTimeout(r, LOCK_RETRY_MS));
    if (!acquireProcessingLock()) {
      console.log("[game-reactions:wyr] Lock held — fallback resolve");
      resolveWyrOnManager("A", "I just couldn't decide!");
      return;
    }
  }

  try {
    const prompt = buildWyrReactionPrompt(gameState);

    let raw: string;
    try {
      raw = await chat([], prompt);
    } catch (err) {
      console.error("[game-reactions:wyr] Gemini API error:", err);
      resolveWyrOnManager("A", "Tough choice!");
      return;
    }

    const { pick, reason, response } = parseWyrResponse(raw);
    const endedGame = resolveWyrOnManager(pick, reason);

    if (response) {
      speakResponse(response, endedGame);
      console.log(`[game-reactions:wyr] Bob picked ${pick}: ${response.substring(0, 60)}...`);
    }
  } finally {
    releaseProcessingLock();
  }
}

function parseWyrResponse(raw: string): { pick: "A" | "B"; reason: string; response: string } {
  const lines = raw.trim().split("\n").map((l) => l.trim());

  let pick: "A" | "B" = "A";
  let reason = "";
  let response = "";

  for (const line of lines) {
    if (line.toUpperCase().startsWith("PICK:")) {
      const val = line.slice(5).trim().toUpperCase();
      if (val === "A" || val === "B") pick = val;
    } else if (line.toUpperCase().startsWith("REASON:")) {
      reason = line.slice(7).trim();
    } else if (line.toUpperCase().startsWith("RESPONSE:")) {
      response = line.slice(9).trim();
    }
  }

  if (!response && reason) response = reason;
  if (!response) response = raw.trim().substring(0, 200);
  if (!reason) reason = response;

  return { pick, reason, response };
}

// ── Hot or Cold per-guess reaction ──────────────────────────────────

export async function triggerHotColdReaction(
  gameState: HotColdGameState,
  guess: string,
): Promise<void> {
  if (!acquireProcessingLock()) {
    await new Promise((r) => setTimeout(r, LOCK_RETRY_MS));
    if (!acquireProcessingLock()) {
      console.log("[game-reactions:hotcold] Lock held — fallback resolve");
      resolveHotColdOnManager(3, false);
      return;
    }
  }

  try {
    const prompt = buildHotColdJudgePrompt(gameState, guess);

    let raw: string;
    try {
      raw = await chat([], prompt);
    } catch (err) {
      console.error("[game-reactions:hotcold] Gemini API error:", err);
      resolveHotColdOnManager(3, false);
      return;
    }

    const { warmth, isCorrect, response } = parseHotColdResponse(raw);
    const endedGame = resolveHotColdOnManager(warmth, isCorrect);

    if (response) {
      speakResponse(response, endedGame);
      console.log(`[game-reactions:hotcold] Bob judged: warmth=${warmth}, correct=${isCorrect} — ${response.substring(0, 60)}...`);
    }
  } finally {
    releaseProcessingLock();
  }
}

function parseHotColdResponse(raw: string): { warmth: number; isCorrect: boolean; response: string } {
  const lines = raw.trim().split("\n").map((l) => l.trim());

  let warmth = 3;
  let isCorrect = false;
  let response = "";

  for (const line of lines) {
    if (line.toUpperCase().startsWith("CORRECT:")) {
      isCorrect = line.slice(8).trim().toLowerCase() === "yes";
    } else if (line.toUpperCase().startsWith("WARMTH:")) {
      const num = parseInt(line.slice(7).trim(), 10);
      if (num >= 1 && num <= 5) warmth = num;
    } else if (line.toUpperCase().startsWith("RESPONSE:")) {
      response = line.slice(9).trim();
    }
  }

  if (isCorrect) warmth = 5;
  if (!response) response = raw.trim().substring(0, 200);

  return { warmth, isCorrect, response };
}
