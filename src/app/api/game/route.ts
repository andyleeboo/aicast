import { NextRequest, NextResponse } from "next/server";
import {
  startGame,
  guess,
  askQuestion,
  endGame,
  getActiveGame,
  getActiveGameClientState,
  submitTriviaAnswer,
  voteWyr,
  closeWyrVoting,
  submitHotColdGuess,
} from "@/lib/games/game-manager";
import {
  triggerGameReaction,
  triggerTwentyQQuestionReaction,
  triggerTriviaReaction,
  triggerWyrReaction,
  triggerHotColdReaction,
} from "@/lib/games/game-reactions";
import type { GameType } from "@/lib/games/game-types";

export async function GET() {
  const state = getActiveGameClientState();
  return NextResponse.json({ state });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { action, game, value, voter } = body as {
    action: "start" | "guess" | "stop" | "ask" | "answer" | "vote" | "next";
    game?: GameType;
    value?: string;
    voter?: string;
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

    // Smart dispatch: /guess routes to Hangman or Hot or Cold
    const active = getActiveGame();
    if (active?.type === "hotcold") {
      const result = submitHotColdGuess(value);
      if ("error" in result) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      triggerHotColdReaction(result.gameStateForReaction, value).catch(console.error);
      return NextResponse.json({ received: true, state: result.state });
    }

    // Default: Hangman
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

    // Smart dispatch: /answer routes to 20Q or Trivia
    const active = getActiveGame();
    if (action === "answer" && active?.type === "trivia") {
      const result = submitTriviaAnswer(value);
      if ("error" in result) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      triggerTriviaReaction(result.gameStateForReaction, value).catch(console.error);
      return NextResponse.json({ received: true, state: result.state });
    }

    // Default: 20Q
    const isGuess = action === "answer";
    const result = askQuestion(value, isGuess);
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    // Fire async — Gemini answers the question, resolves state via manager
    triggerTwentyQQuestionReaction(result.gameStateForReaction, value, isGuess).catch(console.error);
    return NextResponse.json({ received: true, state: result.state });
  }

  if (action === "vote") {
    if (!value || (value !== "a" && value !== "b")) {
      return NextResponse.json({ error: "Vote must be 'a' or 'b'" }, { status: 400 });
    }
    const result = voteWyr(value, voter ?? "anon");
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ alreadyVoted: result.alreadyVoted, state: result.state });
  }

  if (action === "next") {
    const result = closeWyrVoting();
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    triggerWyrReaction(result.gameStateForReaction).catch(console.error);
    return NextResponse.json({ received: true, state: result.state });
  }

  if (action === "stop") {
    const endedGame = endGame();
    if (endedGame) triggerGameReaction(endedGame).catch(console.error);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
