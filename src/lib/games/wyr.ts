import type {
  WyrGameState,
  WyrClientState,
  WyrData,
  WyrDilemma,
} from "./game-types";

// ── Dilemma bank ────────────────────────────────────────────────────

const DILEMMAS: WyrDilemma[] = [
  // Superpowers
  { optionA: "Be able to fly", optionB: "Be able to read minds", category: "Superpowers" },
  { optionA: "Have super strength", optionB: "Have super speed", category: "Superpowers" },
  { optionA: "Be invisible", optionB: "Be able to teleport", category: "Superpowers" },
  { optionA: "Control fire", optionB: "Control water", category: "Superpowers" },
  { optionA: "Talk to animals", optionB: "Speak every human language", category: "Superpowers" },
  { optionA: "Have X-ray vision", optionB: "Have perfect memory", category: "Superpowers" },
  { optionA: "Breathe underwater", optionB: "Survive in outer space", category: "Superpowers" },
  // Time
  { optionA: "Live 200 years ago", optionB: "Live 200 years in the future", category: "Time" },
  { optionA: "Relive your best day forever", optionB: "Skip to the best day you haven't had yet", category: "Time" },
  { optionA: "Pause time at will", optionB: "Rewind time once per day", category: "Time" },
  { optionA: "Know your future", optionB: "Change your past", category: "Time" },
  { optionA: "Have an extra hour every day", optionB: "Have an extra day every week", category: "Time" },
  // Food
  { optionA: "Only eat pizza for a year", optionB: "Never eat pizza again", category: "Food" },
  { optionA: "Cook like a master chef", optionB: "Never need to eat", category: "Food" },
  { optionA: "Only eat sweet foods", optionB: "Only eat savory foods", category: "Food" },
  { optionA: "Unlimited free sushi", optionB: "Unlimited free tacos", category: "Food" },
  { optionA: "Everything you cook is perfect", optionB: "Every restaurant meal is free", category: "Food" },
  // Social
  { optionA: "Be famous but have no privacy", optionB: "Be unknown but have total freedom", category: "Social" },
  { optionA: "Have 1 best friend who's always there", optionB: "Have 100 friends who are sometimes around", category: "Social" },
  { optionA: "Always know when someone is lying", optionB: "Always get away with lying", category: "Social" },
  { optionA: "Be the funniest person in every room", optionB: "Be the smartest person in every room", category: "Social" },
  { optionA: "Never be embarrassed again", optionB: "Never be bored again", category: "Social" },
  // Tech
  { optionA: "Have the best phone that exists in 2050", optionB: "Have a self-driving flying car", category: "Tech" },
  { optionA: "Live in a VR world of your design", optionB: "Have a robot that does all your chores", category: "Tech" },
  { optionA: "Have free Wi-Fi everywhere forever", optionB: "Have unlimited free electricity forever", category: "Tech" },
  { optionA: "Talk to AI that knows everything", optionB: "Have a personal AI that manages your life", category: "Tech" },
  { optionA: "Never have a dead battery", optionB: "Never have a slow internet connection", category: "Tech" },
  // Life
  { optionA: "Always be warm", optionB: "Always be cool", category: "Life" },
  { optionA: "Never need to sleep", optionB: "Never need to work", category: "Life" },
  { optionA: "Have a perfect singing voice", optionB: "Be an amazing dancer", category: "Life" },
  { optionA: "Explore the deep ocean", optionB: "Explore outer space", category: "Life" },
  { optionA: "Know the answer to any question", optionB: "Be able to master any skill in a day", category: "Life" },
  { optionA: "Live in a treehouse mansion", optionB: "Live in an underwater base", category: "Life" },
  { optionA: "Always have perfect weather", optionB: "Always have the perfect outfit", category: "Life" },
  // Challenges
  { optionA: "Fight 100 duck-sized horses", optionB: "Fight 1 horse-sized duck", category: "Challenges" },
  { optionA: "Give up your phone for a month", optionB: "Give up your bed for a month", category: "Challenges" },
  { optionA: "Eat a ghost pepper", optionB: "Eat a live cricket", category: "Challenges" },
  { optionA: "Only whisper for a week", optionB: "Only shout for a week", category: "Challenges" },
  { optionA: "Run a marathon tomorrow", optionB: "Give a speech to 10,000 people tomorrow", category: "Challenges" },
  // Random
  { optionA: "Have a pet dragon (cat-sized)", optionB: "Have a pet dinosaur (dog-sized)", category: "Random" },
  { optionA: "Live in the world of your favorite movie", optionB: "Have your favorite movie character as a friend", category: "Random" },
  { optionA: "Always find $20 in your pocket", optionB: "Always find a parking spot", category: "Random" },
  { optionA: "Be a wizard at Hogwarts", optionB: "Be a Jedi in Star Wars", category: "Random" },
  { optionA: "Have a rewind button for life", optionB: "Have a pause button for life", category: "Random" },
  { optionA: "Smell like cookies all the time", optionB: "Have hair that changes color with your mood", category: "Random" },
  { optionA: "Have a personal theme song that plays when you enter rooms", optionB: "Have a narrator that narrates your life", category: "Random" },
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

export function startGame(): WyrGameState {
  const picked = shuffle(DILEMMAS).slice(0, 5);
  const data: WyrData = {
    dilemmas: picked,
    currentRound: 0,
    maxRounds: 5,
    votesA: 0,
    votesB: 0,
    voters: [],
    votingOpen: true,
    roundResults: [],
  };
  return {
    gameId: crypto.randomUUID(),
    type: "wyr",
    status: "playing",
    startedAt: Date.now(),
    data,
  };
}

/** Cast a vote — returns { alreadyVoted } */
export function castVote(
  state: WyrGameState,
  choice: "a" | "b",
  voter: string,
): { state: WyrGameState; alreadyVoted: boolean } {
  if (!state.data.votingOpen || state.data.voters.includes(voter)) {
    return { state, alreadyVoted: true };
  }

  return {
    state: {
      ...state,
      data: {
        ...state.data,
        votesA: choice === "a" ? state.data.votesA + 1 : state.data.votesA,
        votesB: choice === "b" ? state.data.votesB + 1 : state.data.votesB,
        voters: [...state.data.voters, voter],
      },
    },
    alreadyVoted: false,
  };
}

/** Close voting for the current round — awaiting Gemini reaction. */
export function closeVoting(state: WyrGameState): WyrGameState {
  return {
    ...state,
    data: {
      ...state.data,
      votingOpen: false,
    },
  };
}

/** Record Bob's pick and advance to the next round. */
export function resolveRound(
  state: WyrGameState,
  bobsPick: "A" | "B",
  bobsReason: string,
): WyrGameState {
  const d = state.data.dilemmas[state.data.currentRound];
  const roundResult = {
    optionA: d.optionA,
    optionB: d.optionB,
    votesA: state.data.votesA,
    votesB: state.data.votesB,
    bobsPick,
    bobsReason,
  };

  const nextRound = state.data.currentRound + 1;
  const done = nextRound >= state.data.maxRounds;

  return {
    ...state,
    status: done ? "won" : "playing", // WYR always ends as "won" (social game)
    data: {
      ...state.data,
      currentRound: nextRound,
      votesA: 0,
      votesB: 0,
      voters: [],
      votingOpen: !done,
      roundResults: [...state.data.roundResults, roundResult],
    },
  };
}

/** Strip dilemmas and voters for client broadcast. */
export function toClientState(state: WyrGameState): WyrClientState {
  const d = state.data.dilemmas[state.data.currentRound];
  return {
    gameId: state.gameId,
    type: "wyr",
    status: state.status,
    data: {
      currentOptionA: d ? d.optionA : "",
      currentOptionB: d ? d.optionB : "",
      currentCategory: d ? d.category : "",
      currentRound: state.data.currentRound,
      maxRounds: state.data.maxRounds,
      votesA: state.data.votesA,
      votesB: state.data.votesB,
      votingOpen: state.data.votingOpen,
      roundResults: state.data.roundResults,
    },
  };
}
