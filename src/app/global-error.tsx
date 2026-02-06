"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en" className="dark">
      <body className="flex min-h-screen items-center justify-center bg-[#0e0e10] text-[#efeff1]">
        <div className="flex flex-col items-center gap-4">
          <h2 className="text-xl font-semibold">Something went wrong</h2>
          <button
            onClick={reset}
            className="rounded-lg bg-[#9147ff] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#772ce8]"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
