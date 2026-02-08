"use client";

import type { HangmanClientData } from "@/lib/games/game-types";

interface HangmanBoardProps {
  data: HangmanClientData;
  status: "playing" | "won" | "lost";
}

/** SVG stick figure parts — drawn progressively as wrongGuesses increases */
function Gallows({ wrongGuesses }: { wrongGuesses: number }) {
  const stroke = "#374151"; // gray-700
  const bodyStroke = "#1f2937"; // gray-800
  const sw = 3; // stroke width for structure
  const bw = 2.5; // stroke width for body

  return (
    <svg viewBox="0 0 200 200" className="mx-auto h-full w-full max-h-[140px] max-w-[140px]">
      {/* Gallows structure */}
      <line x1="40" y1="180" x2="160" y2="180" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
      <line x1="60" y1="180" x2="60" y2="30" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
      <line x1="60" y1="30" x2="120" y2="30" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
      <line x1="120" y1="30" x2="120" y2="50" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />

      {/* Head */}
      {wrongGuesses >= 1 && (
        <circle cx="120" cy="62" r="12" fill="none" stroke={bodyStroke} strokeWidth={bw} />
      )}
      {/* Body */}
      {wrongGuesses >= 2 && (
        <line x1="120" y1="74" x2="120" y2="120" stroke={bodyStroke} strokeWidth={bw} strokeLinecap="round" />
      )}
      {/* Left arm */}
      {wrongGuesses >= 3 && (
        <line x1="120" y1="88" x2="100" y2="105" stroke={bodyStroke} strokeWidth={bw} strokeLinecap="round" />
      )}
      {/* Right arm */}
      {wrongGuesses >= 4 && (
        <line x1="120" y1="88" x2="140" y2="105" stroke={bodyStroke} strokeWidth={bw} strokeLinecap="round" />
      )}
      {/* Left leg */}
      {wrongGuesses >= 5 && (
        <line x1="120" y1="120" x2="100" y2="150" stroke={bodyStroke} strokeWidth={bw} strokeLinecap="round" />
      )}
      {/* Right leg */}
      {wrongGuesses >= 6 && (
        <line x1="120" y1="120" x2="140" y2="150" stroke={bodyStroke} strokeWidth={bw} strokeLinecap="round" />
      )}
    </svg>
  );
}

export function HangmanBoard({ data, status }: HangmanBoardProps) {
  const wrongLetters = data.guessedLetters.filter(
    (l) => !data.maskedWord.includes(l),
  );
  const correctLetters = data.guessedLetters.filter(
    (l) => data.maskedWord.includes(l),
  );

  return (
    <div className="flex h-full flex-col gap-2 p-3">
      {/* Category hint */}
      <div className="text-center text-xs font-medium uppercase tracking-wider text-gray-400">
        {data.category}
      </div>

      {/* Gallows */}
      <div className="flex-1 flex items-center justify-center min-h-0">
        <Gallows wrongGuesses={data.wrongGuesses} />
      </div>

      {/* Word display */}
      <div className="flex flex-wrap items-center justify-center gap-1.5">
        {data.maskedWord.map((ch, i) => (
          <span
            key={i}
            className={`inline-flex h-8 w-6 items-center justify-center border-b-2 text-base font-bold ${
              ch === "_"
                ? "border-gray-400 text-transparent"
                : status === "won"
                  ? "border-green-500 text-green-700"
                  : status === "lost"
                    ? "border-red-400 text-red-600"
                    : "border-gray-700 text-gray-800"
            }`}
          >
            {ch === "_" ? "\u00A0" : ch.toUpperCase()}
          </span>
        ))}
      </div>

      {/* Guessed letters */}
      <div className="mt-1 flex flex-wrap items-center justify-center gap-1">
        {correctLetters.map((l) => (
          <span key={l} className="rounded bg-green-100 px-1.5 py-0.5 text-xs font-semibold text-green-700">
            {l.toUpperCase()}
          </span>
        ))}
        {wrongLetters.map((l) => (
          <span key={l} className="rounded bg-red-100 px-1.5 py-0.5 text-xs font-semibold text-red-500 line-through">
            {l.toUpperCase()}
          </span>
        ))}
      </div>

      {/* Status */}
      {status === "won" && (
        <div className="text-center text-sm font-bold text-green-600">Chat wins!</div>
      )}
      {status === "lost" && (
        <div className="text-center text-sm font-bold text-red-500">Game over!</div>
      )}
      {status === "playing" && (
        <div className="text-center text-[11px] text-gray-400">
          Type <span className="font-mono font-semibold">/guess &lt;letter&gt;</span> in chat
        </div>
      )}
    </div>
  );
}
