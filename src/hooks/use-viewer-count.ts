"use client";

import { useState, useEffect } from "react";

const POLL_INTERVAL = 15_000;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function useViewerCount(_channelId: string): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let mounted = true;

    async function poll() {
      try {
        const res = await fetch("/api/viewers");
        if (res.ok && mounted) {
          const { count: c } = await res.json();
          setCount(c);
        }
      } catch {
        // Silently retry on next interval
      }
    }

    poll();
    const id = setInterval(poll, POLL_INTERVAL);
    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, []);

  // The person viewing the page is always a viewer — never show 0
  return Math.max(1, count);
}
