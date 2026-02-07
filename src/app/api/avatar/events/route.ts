import * as Sentry from "@sentry/nextjs";
import { subscribe, touchViewer, removeViewer, type ActionEvent } from "@/lib/action-bus";
import "@/lib/idle-behavior"; // Start Bob's idle expressions
import "@/lib/proactive-speech"; // Start Bob's proactive monologues
import { isShutdown } from "@/lib/service-config";

export const dynamic = "force-dynamic";

// Vercel Pro allows up to 300s; keep this at 60s so the client
// reconnect cycle is tight and we don't burn compute idling.
export const maxDuration = 60;

// Close the stream a few seconds before maxDuration so we can
// flush Sentry events and send a clean "reconnect" hint to the client.
const GRACEFUL_CLOSE_MS = (maxDuration - 5) * 1000; // 55s

// Keepalive interval — must be well under GRACEFUL_CLOSE_MS
const KEEPALIVE_MS = 15_000; // 15s

export async function GET() {
  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | undefined;
  let keepalive: ReturnType<typeof setInterval> | undefined;
  let gracefulTimeout: ReturnType<typeof setTimeout> | undefined;
  const viewerId = crypto.randomUUID();

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: ActionEvent) => {
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
      });

      // Register this viewer
      touchViewer(viewerId);

      unsubscribe = subscribe(send);

      // Keepalive every 15s to stay under Vercel's timeout radar + refresh viewer
      keepalive = setInterval(async () => {
        try {
          controller.enqueue(encoder.encode(": keepalive\n\n"));
          touchViewer(viewerId);

          // Check and broadcast maintenance status on each keepalive
          const shutdown = await isShutdown();
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: "maintenance-mode", id: "system", active: shutdown })}\n\n`,
            ),
          );
        } catch (err) {
          console.error("[sse] Keepalive failed:", err);
          Sentry.captureException(err, { tags: { route: "avatar-events", phase: "keepalive" } });
          cleanup();
        }
      }, KEEPALIVE_MS);

      // Graceful self-close before Vercel kills us.
      // Tell the client to reconnect by sending a "reconnect" event,
      // then close the stream cleanly.
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
    if (keepalive) clearInterval(keepalive);
    if (gracefulTimeout) clearTimeout(gracefulTimeout);
    removeViewer(viewerId);
    unsubscribe = undefined;
    keepalive = undefined;
    gracefulTimeout = undefined;
  }

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
