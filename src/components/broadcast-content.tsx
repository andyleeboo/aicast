"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { AvatarCanvas } from "./avatar/avatar-canvas";
import { ChatPanel } from "./chat-panel";
import type { Channel, GestureReaction, EmoteCommand } from "@/lib/types";

interface BroadcastContentProps {
  channel: Channel;
}

export function BroadcastContent({ channel }: BroadcastContentProps) {
  const [gesture, setGesture] = useState<GestureReaction | null>(null);
  const [emote, setEmote] = useState<{ command: EmoteCommand; key: number } | null>(null);
  const [sleeping, setSleeping] = useState(false);
  const emoteCounter = useRef(0);
  const lockedUntil = useRef(0);
  const pendingEmote = useRef<EmoteCommand | null>(null);

  const fireEmote = useCallback((cmd: EmoteCommand) => {
    emoteCounter.current += 1;
    setEmote({ command: cmd, key: emoteCounter.current });
  }, []);

  const handleAIResponse = useCallback((g: GestureReaction) => {
    setGesture(g);
  }, []);

  const handleGestureComplete = useCallback(() => {
    setGesture(null);
  }, []);

  const handleEmote = useCallback((e: EmoteCommand) => {
    const now = Date.now();
    if (now < lockedUntil.current) return; // cooldown — drop command
    if (e === "wake" && !sleeping) return;
    if (e === "sleep" && sleeping) return;

    lockedUntil.current = now + 3000;

    // If sleeping and a non-wake command arrives, wake first then chain it
    if (sleeping && e !== "wake") {
      pendingEmote.current = e;
      fireEmote("wake");
      return;
    }

    if (e === "sleep") setSleeping(true);
    fireEmote(e);
  }, [sleeping, fireEmote]);

  const handleEmoteComplete = useCallback(() => {
    setSleeping(false);

    const pending = pendingEmote.current;
    if (pending) {
      pendingEmote.current = null;
      if (pending === "sleep") setSleeping(true);
      fireEmote(pending);
      return;
    }

    setEmote(null);
  }, [fireEmote]);

  // Subscribe to SSE for remote-triggered actions (REST API)
  useEffect(() => {
    const es = new EventSource("/api/avatar/events");

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as {
          type: "gesture" | "emote";
          id: string;
        };
        const value = data.id.split(":")[1];
        if (data.type === "gesture") {
          setGesture(value as GestureReaction);
        } else if (data.type === "emote") {
          handleEmote(value as EmoteCommand);
        }
      } catch {
        // Ignore malformed events
      }
    };

    return () => es.close();
  }, [handleEmote]);

  return (
    <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
      {/* Stream area */}
      <div className="flex flex-1 flex-col">
        {/* 3D Avatar */}
        <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-black">
          <AvatarCanvas
            gesture={gesture}
            onGestureComplete={handleGestureComplete}
            emote={emote}
            onEmoteComplete={handleEmoteComplete}
          />
        </div>

        {/* Stream info bar */}
        <div className="flex items-center gap-4 border-t border-border bg-surface px-5 py-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-accent to-accent/40 text-sm font-bold text-white">
            N
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">{channel.streamer.name}</p>
            <p className="truncate text-xs text-muted">{channel.description}</p>
          </div>
          <span className="shrink-0 rounded-full bg-surface-hover px-3 py-1 text-xs text-muted">
            {channel.category}
          </span>
        </div>
      </div>

      {/* Chat */}
      <div className="h-[45vh] w-full border-t border-border lg:h-auto lg:w-[380px] lg:border-l lg:border-t-0">
        <ChatPanel
          streamerId={channel.id}
          streamerName={channel.streamer.name}
          onAIResponse={handleAIResponse}
          onEmote={handleEmote}
        />
      </div>
    </div>
  );
}
