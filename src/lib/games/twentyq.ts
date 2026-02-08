import type {
  TwentyQGameState,
  TwentyQClientState,
  TwentyQCategory,
  TwentyQData,
} from "./game-types";

// ── Subject list ────────────────────────────────────────────────────
// Broadly known subjects — easy for Gemini to reason about, fun to guess.

const SUBJECTS: { name: string; category: TwentyQCategory }[] = [
  // People
  { name: "Albert Einstein", category: "person" },
  { name: "Cleopatra", category: "person" },
  { name: "Shakespeare", category: "person" },
  { name: "Marie Curie", category: "person" },
  { name: "Michael Jackson", category: "person" },
  { name: "Leonardo da Vinci", category: "person" },
  { name: "Napoleon", category: "person" },
  { name: "Beyonce", category: "person" },
  { name: "Elon Musk", category: "person" },
  { name: "Sherlock Holmes", category: "person" },
  // Places
  { name: "Eiffel Tower", category: "place" },
  { name: "Grand Canyon", category: "place" },
  { name: "Great Wall of China", category: "place" },
  { name: "Mount Everest", category: "place" },
  { name: "Bermuda Triangle", category: "place" },
  { name: "Machu Picchu", category: "place" },
  { name: "Sahara Desert", category: "place" },
  { name: "Antarctica", category: "place" },
  { name: "Times Square", category: "place" },
  { name: "Amazon Rainforest", category: "place" },
  // Things
  { name: "Piano", category: "thing" },
  { name: "Skateboard", category: "thing" },
  { name: "Telescope", category: "thing" },
  { name: "Bitcoin", category: "thing" },
  { name: "Rubik's Cube", category: "thing" },
  { name: "Hot Air Balloon", category: "thing" },
  { name: "Microwave", category: "thing" },
  { name: "Surfboard", category: "thing" },
  { name: "Lightsaber", category: "thing" },
  { name: "Toaster", category: "thing" },
];

// ── Game logic ──────────────────────────────────────────────────────

export function startGame(): TwentyQGameState {
  const subject = SUBJECTS[Math.floor(Math.random() * SUBJECTS.length)];
  const data: TwentyQData = {
    secret: subject.name,
    category: subject.category,
    questionsAsked: 0,
    maxQuestions: 20,
    warmth: 0,
    history: [],
    pendingQuestion: false,
  };
  return {
    gameId: crypto.randomUUID(),
    type: "twentyq",
    status: "playing",
    startedAt: Date.now(),
    data,
  };
}

/** Append a question to history with null answer (pending). */
export function addQuestion(
  state: TwentyQGameState,
  question: string,
  isGuess: boolean,
): TwentyQGameState {
  return {
    ...state,
    data: {
      ...state.data,
      questionsAsked: state.data.questionsAsked + 1,
      pendingQuestion: true,
      history: [
        ...state.data.history,
        { question, answer: null, warmth: 0, isGuess },
      ],
    },
  };
}

/** Fill in the answer on the last history entry after Gemini responds. */
export function resolveQuestion(
  state: TwentyQGameState,
  answer: string,
  warmth: number,
  isCorrectGuess: boolean,
): TwentyQGameState {
  const history = [...state.data.history];
  const lastIdx = history.length - 1;
  if (lastIdx < 0) return state;

  history[lastIdx] = { ...history[lastIdx], answer, warmth };

  const won = isCorrectGuess;
  const lost = !won && state.data.questionsAsked >= state.data.maxQuestions;

  return {
    ...state,
    status: won ? "won" : lost ? "lost" : "playing",
    data: {
      ...state.data,
      warmth,
      pendingQuestion: false,
      history,
    },
  };
}

/** Strip the secret for client broadcast. */
export function toClientState(state: TwentyQGameState): TwentyQClientState {
  return {
    gameId: state.gameId,
    type: "twentyq",
    status: state.status,
    data: {
      category: state.data.category,
      questionsAsked: state.data.questionsAsked,
      maxQuestions: state.data.maxQuestions,
      warmth: state.data.warmth,
      history: state.data.history,
      pendingQuestion: state.data.pendingQuestion,
    },
  };
}
