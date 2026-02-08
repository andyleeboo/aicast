import type { HangmanGameState, HangmanClientState, HangmanData } from "./game-types";

// ── Categorized word list ────────────────────────────────────────────

const WORDS: Record<string, string[]> = {
  animals: [
    "elephant", "giraffe", "penguin", "dolphin", "octopus",
    "kangaroo", "cheetah", "flamingo", "pangolin", "narwhal",
  ],
  movies: [
    "inception", "avatar", "gladiator", "titanic", "interstellar",
    "parasite", "dunkirk", "jaws", "rocky", "matrix",
  ],
  food: [
    "spaghetti", "burrito", "croissant", "sushi", "pancake",
    "avocado", "lasagna", "pretzel", "dumpling", "waffle",
  ],
  tech: [
    "algorithm", "bluetooth", "database", "firewall", "javascript",
    "keyboard", "software", "terminal", "compiler", "pixel",
  ],
  music: [
    "guitar", "symphony", "drumstick", "karaoke", "ukulele",
    "harmonica", "saxophone", "playlist", "microphone", "bassline",
  ],
  sports: [
    "basketball", "swimming", "archery", "volleyball", "skateboard",
    "marathon", "surfing", "cricket", "fencing", "badminton",
  ],
  nature: [
    "waterfall", "volcano", "tornado", "glacier", "rainbow",
    "lightning", "blizzard", "canyon", "tsunami", "avalanche",
  ],
  space: [
    "asteroid", "galaxy", "nebula", "satellite", "supernova",
    "blackhole", "constellation", "spaceship", "gravity", "eclipse",
  ],
};

const ALL_ENTRIES = Object.entries(WORDS).flatMap(([category, words]) =>
  words.map((word) => ({ word, category })),
);

// ── Game logic ───────────────────────────────────────────────────────

function buildMask(word: string, guessed: string[]): string[] {
  return [...word].map((ch) => (guessed.includes(ch) ? ch : "_"));
}

export function startGame(): HangmanGameState {
  const entry = ALL_ENTRIES[Math.floor(Math.random() * ALL_ENTRIES.length)];
  const data: HangmanData = {
    word: entry.word.toLowerCase(),
    maskedWord: buildMask(entry.word.toLowerCase(), []),
    guessedLetters: [],
    wrongGuesses: 0,
    maxWrong: 6,
    category: entry.category,
  };
  return {
    gameId: crypto.randomUUID(),
    type: "hangman",
    status: "playing",
    startedAt: Date.now(),
    data,
  };
}

export function processGuess(
  state: HangmanGameState,
  letter: string,
): { state: HangmanGameState; correct: boolean } {
  const ch = letter.toLowerCase();
  const { data } = state;

  if (data.guessedLetters.includes(ch) || state.status !== "playing") {
    return { state, correct: false };
  }

  const guessedLetters = [...data.guessedLetters, ch];
  const correct = data.word.includes(ch);
  const wrongGuesses = correct ? data.wrongGuesses : data.wrongGuesses + 1;
  const maskedWord = buildMask(data.word, guessedLetters);

  const won = !maskedWord.includes("_");
  const lost = wrongGuesses >= data.maxWrong;

  const next: HangmanGameState = {
    ...state,
    status: won ? "won" : lost ? "lost" : "playing",
    data: { ...data, guessedLetters, wrongGuesses, maskedWord },
  };

  return { state: next, correct };
}

export function processWordGuess(
  state: HangmanGameState,
  word: string,
): { state: HangmanGameState; correct: boolean } {
  if (state.status !== "playing") return { state, correct: false };

  const guess = word.toLowerCase();
  const correct = guess === state.data.word;

  if (correct) {
    const maskedWord = [...state.data.word];
    const next: HangmanGameState = {
      ...state,
      status: "won",
      data: { ...state.data, maskedWord },
    };
    return { state: next, correct: true };
  }

  const wrongGuesses = state.data.wrongGuesses + 1;
  const lost = wrongGuesses >= state.data.maxWrong;
  const next: HangmanGameState = {
    ...state,
    status: lost ? "lost" : "playing",
    data: { ...state.data, wrongGuesses },
  };
  return { state: next, correct: false };
}

/** Strip the secret word for client broadcast */
export function toClientState(state: HangmanGameState): HangmanClientState {
  return {
    gameId: state.gameId,
    type: "hangman",
    status: state.status,
    data: {
      maskedWord: state.data.maskedWord,
      guessedLetters: state.data.guessedLetters,
      wrongGuesses: state.data.wrongGuesses,
      maxWrong: state.data.maxWrong,
      category: state.data.category,
    },
  };
}
