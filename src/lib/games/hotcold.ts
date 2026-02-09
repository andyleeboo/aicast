import type { HotColdGameState, HotColdClientState, HotColdData } from "./game-types";

// ── Subject bank ────────────────────────────────────────────────────
// Concrete nouns that are easy for Gemini to judge warmth on.

const SUBJECTS: { name: string; category: string }[] = [
  // Food
  { name: "Pizza", category: "Food" },
  { name: "Sushi", category: "Food" },
  { name: "Chocolate", category: "Food" },
  { name: "Popcorn", category: "Food" },
  { name: "Pancake", category: "Food" },
  { name: "Taco", category: "Food" },
  { name: "Ice Cream", category: "Food" },
  { name: "Donut", category: "Food" },
  { name: "Pretzel", category: "Food" },
  { name: "Waffle", category: "Food" },
  // Animals
  { name: "Penguin", category: "Animals" },
  { name: "Octopus", category: "Animals" },
  { name: "Giraffe", category: "Animals" },
  { name: "Dolphin", category: "Animals" },
  { name: "Panda", category: "Animals" },
  { name: "Flamingo", category: "Animals" },
  { name: "Chameleon", category: "Animals" },
  { name: "Koala", category: "Animals" },
  { name: "Jellyfish", category: "Animals" },
  { name: "Parrot", category: "Animals" },
  // Objects
  { name: "Umbrella", category: "Objects" },
  { name: "Flashlight", category: "Objects" },
  { name: "Compass", category: "Objects" },
  { name: "Telescope", category: "Objects" },
  { name: "Backpack", category: "Objects" },
  { name: "Candle", category: "Objects" },
  { name: "Skateboard", category: "Objects" },
  { name: "Guitar", category: "Objects" },
  { name: "Microphone", category: "Objects" },
  { name: "Treasure Chest", category: "Objects" },
  // Sports
  { name: "Basketball", category: "Sports" },
  { name: "Surfboard", category: "Sports" },
  { name: "Boxing Gloves", category: "Sports" },
  { name: "Snowboard", category: "Sports" },
  { name: "Tennis Racket", category: "Sports" },
  { name: "Soccer Ball", category: "Sports" },
  { name: "Hockey Puck", category: "Sports" },
  { name: "Baseball Bat", category: "Sports" },
  // Tech
  { name: "Robot", category: "Tech" },
  { name: "Satellite", category: "Tech" },
  { name: "Drone", category: "Tech" },
  { name: "Keyboard", category: "Tech" },
  { name: "Headphones", category: "Tech" },
  { name: "Joystick", category: "Tech" },
  { name: "Webcam", category: "Tech" },
  { name: "USB Drive", category: "Tech" },
  // Nature
  { name: "Volcano", category: "Nature" },
  { name: "Waterfall", category: "Nature" },
  { name: "Rainbow", category: "Nature" },
  { name: "Cactus", category: "Nature" },
  { name: "Crystal", category: "Nature" },
  { name: "Mushroom", category: "Nature" },
  { name: "Seashell", category: "Nature" },
  { name: "Acorn", category: "Nature" },
  { name: "Snowflake", category: "Nature" },
  { name: "Lightning", category: "Nature" },
];

// ── Game logic ──────────────────────────────────────────────────────

export function startGame(): HotColdGameState {
  const subject = SUBJECTS[Math.floor(Math.random() * SUBJECTS.length)];
  const data: HotColdData = {
    secret: subject.name,
    category: subject.category,
    guessesUsed: 0,
    maxGuesses: 10,
    warmth: 0,
    history: [],
    pendingGuess: false,
  };
  return {
    gameId: crypto.randomUUID(),
    type: "hotcold",
    status: "playing",
    startedAt: Date.now(),
    data,
  };
}

/** Append a guess with warmth: 0 (pending), set pendingGuess: true */
export function submitGuess(
  state: HotColdGameState,
  guess: string,
): HotColdGameState {
  return {
    ...state,
    data: {
      ...state.data,
      guessesUsed: state.data.guessesUsed + 1,
      pendingGuess: true,
      history: [
        ...state.data.history,
        { guess, warmth: 0, isCorrect: false },
      ],
    },
  };
}

/** Fill in warmth on the last history entry after Gemini responds. */
export function resolveGuess(
  state: HotColdGameState,
  warmth: number,
  isCorrect: boolean,
): HotColdGameState {
  const history = [...state.data.history];
  const lastIdx = history.length - 1;
  if (lastIdx < 0) return state;

  history[lastIdx] = { ...history[lastIdx], warmth, isCorrect };

  const won = isCorrect;
  const lost = !won && state.data.guessesUsed >= state.data.maxGuesses;

  return {
    ...state,
    status: won ? "won" : lost ? "lost" : "playing",
    data: {
      ...state.data,
      warmth,
      pendingGuess: false,
      history,
    },
  };
}

/** Strip the secret for client broadcast. */
export function toClientState(state: HotColdGameState): HotColdClientState {
  return {
    gameId: state.gameId,
    type: "hotcold",
    status: state.status,
    data: {
      category: state.data.category,
      guessesUsed: state.data.guessesUsed,
      maxGuesses: state.data.maxGuesses,
      warmth: state.data.warmth,
      history: state.data.history,
      pendingGuess: state.data.pendingGuess,
    },
  };
}
