"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { AvatarCanvas } from "./avatar/avatar-canvas";
import { ChatPanel } from "./chat-panel";
import { UsernameModal } from "./username-modal";
import { useAudioPlayer } from "@/hooks/use-audio-player";
import { getSkill } from "@/lib/avatar-actions";
import type { ScenePose } from "./avatar/face-controller";
import type { Channel, GestureReaction, EmoteCommand } from "@/lib/types";

interface BroadcastContentProps {
  channel: Channel;
}

export interface AiMessage {
  id: string;
  content: string;
  timestamp: number;
}

const USERNAME_KEY = "aicast_username";

export function BroadcastContent({ channel }: BroadcastContentProps) {
  const [gesture, setGesture] = useState<GestureReaction | null>(null);
  const [emote, setEmote] = useState<{ command: EmoteCommand; key: number } | null>(null);
  const [sleeping, setSleeping] = useState(false);
  const [speechBubble, setSpeechBubble] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [latestAiMessage, setLatestAiMessage] = useState<AiMessage | null>(null);
  const [aiThinking, setAiThinking] = useState(false);
  const [sseConnected, setSseConnected] = useState(true);
  const [scenePose, setScenePose] = useState<Partial<ScenePose> | null>(null);
  const sceneResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [username, setUsername] = useState<string | null>(null);

  // Hydrate from localStorage after mount to avoid SSR mismatch
  useEffect(() => {
    const stored = localStorage.getItem(USERNAME_KEY);
    if (stored) setUsername(stored);
  }, []);
  const speechTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSpeechText = useRef<string | null>(null);
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
    onError: () => {
      setIsSpeaking(false);
    },
  });

  const handleSpeechBubble = useCallback((text: string | null) => {
    if (speechTimeout.current) clearTimeout(speechTimeout.current);
    // Stash text — bubble appears when audio starts (or after fallback timeout)
    pendingSpeechText.current = text;
    if (text) {
      // Fallback: if audio never arrives (muted, TTS failure), show bubble after 3s
      speechTimeout.current = setTimeout(() => {
        if (pendingSpeechText.current) {
          setSpeechBubble(pendingSpeechText.current);
          pendingSpeechText.current = null;
          // Auto-dismiss after another 5s
          speechTimeout.current = setTimeout(() => setSpeechBubble(null), 5000);
        }
      }, 3000);
    } else {
      setSpeechBubble(null);
    }
  }, []);

  // Pre-warm AudioContext when user interacts with the page (unlocks autoplay)
  const handleUserInteraction = useCallback(() => {
    player.warmup();
  }, [player]);

  const handleAudioData = useCallback(
    (data: string) => {
      if (mutedRef.current) return;

      // Clear the fallback timeout — audio end will dismiss the bubble
      if (speechTimeout.current) {
        clearTimeout(speechTimeout.current);
        speechTimeout.current = null;
      }

      // Show the speech bubble now that audio is actually playing
      if (pendingSpeechText.current) {
        setSpeechBubble(pendingSpeechText.current);
        pendingSpeechText.current = null;
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

  const handleGestureComplete = useCallback(() => {
    setGesture(null);
  }, []);

  const handleEmote = useCallback((e: EmoteCommand) => {
    const now = Date.now();
    if (now < lockedUntil.current) return; // cooldown — drop command
    if (e === "wake" && !sleeping) return;
    if (e === "sleep" && sleeping) return;

    lockedUntil.current = now + 1500;

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

  const activateSkill = useCallback((skillId: string) => {
    const skill = getSkill(skillId);
    if (!skill) return;

    // Set scene pose
    const pose: Partial<ScenePose> = {};
    if (skill.position) {
      pose.x = skill.position[0];
      pose.y = skill.position[1];
      pose.z = skill.position[2];
    }
    if (skill.scale !== undefined) pose.scale = skill.scale;
    setScenePose(pose);

    // Trigger gesture and/or emote from the skill
    if (skill.gesture) setGesture(skill.gesture);
    if (skill.emote) handleEmote(skill.emote);

    // Auto-reset scene pose after hold duration
    if (sceneResetTimer.current) clearTimeout(sceneResetTimer.current);
    sceneResetTimer.current = setTimeout(() => {
      setScenePose(null);
    }, skill.holdMs);
  }, [handleEmote]);

  function handleUsernameConfirm(name: string) {
    localStorage.setItem(USERNAME_KEY, name);
    setUsername(name);
  }

  // Subscribe to SSE for remote-triggered actions and AI responses
  // EventSource auto-reconnects natively; we track state for UI feedback
  useEffect(() => {
    const es = new EventSource("/api/avatar/events");

    es.onopen = () => setSseConnected(true);
    es.onerror = () => setSseConnected(false);

    es.onmessage = (event) => {
      setSseConnected(true);
      try {
        const data = JSON.parse(event.data);

        if (data.type === "ai-thinking") {
          setAiThinking(true);
          return;
        }

        if (data.type === "ai-response") {
          setAiThinking(false);
          // Broadcast AI response: speech bubble, gesture, emote, skill, chat message
          // Audio arrives separately via ai-audio event
          if (data.response) handleSpeechBubble(data.response);
          if (data.skillId) {
            activateSkill(data.skillId);
          } else {
            if (data.gesture) setGesture(data.gesture as GestureReaction);
            if (data.emote) handleEmote(data.emote as EmoteCommand);
          }
          setLatestAiMessage({
            id: data.id,
            content: data.response,
            timestamp: Date.now(),
          });
          return;
        }

        if (data.type === "ai-audio") {
          if (data.audioData) handleAudioData(data.audioData);
          return;
        }

        if (data.type === "skill") {
          const skillId = data.id;
          activateSkill(skillId);
          return;
        }

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
  }, [handleEmote, handleSpeechBubble, handleAudioData, activateSkill]);

  return (
    <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
      {/* Username modal */}
      {!username && <UsernameModal onConfirm={handleUsernameConfirm} />}

      {/* Stream area — fixed height on mobile so keyboard only shrinks chat */}
      <div className="flex h-[250px] shrink-0 flex-col sm:h-[350px] lg:h-auto lg:flex-1 lg:shrink">
        {/* 3D Avatar */}
        <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-black">
          <AvatarCanvas
            gesture={gesture}
            onGestureComplete={handleGestureComplete}
            emote={emote}
            onEmoteComplete={handleEmoteComplete}
            isSpeaking={isSpeaking}
            scenePose={scenePose}
          />

          {/* Speech bubble — hidden on mobile to avoid covering Bob's face */}
          <div
            className={`pointer-events-none absolute left-1/2 top-6 z-10 max-w-md -translate-x-1/2 transition-all duration-300 max-lg:hidden ${
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
          {!sseConnected && (
            <span className="shrink-0 animate-pulse rounded-full bg-yellow-500/20 px-3 py-1 text-xs text-yellow-400">
              Reconnecting...
            </span>
          )}
          <span className="shrink-0 rounded-full bg-surface-hover px-3 py-1 text-xs text-muted">
            {channel.category}
          </span>
        </div>
      </div>

      {/* Chat */}
      <div className="min-h-0 flex-1 w-full border-t border-border lg:h-auto lg:flex-none lg:w-[380px] lg:border-l lg:border-t-0">
        {username ? (
          <ChatPanel
            channelId={channel.id}
            streamerName={channel.streamer.name}
            username={username}
            onEmote={handleEmote}
            onGesture={setGesture}
            onUserInteraction={handleUserInteraction}
            aiMessage={latestAiMessage}
            aiThinking={aiThinking}
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-surface text-sm text-muted">
            Enter the lobby to chat
          </div>
        )}
      </div>
    </div>
  );
}
