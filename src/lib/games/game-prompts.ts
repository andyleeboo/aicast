import type {
  GameState,
  HangmanGameState,
  TwentyQGameState,
  TriviaGameState,
  WyrGameState,
  HotColdGameState,
} from "./game-types";

export function buildGameSystemPrompt(state: GameState): string {
  if (state.type === "hangman") return buildHangmanPrompt(state);
  if (state.type === "twentyq") return buildTwentyQPrompt(state);
  if (state.type === "trivia") return buildTriviaPrompt(state);
  if (state.type === "wyr") return buildWyrPrompt(state);
  if (state.type === "hotcold") return buildHotColdPrompt(state);
  return "";
}

// ── Hangman prompts ─────────────────────────────────────────────────

function buildHangmanPrompt(state: HangmanGameState): string {
  const { data, status } = state;
  const revealed = data.maskedWord.join(" ");
  const wrong = data.guessedLetters.filter((l) => !data.word.includes(l));

  if (status === "won") {
    return `

GAME CONTEXT: Hangman just ended — CHAT WON! The word was "${data.word}" (category: ${data.category}).
Celebrate with the viewers! Be hype about their victory. Reference the word in a fun way.`;
  }

  if (status === "lost") {
    return `

GAME CONTEXT: Hangman just ended — CHAT LOST! The word was "${data.word}" (category: ${data.category}). They got ${data.wrongGuesses}/${data.maxWrong} wrong.
React with dramatic disappointment. Reveal the word and tease chat about missing it. Keep it fun, not mean.`;
  }

  return `

GAME CONTEXT: You're hosting a game of Hangman with chat!
- Category: ${data.category}
- Word (SECRET — do NOT say it): "${data.word}"
- Current board: ${revealed}
- Letters guessed: ${data.guessedLetters.join(", ") || "none yet"}
- Wrong guesses: ${wrong.join(", ") || "none"} (${data.wrongGuesses}/${data.maxWrong})

Rules for you:
- NEVER reveal the word directly — no spelling it out, no obvious hints
- React to guesses naturally ("nice one!" / "oof, not that one")
- You can give vague category-related hints if chat is struggling
- If they're close (1-2 letters left), build hype
- If they have 5+ wrong, add tension ("it's getting dicey, chat...")
- Keep hosting energy — encourage viewers to type /guess <letter>`;
}

// ── 20 Questions prompts ────────────────────────────────────────────

function buildTwentyQPrompt(state: TwentyQGameState): string {
  const { data, status } = state;
  const historyText = data.history
    .map((h, i) => {
      const prefix = h.isGuess ? "GUESS" : `Q${i + 1}`;
      const ans = h.answer ?? "PENDING...";
      return `  ${prefix}: "${h.question}" → ${ans} (warmth: ${h.warmth || "?"})`;
    })
    .join("\n");

  if (status === "won") {
    return `

GAME CONTEXT: 20 Questions just ended — CHAT WON! They guessed "${data.secret}" (${data.category}) in ${data.questionsAsked} questions!
Celebrate! Be amazed they got it. Reference the answer.`;
  }

  if (status === "lost") {
    return `

GAME CONTEXT: 20 Questions just ended — CHAT LOST! The answer was "${data.secret}" (${data.category}). They used all ${data.maxQuestions} questions.
React with dramatic reveal. Tease chat — they were so close (or so far)! Keep it fun.`;
  }

  return `

GAME CONTEXT: You're hosting 20 Questions with chat!
- Category: ${data.category}
- Secret (DO NOT SAY IT): "${data.secret}"
- Questions used: ${data.questionsAsked}/${data.maxQuestions}
- Current warmth: ${data.warmth}/5
${historyText ? `- History:\n${historyText}` : "- No questions yet"}

Rules for you:
- NEVER reveal the secret — no spelling it out, no obvious hints
- You answer questions via the game system (not directly in chat)
- Keep hosting energy — encourage viewers to type /ask <question>
- If warmth is 4-5, build hype ("you're getting HOT, chat!")
- If warmth is 1-2, tease ("ice cold, chat... ice cold")`;
}

