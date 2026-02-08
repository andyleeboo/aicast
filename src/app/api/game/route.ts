import { NextRequest, NextResponse } from "next/server";
import {
  startGame,
  guess,
  endGame,
  getActiveGameClientState,
} from "@/lib/games/game-manager";

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
    return NextResponse.json({ correct: result.correct, state: result.state });
  }

  if (action === "stop") {
    endGame();
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
