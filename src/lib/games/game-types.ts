// ── Hangman types ───────────────────────────────────────────────────

export interface HangmanData {
  word: string; // the secret word (server-only, hidden from client events)
  maskedWord: string[]; // ["_", "a", "_", "_"] — what viewers see
  guessedLetters: string[]; // all letters tried
  wrongGuesses: number; // 0–6
  maxWrong: number; // 6
  category: string; // hint category
}

export interface HangmanClientData {
  maskedWord: string[];
  guessedLetters: string[];
  wrongGuesses: number;
  maxWrong: number;
  category: string;
}

// ── 20 Questions types ──────────────────────────────────────────────

export type TwentyQCategory = "person" | "place" | "thing";

export interface TwentyQHistoryEntry {
  question: string;
  answer: string | null; // null = pending (Gemini hasn't responded yet)
  warmth: number; // 0 = pending, 1-5 after AI responds
  isGuess: boolean; // true for /answer attempts
}

export interface TwentyQData {
  secret: string; // server-only — never sent to client
  category: TwentyQCategory;
  questionsAsked: number;
  maxQuestions: number; // 20
  warmth: number; // current 0-5
  history: TwentyQHistoryEntry[];
  pendingQuestion: boolean;
}

export interface TwentyQClientData {
  category: TwentyQCategory;
  questionsAsked: number;
  maxQuestions: number;
  warmth: number;
  history: TwentyQHistoryEntry[];
  pendingQuestion: boolean;
}

// ── Discriminated union: server state ───────────────────────────────

interface GameStateBase {
  gameId: string;
  status: "playing" | "won" | "lost";
  startedAt: number;
}

export interface HangmanGameState extends GameStateBase {
  type: "hangman";
  data: HangmanData;
}

export interface TwentyQGameState extends GameStateBase {
  type: "twentyq";
  data: TwentyQData;
}

export type GameState = HangmanGameState | TwentyQGameState;

// ── Discriminated union: client state ───────────────────────────────

interface GameClientStateBase {
  gameId: string;
  status: "playing" | "won" | "lost";
}

export interface HangmanClientState extends GameClientStateBase {
  type: "hangman";
  data: HangmanClientData;
}

export interface TwentyQClientState extends GameClientStateBase {
  type: "twentyq";
  data: TwentyQClientData;
}

export type GameClientState = HangmanClientState | TwentyQClientState;

export type GameType = GameState["type"];
