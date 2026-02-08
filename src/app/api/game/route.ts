import { NextRequest, NextResponse } from "next/server";
import {
  startGame,
  guess,
  endGame,
  getActiveGame,
  getActiveGameClientState,
} from "@/lib/games/game-manager";
import { triggerGameReaction } from "@/lib/games/game-reactions";

export async function GET() {
  const state = getActiveGameClientState();
  return NextResponse.json({ state });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { action, game, value } = body as {
    action: "start" | "guess" | "stop";
    game?: "hangman";
    value?: string;
  };

  if (action === "start") {
    const result = startGame(game ?? "hangman");
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    // Bob announces the new game
    const gameState = getActiveGame();
    if (gameState) triggerGameReaction(gameState).catch(console.error);
    return NextResponse.json({ state: result });
  }

  if (action === "guess") {
    if (!value) {
      return NextResponse.json({ error: "Missing guess value" }, { status: 400 });
    }
    const result = guess(value);
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    // Bob reacts to win/loss
    if (result.state.status !== "playing") {
      const gameState = getActiveGame();
      if (gameState) triggerGameReaction(gameState).catch(console.error);
    }
    return NextResponse.json({ correct: result.correct, state: result.state });
  }

  if (action === "stop") {
    const gameState = getActiveGame();
    endGame();
    // Bob reacts to forced end
    if (gameState) triggerGameReaction({ ...gameState, status: "lost" }).catch(console.error);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
