"use client";

import type { HotColdClientData } from "@/lib/games/game-types";

interface HotColdBoardProps {
  data: HotColdClientData;
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

const WARMTH_EMOJI = ["🧊", "❄️", "🌤️", "🔥", "💥"];

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
          {WARMTH_EMOJI[warmth - 1]} {WARMTH_LABELS[warmth - 1]}
        </div>
      )}
    </div>
  );
}

export function HotColdBoard({ data, status }: HotColdBoardProps) {
  return (
    <div className="flex h-full flex-col gap-2 p-3">
      {/* Category badge */}
      <div className="text-center">
        <span className="inline-block rounded-full bg-orange-100 px-3 py-0.5 text-xs font-bold uppercase tracking-wider text-orange-700">
          {data.category}
        </span>
      </div>

      {/* Guess counter */}
      <div className="text-center text-xs font-medium text-gray-500">
        <span className="text-lg font-bold text-gray-700">{data.guessesUsed}</span>
        <span className="text-gray-400"> / {data.maxGuesses}</span>
        <span className="ml-1 text-gray-400">guesses</span>
      </div>

      {/* Temperature meter */}
      <TemperatureMeter warmth={data.warmth} />

      {/* Guess History */}
      <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5">
        {data.history.map((entry, i) => (
          <div key={i} className="rounded-lg bg-gray-50 px-2 py-1.5">
            <div className="flex items-center gap-1.5">
              <span className="shrink-0 text-[10px] font-bold text-gray-400">
                #{i + 1}
              </span>
              <span className="flex-1 text-xs text-gray-700 leading-tight">
                {entry.guess}
              </span>
              {entry.warmth > 0 ? (
                <div className="flex items-center gap-1">
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
                  {entry.isCorrect && (
                    <span className="text-[10px] font-bold text-green-600">✓</span>
                  )}
                </div>
              ) : (
                <span className="animate-pulse text-[10px] italic text-gray-400">...</span>
              )}
            </div>
          </div>
        ))}

        {data.history.length === 0 && status === "playing" && (
          <div className="py-4 text-center text-xs text-gray-400">
            Guess what Bob is thinking of!
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
          Game over — out of guesses!
        </div>
      )}
      {status === "playing" && (
        <div className="text-center text-[11px] text-gray-400">
          Type <span className="font-mono font-semibold">/guess &lt;word&gt;</span> in chat
        </div>
      )}
    </div>
  );
}
