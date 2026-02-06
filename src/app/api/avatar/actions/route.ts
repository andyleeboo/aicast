import { NextRequest, NextResponse } from "next/server";
import { AVATAR_ACTIONS, resolveAction } from "@/lib/avatar-actions";
import { emitAction } from "@/lib/action-bus";

export async function GET() {
  return NextResponse.json({
    actions: AVATAR_ACTIONS,
  });
}

export async function POST(req: NextRequest) {
  const { actionId } = (await req.json()) as { actionId?: string };

  if (!actionId) {
    return NextResponse.json(
      { ok: false, error: "actionId is required" },
      { status: 400 },
    );
  }

  const action = AVATAR_ACTIONS.find((a) => a.id === actionId);
  if (!action) {
    return NextResponse.json(
      { ok: false, error: `Unknown action: ${actionId}` },
      { status: 400 },
    );
  }

  const resolved = resolveAction(actionId);
  if (!resolved.gesture && !resolved.emote) {
    return NextResponse.json(
      { ok: false, error: "Could not resolve action" },
      { status: 500 },
    );
  }

  emitAction({ type: action.type, id: actionId });

  return NextResponse.json({ ok: true, actionId });
}
