import type {
  TriviaGameState,
  TriviaClientState,
  TriviaData,
  TriviaQuestion,
} from "./game-types";

// ── Question bank ───────────────────────────────────────────────────

const QUESTIONS: TriviaQuestion[] = [
  // Science
  { question: "What planet is known as the Red Planet?", answer: "Mars", category: "Science" },
  { question: "What gas do plants absorb from the atmosphere?", answer: "Carbon dioxide", category: "Science" },
  { question: "What is the hardest natural substance on Earth?", answer: "Diamond", category: "Science" },
  { question: "What is the chemical symbol for gold?", answer: "Au", category: "Science" },
  { question: "How many bones are in the adult human body?", answer: "206", category: "Science" },
  { question: "What is the speed of light in km/s (approximately)?", answer: "300000", category: "Science" },
  { question: "What is the largest organ in the human body?", answer: "Skin", category: "Science" },
  { question: "What element does 'O' represent on the periodic table?", answer: "Oxygen", category: "Science" },
  { question: "What force keeps us on the ground?", answer: "Gravity", category: "Science" },
  { question: "What is the closest star to Earth?", answer: "The Sun", category: "Science" },
  // History
  { question: "In what year did World War II end?", answer: "1945", category: "History" },
  { question: "Who was the first president of the United States?", answer: "George Washington", category: "History" },
  { question: "What ancient civilization built the pyramids?", answer: "Egyptians", category: "History" },
  { question: "What ship sank on its maiden voyage in 1912?", answer: "Titanic", category: "History" },
  { question: "Who painted the Mona Lisa?", answer: "Leonardo da Vinci", category: "History" },
  { question: "What year did humans first land on the Moon?", answer: "1969", category: "History" },
  { question: "What empire was ruled by Julius Caesar?", answer: "Roman Empire", category: "History" },
  { question: "Who discovered penicillin?", answer: "Alexander Fleming", category: "History" },
  { question: "What was the name of the first artificial satellite?", answer: "Sputnik", category: "History" },
  { question: "In what country did the Industrial Revolution begin?", answer: "England", category: "History" },
  // Geography
  { question: "What is the largest ocean on Earth?", answer: "Pacific Ocean", category: "Geography" },
  { question: "What is the longest river in the world?", answer: "Nile", category: "Geography" },
  { question: "What country has the most people?", answer: "India", category: "Geography" },
  { question: "What is the smallest country in the world?", answer: "Vatican City", category: "Geography" },
  { question: "On which continent is the Sahara Desert?", answer: "Africa", category: "Geography" },
  { question: "What is the capital of Japan?", answer: "Tokyo", category: "Geography" },
  { question: "What mountain is the tallest in the world?", answer: "Mount Everest", category: "Geography" },
  { question: "How many continents are there?", answer: "7", category: "Geography" },
  { question: "What country is shaped like a boot?", answer: "Italy", category: "Geography" },
  { question: "What is the largest island in the world?", answer: "Greenland", category: "Geography" },
  // Pop Culture
  { question: "What is the name of Harry Potter's owl?", answer: "Hedwig", category: "Pop Culture" },
  { question: "Who played Iron Man in the MCU?", answer: "Robert Downey Jr", category: "Pop Culture" },
  { question: "What band sang 'Bohemian Rhapsody'?", answer: "Queen", category: "Pop Culture" },
  { question: "What is the highest-grossing film of all time?", answer: "Avatar", category: "Pop Culture" },
  { question: "Who wrote the 'Harry Potter' book series?", answer: "JK Rowling", category: "Pop Culture" },
  { question: "What video game features a plumber named Mario?", answer: "Super Mario Bros", category: "Pop Culture" },
  { question: "What is the name of Batman's butler?", answer: "Alfred", category: "Pop Culture" },
  { question: "Which pop star is known as the 'Queen of Pop'?", answer: "Madonna", category: "Pop Culture" },
  { question: "What fictional country is Black Panther from?", answer: "Wakanda", category: "Pop Culture" },
  { question: "Who directed Jurassic Park?", answer: "Steven Spielberg", category: "Pop Culture" },
  // Tech
  { question: "What does 'HTML' stand for?", answer: "HyperText Markup Language", category: "Tech" },
  { question: "Who co-founded Apple with Steve Jobs?", answer: "Steve Wozniak", category: "Tech" },
  { question: "What does 'CPU' stand for?", answer: "Central Processing Unit", category: "Tech" },
  { question: "What programming language is named after a type of coffee?", answer: "Java", category: "Tech" },
  { question: "What year was the first iPhone released?", answer: "2007", category: "Tech" },
  { question: "What company created the Android operating system?", answer: "Google", category: "Tech" },
  { question: "What does 'Wi-Fi' stand for?", answer: "Wireless Fidelity", category: "Tech" },
  { question: "Who is known as the father of computer science?", answer: "Alan Turing", category: "Tech" },
  { question: "What company makes the PlayStation?", answer: "Sony", category: "Tech" },
  { question: "What does 'USB' stand for?", answer: "Universal Serial Bus", category: "Tech" },
  // Sports
  { question: "How many players are on a soccer team?", answer: "11", category: "Sports" },
  { question: "What sport is played at Wimbledon?", answer: "Tennis", category: "Sports" },
  { question: "In which sport would you perform a slam dunk?", answer: "Basketball", category: "Sports" },
  { question: "How many rings are on the Olympic flag?", answer: "5", category: "Sports" },
  { question: "What country invented the sport of cricket?", answer: "England", category: "Sports" },
  { question: "How long is a marathon in miles (approximately)?", answer: "26", category: "Sports" },
  { question: "What sport uses a shuttlecock?", answer: "Badminton", category: "Sports" },
  { question: "In baseball, how many strikes make an out?", answer: "3", category: "Sports" },
  { question: "What is the national sport of Canada?", answer: "Lacrosse", category: "Sports" },
  { question: "How many holes are on a standard golf course?", answer: "18", category: "Sports" },
  // Food
  { question: "What fruit is on top of a traditional Hawaiian pizza?", answer: "Pineapple", category: "Food" },
  { question: "What country is sushi originally from?", answer: "Japan", category: "Food" },
  { question: "What is the main ingredient in guacamole?", answer: "Avocado", category: "Food" },
  { question: "What grain is used to make sake?", answer: "Rice", category: "Food" },
  { question: "What nut is used to make marzipan?", answer: "Almond", category: "Food" },
  { question: "What Italian dish means 'little strings'?", answer: "Spaghetti", category: "Food" },
  { question: "What is the most expensive spice in the world by weight?", answer: "Saffron", category: "Food" },
  { question: "What type of pasta is shaped like a bow tie?", answer: "Farfalle", category: "Food" },
  // Nature
  { question: "What is the largest mammal on Earth?", answer: "Blue Whale", category: "Nature" },
  { question: "How many legs does a spider have?", answer: "8", category: "Nature" },
  { question: "What is a group of wolves called?", answer: "Pack", category: "Nature" },
  { question: "What type of tree produces acorns?", answer: "Oak", category: "Nature" },
  { question: "What is the fastest land animal?", answer: "Cheetah", category: "Nature" },
  { question: "What is the tallest type of grass?", answer: "Bamboo", category: "Nature" },
  { question: "How many hearts does an octopus have?", answer: "3", category: "Nature" },
  { question: "What animal is known for changing its color?", answer: "Chameleon", category: "Nature" },
];

