"use client";

import { useState, useEffect } from "react";
import { getSupabase } from "@/lib/supabase";

export function useViewerCount(channelId: string, username?: string): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;
    const channel = supabase.channel(`presence:${channelId}`, {
      config: { presence: { key: username || "anon" } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        const total = Object.values(state).reduce(
          (sum, arr) => sum + arr.length,
          0,
        );
        setCount(total);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({
            username: username || "anon",
            online_at: new Date().toISOString(),
          });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [channelId, username]);

  return count;
}
