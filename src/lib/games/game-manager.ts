import type {
  GameState,
  GameClientState,
  GameType,
  TwentyQGameState,
  TriviaGameState,
  WyrGameState,
  HotColdGameState,
} from "./game-types";
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
import {
  startGame as startTrivia,
  submitAnswer as triviaSubmitAnswer,
  resolveAnswer as triviaResolveAnswer,
  toClientState as triviaToClient,
} from "./trivia";
import {
  startGame as startWyr,
  castVote as wyrCastVote,
  closeVoting as wyrCloseVoting,
  resolveRound as wyrResolveRound,
  toClientState as wyrToClient,
} from "./wyr";
import {
  startGame as startHotCold,
  submitGuess as hotcoldSubmitGuess,
  resolveGuess as hotcoldResolveGuess,
  toClientState as hotcoldToClient,
} from "./hotcold";
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
  if (state.type === "twentyq") return { ...state, data: { ...state.data, history: [...state.data.history] } };
  if (state.type === "trivia") return { ...state, data: { ...state.data, roundResults: [...state.data.roundResults] } };
  if (state.type === "wyr") return { ...state, data: { ...state.data, roundResults: [...state.data.roundResults] } };
  // hotcold
  return { ...state, data: { ...state.data, history: [...state.data.history] } };
}

function toClientStateDispatch(state: GameState): GameClientState {
  if (state.type === "hangman") return hangmanToClient(state);
  if (state.type === "twentyq") return twentyqToClient(state);
  if (state.type === "trivia") return triviaToClient(state);
  if (state.type === "wyr") return wyrToClient(state);
  return hotcoldToClient(state);
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

  if (type === "hangman") state.activeGame = startHangman();
  else if (type === "twentyq") state.activeGame = startTwentyQ();
  else if (type === "trivia") state.activeGame = startTrivia();
  else if (type === "wyr") state.activeGame = startWyr();
  else state.activeGame = startHotCold();

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

// ── Trivia-specific: async answer flow ──────────────────────────────

export function submitTriviaAnswer(
  answer: string,
): { state: GameClientState; gameStateForReaction: TriviaGameState } | { error: string } {
  const mgr = getState();
  if (!mgr.activeGame || mgr.activeGame.status !== "playing") {
    return { error: "No active game" };
  }
  if (mgr.activeGame.type !== "trivia") {
    return { error: "Not a trivia game" };
  }
  if (mgr.activeGame.data.pendingAnswer) {
    return { error: "Bob is still judging... hold on" };
  }
  if (mgr.activeGame.data.currentRound >= mgr.activeGame.data.maxRounds) {
    return { error: "No rounds left!" };
  }

  mgr.activeGame = triviaSubmitAnswer(mgr.activeGame, answer);
  const clientState = toClientStateDispatch(mgr.activeGame);
  emitGameState(clientState);

  const gameStateForReaction = snapshotGame(mgr.activeGame) as TriviaGameState;
  return { state: clientState, gameStateForReaction };
}

export function resolveTriviaOnManager(correct: boolean): GameState | null {
  const mgr = getState();
  if (!mgr.activeGame || mgr.activeGame.type !== "trivia") {
    return null;
  }

  mgr.activeGame = triviaResolveAnswer(mgr.activeGame, correct);
  const clientState = toClientStateDispatch(mgr.activeGame);
  emitGameState(clientState);

  if (mgr.activeGame.status !== "playing") {
    const snapshot = snapshotGame(mgr.activeGame);
    mgr.lastEndedAt = Date.now();
    mgr.activeGame = null;
    return snapshot;
  }

  return null;
}

// ── WYR-specific: voting + round flow ───────────────────────────────

export function voteWyr(
  choice: "a" | "b",
  voter: string,
): { state: GameClientState; alreadyVoted: boolean } | { error: string } {
  const mgr = getState();
  if (!mgr.activeGame || mgr.activeGame.status !== "playing") {
    return { error: "No active game" };
  }
  if (mgr.activeGame.type !== "wyr") {
    return { error: "Not a Would You Rather game" };
  }
  if (!mgr.activeGame.data.votingOpen) {
    return { error: "Voting is closed — type /next" };
  }

  const result = wyrCastVote(mgr.activeGame, choice, voter);
  mgr.activeGame = result.state;
  const clientState = toClientStateDispatch(mgr.activeGame);
  emitGameState(clientState);

  return { state: clientState, alreadyVoted: result.alreadyVoted };
}

export function closeWyrVoting(): { state: GameClientState; gameStateForReaction: WyrGameState } | { error: string } {
  const mgr = getState();
  if (!mgr.activeGame || mgr.activeGame.status !== "playing") {
    return { error: "No active game" };
  }
  if (mgr.activeGame.type !== "wyr") {
    return { error: "Not a Would You Rather game" };
  }
  if (!mgr.activeGame.data.votingOpen) {
    return { error: "Voting is already closed" };
  }

  mgr.activeGame = wyrCloseVoting(mgr.activeGame);
  const clientState = toClientStateDispatch(mgr.activeGame);
  emitGameState(clientState);

  const gameStateForReaction = snapshotGame(mgr.activeGame) as WyrGameState;
  return { state: clientState, gameStateForReaction };
}

export function resolveWyrOnManager(
  bobsPick: "A" | "B",
  bobsReason: string,
): GameState | null {
  const mgr = getState();
  if (!mgr.activeGame || mgr.activeGame.type !== "wyr") {
    return null;
  }

  mgr.activeGame = wyrResolveRound(mgr.activeGame, bobsPick, bobsReason);
  const clientState = toClientStateDispatch(mgr.activeGame);
  emitGameState(clientState);

  if (mgr.activeGame.status !== "playing") {
    const snapshot = snapshotGame(mgr.activeGame);
    mgr.lastEndedAt = Date.now();
    mgr.activeGame = null;
    return snapshot;
  }

  return null;
}

// ── Hot or Cold-specific: async guess flow ──────────────────────────

export function submitHotColdGuess(
  guessValue: string,
): { state: GameClientState; gameStateForReaction: HotColdGameState } | { error: string } {
  const mgr = getState();
  if (!mgr.activeGame || mgr.activeGame.status !== "playing") {
    return { error: "No active game" };
  }
  if (mgr.activeGame.type !== "hotcold") {
    return { error: "Not a Hot or Cold game" };
  }
  if (mgr.activeGame.data.pendingGuess) {
    return { error: "Bob is still judging... hold on" };
  }
  if (mgr.activeGame.data.guessesUsed >= mgr.activeGame.data.maxGuesses) {
    return { error: "No guesses left!" };
  }

  mgr.activeGame = hotcoldSubmitGuess(mgr.activeGame, guessValue);
  const clientState = toClientStateDispatch(mgr.activeGame);
  emitGameState(clientState);

  const gameStateForReaction = snapshotGame(mgr.activeGame) as HotColdGameState;
  return { state: clientState, gameStateForReaction };
}

export function resolveHotColdOnManager(
  warmth: number,
  isCorrect: boolean,
): GameState | null {
  const mgr = getState();
  if (!mgr.activeGame || mgr.activeGame.type !== "hotcold") {
    return null;
  }

  mgr.activeGame = hotcoldResolveGuess(mgr.activeGame, warmth, isCorrect);
  const clientState = toClientStateDispatch(mgr.activeGame);
  emitGameState(clientState);

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
