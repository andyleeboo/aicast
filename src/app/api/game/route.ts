import { NextRequest, NextResponse } from "next/server";
import {
  startGame,
  guess,
  askQuestion,
  endGame,
  getActiveGame,
  getActiveGameClientState,
} from "@/lib/games/game-manager";
import { triggerGameReaction, triggerTwentyQQuestionReaction } from "@/lib/games/game-reactions";
import type { GameType } from "@/lib/games/game-types";

export async function GET() {
  const state = getActiveGameClientState();
  return NextResponse.json({ state });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { action, game, value } = body as {
    action: "start" | "guess" | "stop" | "ask" | "answer";
    game?: GameType;
    value?: string;
  };

  if (action === "start") {
    const result = startGame(game ?? "hangman");
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
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
    if (result.endedGame) {
      triggerGameReaction(result.endedGame).catch(console.error);
    }
    return NextResponse.json({ correct: result.correct, state: result.state });
  }

  if (action === "ask" || action === "answer") {
    if (!value) {
      return NextResponse.json({ error: "Missing question/answer value" }, { status: 400 });
    }
    const isGuess = action === "answer";
    const result = askQuestion(value, isGuess);
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    // Fire async — Gemini answers the question, resolves state via manager
    triggerTwentyQQuestionReaction(result.gameStateForReaction, value, isGuess).catch(console.error);
    return NextResponse.json({ received: true, state: result.state });
  }

  if (action === "stop") {
    const endedGame = endGame();
    if (endedGame) triggerGameReaction(endedGame).catch(console.error);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