/** Build the per-question prompt sent directly to Gemini for answering. */
export function buildTwentyQQuestionPrompt(
  state: TwentyQGameState,
  question: string,
  isGuess: boolean,
): string {
  const historyText = state.data.history
    .slice(0, -1) // exclude the pending question we're about to answer
    .map((h, i) => {
      const prefix = h.isGuess ? "GUESS" : `Q${i + 1}`;
      return `  ${prefix}: "${h.question}" → ${h.answer} (warmth: ${h.warmth})`;
    })
    .join("\n");

  if (isGuess) {
    return `You are hosting a 20 Questions game. The secret is "${state.data.secret}" (category: ${state.data.category}).

${historyText ? `Previous questions:\n${historyText}\n` : ""}The viewer is making a GUESS: "${question}"

Determine if this guess is correct. Be generous with fuzzy matching — "Einstein" matches "Albert Einstein", "Eiffel Tower" matches "the eiffel tower", etc.

Respond in EXACTLY this format (3 lines, no extra text):
CORRECT: yes or no
WARMTH: 1-5 (how close the guess is — 5 if correct)
RESPONSE: Your 1-2 sentence reaction as Bob the streamer. If correct, celebrate wildly! If wrong, react dramatically and hint at how far off they are.`;
  }

  return `You are hosting a 20 Questions game. The secret is "${state.data.secret}" (category: ${state.data.category}).

${historyText ? `Previous questions:\n${historyText}\n` : ""}Question ${state.data.questionsAsked}/${state.data.maxQuestions}: "${question}"

Respond in EXACTLY this format (3 lines, no extra text):
ANSWER: YES, NO, or KINDA (use KINDA only when truly ambiguous)
WARMTH: 1-5 (1=freezing/totally off track, 2=cold, 3=warm, 4=hot/getting close, 5=on fire/almost there)
RESPONSE: Your 1-2 sentence reaction as Bob the streamer. Be dramatic! React to the warmth level — build tension for hot questions, tease for cold ones.`;
}

// ── Trivia prompts ──────────────────────────────────────────────────

function buildTriviaPrompt(state: TriviaGameState): string {
  const { data, status } = state;

  if (status === "won") {
    return `

GAME CONTEXT: Trivia Quiz just ended — CHAT WON! Score: ${data.score}/${data.maxRounds}!
Celebrate! Be hype about their knowledge. 1-2 sentences max.`;
  }

  if (status === "lost") {
    return `

GAME CONTEXT: Trivia Quiz just ended — CHAT LOST! Score: ${data.score}/${data.maxRounds}, ${data.wrongAnswers} wrong answers (max ${data.maxWrong}).
React with dramatic disappointment. 3 strikes and you're out! Keep it fun.`;
  }

  const q = data.questions[data.currentRound];
  return `

GAME CONTEXT: You're hosting a Trivia Quiz with chat!
- Round: ${data.currentRound + 1}/${data.maxRounds}
- Score: ${data.score} correct, ${data.wrongAnswers}/${data.maxWrong} wrong
- Current question (${q?.category}): "${q?.question}"
- Answer (SECRET — do NOT say it): "${q?.answer}"

Rules for you:
- NEVER reveal the answer — no spelling it out, no obvious hints
- React to answers via the game system (not directly in chat)
- Keep quiz show energy — encourage viewers to type /answer <answer>
- If they're on a streak, build hype
- If they have 2 wrong, add tension ("one more strike and it's over, chat!")`;
}

/** Build the judging prompt for a trivia answer. */
export function buildTriviaJudgePrompt(
  state: TriviaGameState,
  viewerAnswer: string,
): string {
  const q = state.data.questions[state.data.currentRound];
  return `You are hosting a Trivia Quiz. The question is: "${q.question}"
The correct answer is: "${q.answer}"
The viewer answered: "${viewerAnswer}"

Determine if the viewer's answer is correct. Be generous with fuzzy matching:
- "MLK" matches "Martin Luther King Jr"
- "206" matches "206 bones"
- Abbreviations, minor spelling errors, and partial matches should count as correct
- The answer must be semantically correct, not just a keyword match

Respond in EXACTLY this format (2 lines, no extra text):
CORRECT: yes or no
RESPONSE: Your 1-2 sentence reaction as Bob the streamer. If correct, celebrate! If wrong, dramatic disappointment — reveal the right answer.`;
}

// ── Would You Rather prompts ────────────────────────────────────────

