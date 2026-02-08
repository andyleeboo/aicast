import type { GameState, GameClientState, GameType, TwentyQGameState } from "./game-types";
import {
  startGame as startHangman,
  processGuess as hangmanGuess,
  processWordGuess as hangmanWordGuess,
  toClientState as hangmanToClient,
} from "./hangman";
import {
  startGame as startTwentyQ,
  addQuestion as twentyqAddQuestion,
  resolveQuestion as twentyqResolveQuestion,
  toClientState as twentyqToClient,
} from "./twentyq";
import { emitAction } from "@/lib/action-bus";

const COOLDOWN_MS = 30_000;

interface GameManagerState {
  activeGame: GameState | null;
  lastEndedAt: number;
}

const GLOBAL_KEY = "__gameManagerState" as const;

function getState(): GameManagerState {
  const g = globalThis as unknown as Record<string, GameManagerState>;
  if (!g[GLOBAL_KEY]) {
    g[GLOBAL_KEY] = { activeGame: null, lastEndedAt: 0 };
  }
  return g[GLOBAL_KEY];
}

/** Shallow-copy a GameState, preserving the discriminated union. */
function snapshotGame(state: GameState): GameState {
  if (state.type === "hangman") return { ...state, data: { ...state.data } };
  return { ...state, data: { ...state.data, history: [...state.data.history] } };
}

function toClientStateDispatch(state: GameState): GameClientState {
  if (state.type === "hangman") return hangmanToClient(state);
  return twentyqToClient(state);
}

function emitGameState(clientState: GameClientState): void {
  emitAction({
    type: "game-state",
    id: `game:${clientState.gameId}`,
    gameState: clientState,
  });
}

export function getActiveGame(): GameState | null {
  return getState().activeGame;
}

export function getActiveGameClientState(): GameClientState | null {
  const game = getState().activeGame;
  return game ? toClientStateDispatch(game) : null;
}

export function startGame(type: GameType): GameClientState | { error: string } {
  const state = getState();

  if (state.activeGame && state.activeGame.status === "playing") {
    return { error: "A game is already in progress" };
  }

  if (Date.now() - state.lastEndedAt < COOLDOWN_MS) {
    const remaining = Math.ceil((COOLDOWN_MS - (Date.now() - state.lastEndedAt)) / 1000);
    return { error: `Cooldown: wait ${remaining}s before starting a new game` };
  }

  if (type === "hangman") {
    state.activeGame = startHangman();
  } else {
    state.activeGame = startTwentyQ();
  }

  const clientState = toClientStateDispatch(state.activeGame!);
  emitGameState(clientState);
  return clientState;
}

// ── Hangman-specific: synchronous guess ─────────────────────────────

export function guess(value: string): { correct: boolean; state: GameClientState; endedGame?: GameState } | { error: string } {
  const mgr = getState();
  if (!mgr.activeGame || mgr.activeGame.status !== "playing") {
    return { error: "No active game" };
  }
  if (mgr.activeGame.type !== "hangman") {
    return { error: "Use /ask or /answer for 20 Questions" };
  }

  const result = value.length === 1
    ? hangmanGuess(mgr.activeGame, value)
    : hangmanWordGuess(mgr.activeGame, value);

  mgr.activeGame = result.state;
  const clientState = toClientStateDispatch(result.state);
  emitGameState(clientState);

  if (result.state.status !== "playing") {
    const endedGame = snapshotGame(result.state);
    mgr.lastEndedAt = Date.now();
    mgr.activeGame = null;
    return { correct: result.correct, state: clientState, endedGame };
  }

  return { correct: result.correct, state: clientState };
}

// ── 20Q-specific: async question flow ───────────────────────────────

export function askQuestion(
  question: string,
  isGuess: boolean,
): { state: GameClientState; gameStateForReaction: TwentyQGameState } | { error: string } {
  const mgr = getState();
  if (!mgr.activeGame || mgr.activeGame.status !== "playing") {
    return { error: "No active game" };
  }
  if (mgr.activeGame.type !== "twentyq") {
    return { error: "Use /guess for Hangman" };
  }
  if (mgr.activeGame.data.pendingQuestion) {
    return { error: "Bob is still thinking... wait for his answer" };
  }
  if (mgr.activeGame.data.questionsAsked >= mgr.activeGame.data.maxQuestions) {
    return { error: "No questions left!" };
  }

  mgr.activeGame = twentyqAddQuestion(mgr.activeGame, question, isGuess);
  const clientState = toClientStateDispatch(mgr.activeGame);
  emitGameState(clientState);

  // Snapshot with secret intact for building the Gemini prompt
  const gameStateForReaction = snapshotGame(mgr.activeGame) as TwentyQGameState;

  return { state: clientState, gameStateForReaction };
}

export function resolveQuestionOnManager(
  answer: string,
  warmth: number,
  isCorrectGuess: boolean,
): GameState | null {
  const mgr = getState();
  if (!mgr.activeGame || mgr.activeGame.type !== "twentyq") {
    return null; // game was ended while question was pending — safe no-op
  }

  mgr.activeGame = twentyqResolveQuestion(mgr.activeGame, answer, warmth, isCorrectGuess);
  const clientState = toClientStateDispatch(mgr.activeGame);
  emitGameState(clientState);

  // Auto-end on win/loss
  if (mgr.activeGame.status !== "playing") {
    const snapshot = snapshotGame(mgr.activeGame);
    mgr.lastEndedAt = Date.now();
    mgr.activeGame = null;
    return snapshot;
  }

  return null;
}

// ── Shared ──────────────────────────────────────────────────────────

export function endGame(): GameState | null {
  const state = getState();
  if (!state.activeGame) return null;

  state.activeGame.status = "lost";
  const snapshot = snapshotGame(state.activeGame);

  // Build client state with reveal logic per game type
  const clientState = toClientStateDispatch(state.activeGame);
  if (clientState.type === "hangman" && state.activeGame.type === "hangman") {
    clientState.data.maskedWord = [...state.activeGame.data.word];
  }
  emitGameState(clientState);

  state.lastEndedAt = Date.now();
  state.activeGame = null;
  return snapshot;
}
