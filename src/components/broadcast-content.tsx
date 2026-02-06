"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { AvatarCanvas } from "./avatar/avatar-canvas";
import { ChatPanel } from "./chat-panel";
import { UsernameModal } from "./username-modal";
import { useAudioPlayer } from "@/hooks/use-audio-player";
import type { Channel, GestureReaction, EmoteCommand } from "@/lib/types";

interface BroadcastContentProps {
  channel: Channel;
}

const USERNAME_KEY = "aicast_username";

export function BroadcastContent({ channel }: BroadcastContentProps) {
  const [gesture, setGesture] = useState<GestureReaction | null>(null);
  const [emote, setEmote] = useState<{ command: EmoteCommand; key: number } | null>(null);
  const [sleeping, setSleeping] = useState(false);
  const [speechBubble, setSpeechBubble] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [username, setUsername] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(USERNAME_KEY);
  });
  const speechTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const emoteCounter = useRef(0);
  const lockedUntil = useRef(0);
  const pendingEmote = useRef<EmoteCommand | null>(null);
  const mutedRef = useRef(muted);

  // Keep mutedRef in sync so the audio callback sees the latest value
  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  const player = useAudioPlayer({
    onEnd: () => {
      setIsSpeaking(false);
      setSpeechBubble(null);
    },
  });

  const handleSpeechBubble = useCallback((text: string | null) => {
    if (speechTimeout.current) clearTimeout(speechTimeout.current);
    setSpeechBubble(text);
    if (text) {
      // Fallback: show bubble for 5 seconds if no audio drives it
      speechTimeout.current = setTimeout(() => setSpeechBubble(null), 5000);
    }
  }, []);

  const handleAudioData = useCallback(
    (data: string) => {
      if (mutedRef.current) return;

      // Clear the fallback timeout — audio end will dismiss the bubble
      if (speechTimeout.current) {
        clearTimeout(speechTimeout.current);
        speechTimeout.current = null;
      }

      setIsSpeaking(true);
      player.play(data);
    },
    [player],
  );

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

  function handleUsernameConfirm(name: string) {
    localStorage.setItem(USERNAME_KEY, name);
    setUsername(name);
  }

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
      {/* Username modal */}
      {!username && <UsernameModal onConfirm={handleUsernameConfirm} />}

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

          {/* Speech bubble */}
          <div
            className={`pointer-events-none absolute left-1/2 top-6 z-10 max-w-md -translate-x-1/2 transition-all duration-300 ${
              speechBubble
                ? "translate-y-0 opacity-100"
                : "-translate-y-4 opacity-0"
            }`}
          >
            {speechBubble && (
              <div className="relative rounded-2xl bg-white px-5 py-3 text-sm leading-relaxed text-gray-900 shadow-lg">
                {speechBubble}
                {/* Bubble tail / triangle */}
                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2">
                  <div className="h-0 w-0 border-l-8 border-r-8 border-t-8 border-l-transparent border-r-transparent border-t-white" />
                </div>
              </div>
            )}
          </div>
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
          <button
            onClick={() => {
              setMuted((m) => !m);
              if (!muted) player.stop();
            }}
            className="shrink-0 rounded-full bg-surface-hover px-3 py-1.5 text-xs text-muted transition-colors hover:text-foreground"
            title={muted ? "Unmute" : "Mute"}
          >
            {muted ? (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                <path d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.508c-1.141 0-2.318.664-2.66 1.905A9.76 9.76 0 001.5 12c0 .898.121 1.768.35 2.595.341 1.24 1.518 1.905 2.659 1.905h1.93l4.5 4.5c.945.945 2.561.276 2.561-1.06V4.06zM17.78 9.22a.75.75 0 10-1.06 1.06L18.44 12l-1.72 1.72a.75.75 0 101.06 1.06l1.72-1.72 1.72 1.72a.75.75 0 101.06-1.06L20.56 12l1.72-1.72a.75.75 0 10-1.06-1.06l-1.72 1.72-1.72-1.72z" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                <path d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.508c-1.141 0-2.318.664-2.66 1.905A9.76 9.76 0 001.5 12c0 .898.121 1.768.35 2.595.341 1.24 1.518 1.905 2.659 1.905h1.93l4.5 4.5c.945.945 2.561.276 2.561-1.06V4.06zM18.584 5.106a.75.75 0 011.06 0c3.808 3.807 3.808 9.98 0 13.788a.75.75 0 01-1.06-1.06 8.25 8.25 0 000-11.668.75.75 0 010-1.06z" />
                <path d="M15.932 7.757a.75.75 0 011.061 0 6 6 0 010 8.486.75.75 0 01-1.06-1.061 4.5 4.5 0 000-6.364.75.75 0 010-1.06z" />
              </svg>
            )}
          </button>
          <span className="shrink-0 rounded-full bg-surface-hover px-3 py-1 text-xs text-muted">
            {channel.category}
          </span>
        </div>
      </div>

      {/* Chat */}
      <div className="h-[45vh] w-full border-t border-border lg:h-auto lg:w-[380px] lg:border-l lg:border-t-0">
        {username ? (
          <ChatPanel
            channelId={channel.id}
            streamerId={channel.id}
            streamerName={channel.streamer.name}
            username={username}
            onAIResponse={handleAIResponse}
            onEmote={handleEmote}
            onSpeechBubble={handleSpeechBubble}
            onAudioData={handleAudioData}
            isSpeaking={isSpeaking}
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-surface text-sm text-muted">
            Pick a name to join chat
          </div>
        )}
      </div>
    </div>
  );
}
