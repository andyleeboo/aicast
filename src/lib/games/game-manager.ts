import type { GameState, GameClientState } from "./game-types";
import {
  startGame as startHangman,
  processGuess as hangmanGuess,
  processWordGuess as hangmanWordGuess,
  toClientState,
} from "./hangman";
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
  return game ? toClientState(game) : null;
}

export function startGame(type: "hangman"): GameClientState | { error: string } {
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
  }

  const clientState = toClientState(state.activeGame!);
  emitGameState(clientState);
  return clientState;
}

export function guess(value: string): { correct: boolean; state: GameClientState; endedGame?: GameState } | { error: string } {
  const mgr = getState();
  if (!mgr.activeGame || mgr.activeGame.status !== "playing") {
    return { error: "No active game" };
  }

  let result: { state: GameState; correct: boolean };

  if (value.length === 1) {
    result = hangmanGuess(mgr.activeGame, value);
  } else {
    result = hangmanWordGuess(mgr.activeGame, value);
  }

  mgr.activeGame = result.state;
  const clientState = toClientState(result.state);
  emitGameState(clientState);

  // Auto-end on win/loss: snapshot the game, then clear so other
  // pathways (chat-queue-init, proactive-speech) don't re-inject the prompt
  if (result.state.status !== "playing") {
    const endedGame = { ...result.state, data: { ...result.state.data } };
    mgr.lastEndedAt = Date.now();
    mgr.activeGame = null;
    return { correct: result.correct, state: clientState, endedGame };
  }

  return { correct: result.correct, state: clientState };
}

export function endGame(): GameState | null {
  const state = getState();
  if (state.activeGame) {
    state.activeGame.status = "lost"; // force end
    const snapshot = { ...state.activeGame, data: { ...state.activeGame.data } };
    const clientState = toClientState(state.activeGame);
    // Reveal the word on forced end
    clientState.data.maskedWord = [...state.activeGame.data.word];
    emitGameState(clientState);
    state.lastEndedAt = Date.now();
    state.activeGame = null;
    return snapshot;
  }
  return null;
}