// Fisher-Yates shuffle
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── Game logic ──────────────────────────────────────────────────────

export function startGame(): TriviaGameState {
  const picked = shuffle(QUESTIONS).slice(0, 5);
  const data: TriviaData = {
    questions: picked,
    currentRound: 0,
    maxRounds: 5,
    score: 0,
    wrongAnswers: 0,
    maxWrong: 3,
    pendingAnswer: false,
    roundResults: [],
  };
  return {
    gameId: crypto.randomUUID(),
    type: "trivia",
    status: "playing",
    startedAt: Date.now(),
    data,
  };
}

/** Mark the current round as pending — Gemini will judge the answer. */
export function submitAnswer(
  state: TriviaGameState,
  answer: string,
): TriviaGameState {
  return {
    ...state,
    data: {
      ...state.data,
      pendingAnswer: true,
      // Add a placeholder result that will be filled on resolve
      roundResults: [
        ...state.data.roundResults,
        {
          question: state.data.questions[state.data.currentRound].question,
          correctAnswer: state.data.questions[state.data.currentRound].answer,
          viewerAnswer: answer,
          correct: false, // will be updated on resolve
        },
      ],
    },
  };
}

/** Fill in Gemini's judgment and auto-advance. */
export function resolveAnswer(
  state: TriviaGameState,
  correct: boolean,
): TriviaGameState {
  const roundResults = [...state.data.roundResults];
  const lastIdx = roundResults.length - 1;
  if (lastIdx < 0) return state;

  roundResults[lastIdx] = { ...roundResults[lastIdx], correct };

  const score = correct ? state.data.score + 1 : state.data.score;
  const wrongAnswers = correct ? state.data.wrongAnswers : state.data.wrongAnswers + 1;
  const nextRound = state.data.currentRound + 1;

  const won = score === state.data.maxRounds;
  const lost = wrongAnswers >= state.data.maxWrong;
  const outOfRounds = nextRound >= state.data.maxRounds;

  return {
    ...state,
    status: won ? "won" : lost ? "lost" : outOfRounds ? "won" : "playing",
    data: {
      ...state.data,
      score,
      wrongAnswers,
      currentRound: nextRound,
      pendingAnswer: false,
      roundResults,
    },
  };
}

/** Strip questions array, expose only current question. */
export function toClientState(state: TriviaGameState): TriviaClientState {
  const q = state.data.questions[state.data.currentRound];
  return {
    gameId: state.gameId,
    type: "trivia",
    status: state.status,
    data: {
      currentQuestion: q ? q.question : "",
      currentCategory: q ? q.category : "",
      currentRound: state.data.currentRound,
      maxRounds: state.data.maxRounds,
      score: state.data.score,
      wrongAnswers: state.data.wrongAnswers,
      maxWrong: state.data.maxWrong,
      pendingAnswer: state.data.pendingAnswer,
      roundResults: state.data.roundResults,
    },
  };
}
