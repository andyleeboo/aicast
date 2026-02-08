"use client";

import type { GameClientState } from "@/lib/games/game-types";
import { HangmanBoard } from "./hangman-board";

interface GameOverlayProps {
  gameState: GameClientState;
}

export function GameOverlay({ gameState }: GameOverlayProps) {
  return (
    <div className="absolute right-4 top-4 bottom-4 z-20 flex w-[45%] max-w-[280px] animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="flex w-full flex-col overflow-hidden rounded-2xl bg-white/95 shadow-xl backdrop-blur-sm">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-3 py-2">
          <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
            {gameState.type === "hangman" ? "Hangman" : "Game"}
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
        </div>
      </div>
    </div>
  );
}
