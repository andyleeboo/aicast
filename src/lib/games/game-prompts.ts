import type { GameState } from "./game-types";

export function buildGameSystemPrompt(state: GameState): string {
  if (state.type === "hangman") {
    return buildHangmanPrompt(state);
  }
  return "";
}

function buildHangmanPrompt(state: GameState): string {
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
