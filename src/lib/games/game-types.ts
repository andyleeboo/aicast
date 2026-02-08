export interface GameState {
  gameId: string;
  type: "hangman"; // extensible union for future games
  status: "playing" | "won" | "lost";
  startedAt: number;
  data: HangmanData; // union with future game data types
}

export interface HangmanData {
  word: string; // the secret word (server-only, hidden from client events)
  maskedWord: string[]; // ["_", "a", "_", "_"] — what viewers see
  guessedLetters: string[]; // all letters tried
  wrongGuesses: number; // 0–6
  maxWrong: number; // 6
  category: string; // hint category
}

// What gets sent to clients (word is hidden)
export interface HangmanClientData {
  maskedWord: string[];
  guessedLetters: string[];
  wrongGuesses: number;
  maxWrong: number;
  category: string;
}

export interface GameClientState {
  gameId: string;
  type: "hangman";
  status: "playing" | "won" | "lost";
  data: HangmanClientData;
}
