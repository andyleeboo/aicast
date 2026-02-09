"use client";

import type { TriviaClientData } from "@/lib/games/game-types";

interface TriviaBoardProps {
  data: TriviaClientData;
  status: "playing" | "won" | "lost";
}

export function TriviaBoard({ data, status }: TriviaBoardProps) {
  return (
    <div className="flex h-full flex-col gap-2 p-3">
      {/* Category badge */}
      <div className="text-center">
        <span className="inline-block rounded-full bg-indigo-100 px-3 py-0.5 text-xs font-bold uppercase tracking-wider text-indigo-700">
          {data.currentCategory || "Trivia"}
        </span>
      </div>

      {/* Round counter */}
      <div className="text-center text-xs font-medium text-gray-500">
        <span className="text-lg font-bold text-gray-700">
          {Math.min(data.currentRound + 1, data.maxRounds)}
        </span>
        <span className="text-gray-400"> / {data.maxRounds}</span>
        <span className="ml-1 text-gray-400">rounds</span>
      </div>

      {/* Score bar */}
      <div className="flex items-center justify-center gap-3 text-xs">
        <span className="font-semibold text-green-600">
          ✓ {data.score}
        </span>
        <span className="text-gray-300">|</span>
        <span className="font-semibold text-red-500">
          ✗ {data.wrongAnswers}/{data.maxWrong}
        </span>
      </div>

      {/* Current question */}
      {status === "playing" && data.currentQuestion && (
        <div className="rounded-xl bg-indigo-50 px-3 py-2.5">
          <p className="text-center text-sm font-medium leading-snug text-gray-800">
            {data.currentQuestion}
          </p>
          {data.pendingAnswer && (
            <p className="mt-1.5 animate-pulse text-center text-[10px] italic text-gray-400">
              Bob is judging...
            </p>
          )}
        </div>
      )}

      {/* Round results history */}
      <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5">
        {data.roundResults.map((result, i) => (
          <div
            key={i}
            className={`rounded-lg px-2 py-1.5 ${
              result.correct ? "bg-green-50" : "bg-red-50"
            }`}
          >
            <div className="flex items-start gap-1.5">
              <span className={`shrink-0 text-[10px] font-bold ${
                result.correct ? "text-green-500" : "text-red-400"
              }`}>
                {result.correct ? "✓" : "✗"}
              </span>
              <div className="min-w-0">
                <p className="text-[11px] leading-tight text-gray-600 truncate">
                  {result.question}
                </p>
                <div className="mt-0.5 flex items-center gap-1.5 text-[10px]">
                  {result.viewerAnswer && (
                    <span className={result.correct ? "text-green-600" : "text-red-500 line-through"}>
                      {result.viewerAnswer}
                    </span>
                  )}
                  {!result.correct && (
                    <span className="font-medium text-green-600">
                      → {result.correctAnswer}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Status */}
      {status === "won" && (
        <div className="text-center text-sm font-bold text-green-600">
          Chat wins — {data.score}/{data.maxRounds}!
        </div>
      )}
      {status === "lost" && (
        <div className="text-center text-sm font-bold text-red-500">
          3 strikes — game over!
        </div>
      )}
      {status === "playing" && !data.pendingAnswer && (
        <div className="text-center text-[11px] text-gray-400">
          Type <span className="font-mono font-semibold">/answer &lt;answer&gt;</span> in chat
        </div>
      )}
    </div>
  );
}
