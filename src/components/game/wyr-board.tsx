"use client";

import type { WyrClientData } from "@/lib/games/game-types";

interface WyrBoardProps {
  data: WyrClientData;
  status: "playing" | "won" | "lost";
}

function VoteBar({ votesA, votesB }: { votesA: number; votesB: number }) {
  const total = votesA + votesB;
  if (total === 0) {
    return (
      <div className="flex gap-0.5">
        <div className="h-2 flex-1 rounded-l-full bg-blue-200 opacity-40" />
        <div className="h-2 flex-1 rounded-r-full bg-pink-200 opacity-40" />
      </div>
    );
  }
  const pctA = Math.round((votesA / total) * 100);
  const pctB = 100 - pctA;
  return (
    <div className="space-y-0.5">
      <div className="flex gap-0.5">
        <div
          className="h-2 rounded-l-full bg-blue-500 transition-all duration-500"
          style={{ width: `${pctA}%` }}
        />
        <div
          className="h-2 rounded-r-full bg-pink-500 transition-all duration-500"
          style={{ width: `${pctB}%` }}
        />
      </div>
      <div className="flex justify-between text-[9px] font-medium text-gray-400">
        <span>{pctA}%</span>
        <span>{pctB}%</span>
      </div>
    </div>
  );
}

export function WyrBoard({ data, status }: WyrBoardProps) {
  const totalVotes = data.votesA + data.votesB;

  return (
    <div className="flex h-full flex-col gap-2 p-3">
      {/* Category badge */}
      <div className="text-center">
        <span className="inline-block rounded-full bg-pink-100 px-3 py-0.5 text-xs font-bold uppercase tracking-wider text-pink-700">
          {data.currentCategory || "Would You Rather"}
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

      {/* Current dilemma */}
      {status === "playing" && data.currentOptionA && (
        <div className="space-y-1.5">
          {/* Option A */}
          <div className="rounded-xl bg-blue-50 px-3 py-2 border-l-3 border-blue-500">
            <div className="flex items-start gap-1.5">
              <span className="shrink-0 text-xs font-bold text-blue-600">A</span>
              <p className="text-xs font-medium leading-snug text-gray-800">
                {data.currentOptionA}
              </p>
            </div>
          </div>

          <div className="text-center text-[10px] font-bold uppercase tracking-wider text-gray-300">
            or
          </div>

          {/* Option B */}
          <div className="rounded-xl bg-pink-50 px-3 py-2 border-l-3 border-pink-500">
            <div className="flex items-start gap-1.5">
              <span className="shrink-0 text-xs font-bold text-pink-600">B</span>
              <p className="text-xs font-medium leading-snug text-gray-800">
                {data.currentOptionB}
              </p>
            </div>
          </div>

          {/* Vote bar */}
          <VoteBar votesA={data.votesA} votesB={data.votesB} />

          {/* Vote count + status */}
          <div className="flex items-center justify-between text-[10px] text-gray-400">
            <span>{totalVotes} vote{totalVotes !== 1 ? "s" : ""}</span>
            {data.votingOpen ? (
              <span className="rounded-full bg-green-100 px-2 py-0.5 text-[9px] font-semibold text-green-700">
                VOTING OPEN
              </span>
            ) : (
              <span className="animate-pulse italic">Bob is deciding...</span>
            )}
          </div>
        </div>
      )}

      {/* Past round results */}
      <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5">
        {data.roundResults.map((result, i) => (
          <div key={i} className="rounded-lg bg-gray-50 px-2 py-1.5">
            <div className="flex items-center gap-1.5 text-[10px]">
              <span className="shrink-0 font-bold text-gray-400">R{i + 1}</span>
              <span className="text-blue-600">{result.votesA}</span>
              <span className="text-gray-300">vs</span>
              <span className="text-pink-600">{result.votesB}</span>
              {result.bobsPick && (
                <span className="ml-auto text-gray-500">
                  Bob: <span className={result.bobsPick === "A" ? "font-bold text-blue-600" : "font-bold text-pink-600"}>
                    {result.bobsPick}
                  </span>
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Status */}
      {status === "won" && (
        <div className="text-center text-sm font-bold text-green-600">
          Great game, chat!
        </div>
      )}
      {status === "playing" && data.votingOpen && (
        <div className="text-center text-[11px] text-gray-400">
          Type <span className="font-mono font-semibold">/vote a</span> or{" "}
          <span className="font-mono font-semibold">/vote b</span> — then{" "}
          <span className="font-mono font-semibold">/next</span>
        </div>
      )}
    </div>
  );
}