function buildWyrPrompt(state: WyrGameState): string {
  const { data, status } = state;

  if (status === "won") {
    return `

GAME CONTEXT: Would You Rather just ended — great game! ${data.roundResults.length} rounds played.
Wrap up with energy! Comment on chat's choices. 1-2 sentences max.`;
  }

  const d = data.dilemmas[data.currentRound];
  return `

GAME CONTEXT: You're hosting Would You Rather with chat!
- Round: ${data.currentRound + 1}/${data.maxRounds}
- Current dilemma: A) "${d?.optionA}" vs B) "${d?.optionB}" (${d?.category})
- Votes: A=${data.votesA}, B=${data.votesB}
- Voting: ${data.votingOpen ? "OPEN" : "CLOSED"}

Rules for you:
- Present dilemmas with enthusiasm
- Comment on vote tallies ("Whoa, it's close!" or "Landslide for B!")
- When voting closes, share your own pick with a fun reason
- Keep hosting energy — encourage viewers to type /vote a or /vote b`;
}

/** Build the reaction prompt when a WYR round closes. */
export function buildWyrReactionPrompt(state: WyrGameState): string {
  const d = state.data.dilemmas[state.data.currentRound];
  return `You are hosting a Would You Rather game. The current dilemma is:
A) "${d.optionA}"
B) "${d.optionB}"
Category: ${d.category}

Chat voted: A=${state.data.votesA}, B=${state.data.votesB}

Share your own pick and give an entertaining reason. React to what chat chose.

Respond in EXACTLY this format (3 lines, no extra text):
PICK: A or B
REASON: 1-2 sentence entertaining explanation of your pick
RESPONSE: 1-2 sentence reaction addressing the vote results and what chat chose`;
}

// ── Hot or Cold prompts ─────────────────────────────────────────────

function buildHotColdPrompt(state: HotColdGameState): string {
  const { data, status } = state;
  const historyText = data.history
    .map((h, i) => {
      const w = h.warmth === 0 ? "PENDING" : `${h.warmth}/5`;
      return `  #${i + 1}: "${h.guess}" → warmth: ${w}${h.isCorrect ? " ✓ CORRECT" : ""}`;
    })
    .join("\n");

  if (status === "won") {
    return `

GAME CONTEXT: Hot or Cold just ended — CHAT WON! They guessed "${data.secret}" (${data.category}) in ${data.guessesUsed} guesses!
Celebrate! Be amazed they got it.`;
  }

  if (status === "lost") {
    return `

GAME CONTEXT: Hot or Cold just ended — CHAT LOST! The answer was "${data.secret}" (${data.category}). They used all ${data.maxGuesses} guesses.
React with dramatic reveal. Tease chat! Keep it fun.`;
  }

  return `

GAME CONTEXT: You're hosting Hot or Cold with chat!
- Category: ${data.category}
- Secret (DO NOT SAY IT): "${data.secret}"
- Guesses used: ${data.guessesUsed}/${data.maxGuesses}
- Current warmth: ${data.warmth}/5
${historyText ? `- History:\n${historyText}` : "- No guesses yet"}

Rules for you:
- NEVER reveal the secret — no spelling it out, no obvious hints
- You judge guesses via the game system (not directly in chat)
- Keep hosting energy — encourage viewers to type /guess <word>
- React to warmth levels dramatically`;
}

/** Build the judging prompt for a Hot or Cold guess. */
export function buildHotColdJudgePrompt(
  state: HotColdGameState,
  guess: string,
): string {
  const historyText = state.data.history
    .slice(0, -1)
    .map((h, i) => `  #${i + 1}: "${h.guess}" → warmth: ${h.warmth}`)
    .join("\n");

  return `You are hosting a Hot or Cold game. The secret thing is "${state.data.secret}" (category: ${state.data.category}).

${historyText ? `Previous guesses:\n${historyText}\n` : ""}Guess ${state.data.guessesUsed}/${state.data.maxGuesses}: "${guess}"

Determine if this guess is correct. Be generous with fuzzy matching — "mic" matches "Microphone", "b-ball" matches "Basketball", etc.

Then rate the warmth (how conceptually close the guess is to the secret):
1 = Freezing (completely unrelated)
2 = Cold (same broad category maybe)
3 = Warm (getting closer, related concept)
4 = Hot (very close, similar thing)
5 = On Fire (essentially correct or a synonym)

Respond in EXACTLY this format (3 lines, no extra text):
CORRECT: yes or no
WARMTH: 1-5
RESPONSE: Your 1-2 sentence reaction as Bob the streamer. Match the temperature — freezing=tease, warm=encourage, hot=build hype!`;
}
