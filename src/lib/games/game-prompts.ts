import type { GameState, HangmanGameState, TwentyQGameState } from "./game-types";

export function buildGameSystemPrompt(state: GameState): string {
  if (state.type === "hangman") return buildHangmanPrompt(state);
  if (state.type === "twentyq") return buildTwentyQPrompt(state);
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
