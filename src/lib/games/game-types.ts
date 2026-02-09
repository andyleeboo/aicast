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

// ── Trivia types ──────────────────────────────────────────────────

export interface TriviaQuestion {
  question: string;
  answer: string;
  category: string;
}

export interface TriviaRoundResult {
  question: string;
  correctAnswer: string;
  viewerAnswer: string | null;
  correct: boolean;
}

export interface TriviaData {
  questions: TriviaQuestion[];   // server-only (has answers)
  currentRound: number;          // 0-indexed
  maxRounds: number;             // 5
  score: number;
  wrongAnswers: number;
  maxWrong: number;              // 3
  pendingAnswer: boolean;
  roundResults: TriviaRoundResult[];
}

export interface TriviaClientData {
  currentQuestion: string;
  currentCategory: string;
  currentRound: number;
  maxRounds: number;
  score: number;
  wrongAnswers: number;
  maxWrong: number;
  pendingAnswer: boolean;
  roundResults: TriviaRoundResult[];
}

// ── Would You Rather types ────────────────────────────────────────

export interface WyrDilemma {
  optionA: string;
  optionB: string;
  category: string;
}

export interface WyrRoundResult {
  optionA: string;
  optionB: string;
  votesA: number;
  votesB: number;
  bobsPick: "A" | "B" | null;
  bobsReason: string | null;
}

export interface WyrData {
  dilemmas: WyrDilemma[];        // server-only (future rounds)
  currentRound: number;
  maxRounds: number;             // 5
  votesA: number;
  votesB: number;
  voters: string[];              // server-only (prevent double vote)
  votingOpen: boolean;
  roundResults: WyrRoundResult[];
}

export interface WyrClientData {
  currentOptionA: string;
  currentOptionB: string;
  currentCategory: string;
  currentRound: number;
  maxRounds: number;
  votesA: number;
  votesB: number;
  votingOpen: boolean;
  roundResults: WyrRoundResult[];
}

// ── Hot or Cold types ─────────────────────────────────────────────

export interface HotColdGuessEntry {
  guess: string;
  warmth: number;         // 0=pending, 1-5 after judging
  isCorrect: boolean;
}

export interface HotColdData {
  secret: string;          // server-only
  category: string;
  guessesUsed: number;
  maxGuesses: number;      // 10
  warmth: number;          // current 0-5
  history: HotColdGuessEntry[];
  pendingGuess: boolean;
}

export interface HotColdClientData {
  category: string;
  guessesUsed: number;
  maxGuesses: number;
  warmth: number;
  history: HotColdGuessEntry[];
  pendingGuess: boolean;
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

export interface TriviaGameState extends GameStateBase {
  type: "trivia";
  data: TriviaData;
}

export interface WyrGameState extends GameStateBase {
  type: "wyr";
  data: WyrData;
}

export interface HotColdGameState extends GameStateBase {
  type: "hotcold";
  data: HotColdData;
}

export type GameState =
  | HangmanGameState
  | TwentyQGameState
  | TriviaGameState
  | WyrGameState
  | HotColdGameState;

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

export interface TriviaClientState extends GameClientStateBase {
  type: "trivia";
  data: TriviaClientData;
}

export interface WyrClientState extends GameClientStateBase {
  type: "wyr";
  data: WyrClientData;
}

export interface HotColdClientState extends GameClientStateBase {
  type: "hotcold";
  data: HotColdClientData;
}

export type GameClientState =
  | HangmanClientState
  | TwentyQClientState
  | TriviaClientState
  | WyrClientState
  | HotColdClientState;

export type GameType = GameState["type"];
