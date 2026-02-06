"use client";

import * as Sentry from "@sentry/nextjs";
import { Geist } from "next/font/google";
import { useEffect } from "react";

const geistSans = Geist({ subsets: ["latin"] });

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

  // Hardcoded colors — this component replaces the root layout so CSS
  // custom properties from globals.css may not be available. Keep in
  // sync with globals.css tokens: --background, --foreground, --accent.
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.className} flex min-h-screen items-center justify-center bg-[#0e0e10] text-[#efeff1] antialiased`}
      >
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
