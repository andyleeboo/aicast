import { subscribe, type ActionEvent } from "@/lib/action-bus";

export const dynamic = "force-dynamic";

export async function GET() {
  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | undefined;
  let keepalive: ReturnType<typeof setInterval> | undefined;

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: ActionEvent) => {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(event)}\n\n`),
          );
        } catch {
          // Stream closed, clean up
          cleanup();
        }
      };

      // Send initial keepalive
      controller.enqueue(encoder.encode(": connected\n\n"));

      unsubscribe = subscribe(send);

      // Keepalive every 30s to prevent timeout
      keepalive = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": keepalive\n\n"));
        } catch {
          cleanup();
        }
      }, 30_000);
    },
    cancel() {
      cleanup();
    },
  });

  function cleanup() {
    unsubscribe?.();
    if (keepalive) clearInterval(keepalive);
    unsubscribe = undefined;
    keepalive = undefined;
  }

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
