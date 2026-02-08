import type { GameState, HangmanData, GameClientState } from "./game-types";

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

export function startGame(): GameState {
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
  state: GameState,
  letter: string,
): { state: GameState; correct: boolean } {
  const ch = letter.toLowerCase();
  const { data } = state;

  // Already guessed or game over
  if (data.guessedLetters.includes(ch) || state.status !== "playing") {
    return { state, correct: false };
  }

  const guessedLetters = [...data.guessedLetters, ch];
  const correct = data.word.includes(ch);
  const wrongGuesses = correct ? data.wrongGuesses : data.wrongGuesses + 1;
  const maskedWord = buildMask(data.word, guessedLetters);

  const won = !maskedWord.includes("_");
  const lost = wrongGuesses >= data.maxWrong;

  const next: GameState = {
    ...state,
    status: won ? "won" : lost ? "lost" : "playing",
    data: { ...data, guessedLetters, wrongGuesses, maskedWord },
  };

  return { state: next, correct };
}

export function processWordGuess(
  state: GameState,
  word: string,
): { state: GameState; correct: boolean } {
  if (state.status !== "playing") return { state, correct: false };

  const guess = word.toLowerCase();
  const correct = guess === state.data.word;

  if (correct) {
    // Reveal all letters
    const maskedWord = [...state.data.word];
    const next: GameState = {
      ...state,
      status: "won",
      data: { ...state.data, maskedWord },
    };
    return { state: next, correct: true };
  }

  // Wrong word guess costs one wrong guess
  const wrongGuesses = state.data.wrongGuesses + 1;
  const lost = wrongGuesses >= state.data.maxWrong;
  const next: GameState = {
    ...state,
    status: lost ? "lost" : "playing",
    data: { ...state.data, wrongGuesses },
  };
  return { state: next, correct: false };
}

/** Strip the secret word for client broadcast */
export function toClientState(state: GameState): GameClientState {
  return {
    gameId: state.gameId,
    type: state.type,
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
