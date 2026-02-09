import { NextRequest } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { subscribe, touchViewer, removeViewer, type ActionEvent } from "@/lib/action-bus";
import "@/lib/idle-behavior"; // Start idle expressions
import "@/lib/proactive-speech"; // Start proactive monologues
import { setActiveChannel } from "@/lib/proactive-speech";
import { checkForNewMessages } from "@/lib/chat-poller";
import { isShutdown } from "@/lib/service-config";
import { getChannel } from "@/lib/mock-data";
import { maybeGreetViewer } from "@/lib/viewer-greeting";

export const dynamic = "force-dynamic";

// Vercel Pro allows up to 300s; keep this at 60s so the client
// reconnect cycle is tight and we don't burn compute idling.
export const maxDuration = 60;

// Close the stream a few seconds before maxDuration so we can
// flush Sentry events and send a clean "reconnect" hint to the client.
const GRACEFUL_CLOSE_MS = (maxDuration - 5) * 1000; // 55s

// Chat poll + keepalive combined interval
const POLL_MS = 1_500;

export async function GET(req: NextRequest) {
  const channelId = req.nextUrl.searchParams.get("channel") ?? "late-night-ai";

  // Validate channel exists before opening SSE
  if (!getChannel(channelId)) {
    return new Response(
      JSON.stringify({ error: `Unknown channel: ${channelId}` }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  setActiveChannel(channelId);
  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | undefined;
  let pollTimer: ReturnType<typeof setInterval> | undefined;
  let gracefulTimeout: ReturnType<typeof setTimeout> | undefined;
  let greetTimeout: ReturnType<typeof setTimeout> | undefined;
  const viewerId = crypto.randomUUID();

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: ActionEvent) => {
        // Filter: only forward events for this channel (or channel-agnostic events like maintenance)
        if (event.channelId && event.channelId !== channelId) return;
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(event)}\n\n`),
          );
        } catch (err) {
          console.error("[sse] Failed to send event:", err);
          Sentry.captureException(err, { tags: { route: "avatar-events", phase: "send" } });
          cleanup();
        }
      };

      // Send initial keepalive
      controller.enqueue(encoder.encode(": connected\n\n"));

      // Send maintenance status on connect
      isShutdown().then((shutdown) => {
        if (shutdown) {
          try {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: "maintenance-mode", id: "system", active: true })}\n\n`,
              ),
            );
          } catch (err) {
            console.error("[sse] Failed to send maintenance status:", err);
            cleanup();
          }
        }
      }).catch((err) => {
        console.error("[sse] Failed to check shutdown status:", err);
      });

      // Register this viewer
      touchViewer(viewerId);

      unsubscribe = subscribe(send);

      // Combined poll + keepalive every 3s:
      // - Check Supabase for new chat messages
      // - Send keepalive comment to prevent Vercel timeout
      // - Refresh viewer presence
      let tickCount = 0;
      pollTimer = setInterval(async () => {
        tickCount++;
        try {
          // Keepalive on every tick
          controller.enqueue(encoder.encode(": keepalive\n\n"));
          touchViewer(viewerId);

          // Check for new chat messages
          await checkForNewMessages(channelId);

          // Broadcast maintenance status every 5th tick (~15s)
          if (tickCount % 5 === 0) {
            const shutdown = await isShutdown();
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: "maintenance-mode", id: "system", active: shutdown })}\n\n`,
              ),
            );
          }
        } catch (err) {
          console.error("[sse] Poll/keepalive failed:", err);
          Sentry.captureException(err, { tags: { route: "avatar-events", phase: "poll" } });
          cleanup();
        }
      }, POLL_MS);

      // Greet the viewer after a short delay so the client has time to
      // establish the SSE connection and render the avatar.
      greetTimeout = setTimeout(() => {
        maybeGreetViewer(channelId);
      }, 3_000);

      // Graceful self-close before Vercel kills us.
      gracefulTimeout = setTimeout(() => {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "reconnect", id: "system" })}\n\n`),
          );
          controller.close();
        } catch {
          // Stream already closed, that's fine
        }
        cleanup();
      }, GRACEFUL_CLOSE_MS);
    },
    cancel() {
      cleanup();
    },
  });

  function cleanup() {
    unsubscribe?.();
    if (pollTimer) clearInterval(pollTimer);
    if (gracefulTimeout) clearTimeout(gracefulTimeout);
    if (greetTimeout) clearTimeout(greetTimeout);
    removeViewer(viewerId);
    unsubscribe = undefined;
    pollTimer = undefined;
    gracefulTimeout = undefined;
    greetTimeout = undefined;
  }

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
