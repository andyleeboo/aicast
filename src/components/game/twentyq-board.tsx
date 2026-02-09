"use client";

import type { TwentyQClientData } from "@/lib/games/game-types";

interface TwentyQBoardProps {
  data: TwentyQClientData;
  status: "playing" | "won" | "lost";
}

const WARMTH_COLORS = [
  "bg-blue-500",    // 1 — Freezing
  "bg-cyan-400",    // 2 — Cold
  "bg-yellow-400",  // 3 — Warm
  "bg-orange-500",  // 4 — Hot
  "bg-red-500",     // 5 — On Fire
];

const WARMTH_LABELS = ["Freezing", "Cold", "Warm", "Hot", "On Fire"];

const ANSWER_STYLES: Record<string, string> = {
  YES: "bg-green-100 text-green-700",
  NO: "bg-red-100 text-red-600",
  KINDA: "bg-yellow-100 text-yellow-700",
};

function TemperatureMeter({ warmth }: { warmth: number }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[9px] font-medium text-gray-400">
        <span>Freezing</span>
        <span>On Fire</span>
      </div>
      <div className="flex gap-0.5">
        {WARMTH_COLORS.map((color, i) => (
          <div
            key={i}
            className={`h-2 flex-1 rounded-sm transition-opacity duration-300 ${color} ${
              i < warmth ? "opacity-100" : "opacity-20"
            }`}
          />
        ))}
      </div>
      {warmth > 0 && (
        <div className="text-center text-[10px] font-semibold text-gray-500">
          {WARMTH_LABELS[warmth - 1]}
        </div>
      )}
    </div>
  );
}

export function TwentyQBoard({ data, status }: TwentyQBoardProps) {
  return (
    <div className="flex h-full flex-col gap-1.5 p-2 lg:gap-2 lg:p-3">
      {/* Category badge */}
      <div className="text-center">
        <span className="inline-block rounded-full bg-purple-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-purple-700 lg:px-3 lg:text-xs">
          {data.category}
        </span>
      </div>

      {/* Question counter */}
      <div className="text-center text-[10px] font-medium text-gray-500 lg:text-xs">
        <span className="text-base font-bold text-gray-700 lg:text-lg">{data.questionsAsked}</span>
        <span className="text-gray-400"> / {data.maxQuestions}</span>
        <span className="ml-1 text-gray-400">questions</span>
      </div>

      {/* Temperature meter */}
      <TemperatureMeter warmth={data.warmth} />

      {/* Q&A History */}
      <div className="flex-1 min-h-0 overflow-y-auto space-y-1 lg:space-y-1.5">
        {data.history.map((entry, i) => (
          <div key={i} className="rounded-lg bg-gray-50 px-1.5 py-1 lg:px-2 lg:py-1.5">
            <div className="flex items-start gap-1.5">
              <span className="shrink-0 text-[10px] font-bold text-gray-400">
                {entry.isGuess ? "G" : `Q${i + 1}`}
              </span>
              <span className="text-xs text-gray-700 leading-tight">
                {entry.question}
              </span>
            </div>
            {entry.answer !== null ? (
              <div className="mt-1 flex items-center gap-1.5">
                <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${ANSWER_STYLES[entry.answer] ?? "bg-gray-100 text-gray-600"}`}>
                  {entry.answer}
                </span>
                {/* Warmth dots */}
                <div className="flex gap-0.5">
                  {Array.from({ length: 5 }, (_, j) => (
                    <div
                      key={j}
                      className={`h-1.5 w-1.5 rounded-full ${
                        j < entry.warmth
                          ? WARMTH_COLORS[entry.warmth - 1]
                          : "bg-gray-200"
                      }`}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <div className="mt-1 animate-pulse text-[10px] italic text-gray-400">
                Bob is thinking...
              </div>
            )}
          </div>
        ))}

        {data.history.length === 0 && status === "playing" && (
          <div className="py-4 text-center text-xs text-gray-400">
            Ask Bob a yes/no question!
          </div>
        )}
      </div>

      {/* Status */}
      {status === "won" && (
        <div className="text-center text-sm font-bold text-green-600">
          Chat got it!
        </div>
      )}
      {status === "lost" && (
        <div className="text-center text-sm font-bold text-red-500">
          Game over — 20 questions used!
        </div>
      )}
      {status === "playing" && (
        <div className="text-center text-[10px] text-gray-400 lg:text-[11px]">
          Type <span className="font-mono font-semibold">/ask</span> or{" "}
          <span className="font-mono font-semibold">/answer</span> in chat
        </div>
      )}
    </div>
  );
}
