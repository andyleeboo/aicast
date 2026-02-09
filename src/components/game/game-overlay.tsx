"use client";

import type { GameClientState } from "@/lib/games/game-types";
import { HangmanBoard } from "./hangman-board";
import { TwentyQBoard } from "./twentyq-board";

interface GameOverlayProps {
  gameState: GameClientState;
}

const GAME_LABELS: Record<string, string> = {
  hangman: "Hangman",
  twentyq: "20 Questions",
};

export function GameOverlay({ gameState }: GameOverlayProps) {
  return (
    <div className="absolute z-20 flex animate-in fade-in duration-300 max-lg:inset-2 max-lg:slide-in-from-bottom-4 lg:right-4 lg:top-4 lg:bottom-4 lg:w-[45%] lg:max-w-[280px] lg:slide-in-from-right-4">
      <div className="flex w-full flex-col overflow-hidden rounded-2xl bg-white/95 shadow-xl ring-1 ring-black/5 backdrop-blur-sm">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-2.5 py-1.5 lg:px-3 lg:py-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 lg:text-xs">
            {GAME_LABELS[gameState.type] ?? "Game"}
          </span>
          {gameState.status === "playing" && (
            <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-700">
              LIVE
            </span>
          )}
        </div>

        {/* Game board */}
        <div className="flex-1 min-h-0">
          {gameState.type === "hangman" && (
            <HangmanBoard data={gameState.data} status={gameState.status} />
          )}
          {gameState.type === "twentyq" && (
            <TwentyQBoard data={gameState.data} status={gameState.status} />
          )}
        </div>
      </div>
    </div>
  );
}
