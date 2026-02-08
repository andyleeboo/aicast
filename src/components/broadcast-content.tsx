"use client";

import { useState, useCallback, useRef, useEffect, startTransition } from "react";
import { AvatarCanvas } from "./avatar/avatar-canvas";
import { ChatPanel } from "./chat-panel";
import { UsernameModal } from "./username-modal";
import { useAudioPlayer } from "@/hooks/use-audio-player";
import { getSkill } from "@/lib/avatar-actions";
import { trackEvent } from "@/lib/firebase";
import type { ScenePose } from "./avatar/face-controller";
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
  const [sseConnected, setSseConnected] = useState(true);
  const [scenePose, setScenePose] = useState<Partial<ScenePose> | null>(null);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const sceneResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // undefined = not loaded yet, null = no username stored
  const [username, setUsername] = useState<string | null | undefined>(undefined);

  // Hydrate from localStorage after mount to avoid SSR mismatch
  useEffect(() => {
    const stored = localStorage.getItem(USERNAME_KEY);
    // Use startTransition to avoid React Compiler cascading-render warning
    startTransition(() => setUsername(stored));
  }, []);
  const speechTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingFlushTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSpeechText = useRef<string | null>(null);
  const currentResponseText = useRef<string | null>(null); // kept for browser fallback after flush
  const currentResponseLang = useRef<string | undefined>(undefined); // language hint from server
  const gotServerAudio = useRef(false);
  const pendingActions = useRef<{
    gesture?: GestureReaction;
    emote?: EmoteCommand;
    skillId?: string;
  } | null>(null);
  const emoteCounter = useRef(0);
  const lockedUntil = useRef(0);
  const pendingEmote = useRef<EmoteCommand | null>(null);
  const mutedRef = useRef(muted);
  const maintenanceModeRef = useRef(maintenanceMode);

  // Keep refs in sync so callbacks see the latest values
  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);
  useEffect(() => {
    maintenanceModeRef.current = maintenanceMode;
  }, [maintenanceMode]);

  const player = useAudioPlayer({
    onEnd: () => {
      setIsSpeaking(false);
      if (!maintenanceModeRef.current) setSpeechBubble(null);
    },
    onError: () => {
      setIsSpeaking(false);
    },
  });

  // Pre-warm AudioContext when user interacts with the page (unlocks autoplay)
  const handleUserInteraction = useCallback(() => {
    player.warmup();
  }, [player]);

  const fireEmote = useCallback((cmd: EmoteCommand) => {
    emoteCounter.current += 1;
    setEmote({ command: cmd, key: emoteCounter.current });
    trackEvent("emote_triggered", { emote: cmd });
  }, []);

  const handleGestureComplete = useCallback(() => {
    if (maintenanceModeRef.current) return;
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
    // During maintenance, keep Bob locked in sleep — don't reset anything
    if (maintenanceModeRef.current) return;

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

  // Detect language from text using Unicode script ranges
  const detectLang = useCallback((text: string): string => {
    // Count characters in each script
    const ko = text.match(/[\uAC00-\uD7AF\u3130-\u318F]/g)?.length ?? 0;
    const ja = text.match(/[\u3040-\u309F\u30A0-\u30FF]/g)?.length ?? 0;
    const zh = text.match(/[\u4E00-\u9FFF]/g)?.length ?? 0;
    const total = text.replace(/\s/g, "").length || 1;
    if (ko / total > 0.15) return "ko-KR";
    if (ja / total > 0.15) return "ja-JP";
    if (zh / total > 0.15) return "zh-CN";
    return "en-US";
  }, []);

  // Web Speech API fallback — speaks text via the browser when server TTS fails
  const speakWithBrowser = useCallback((text: string, langHint?: string) => {
    if (mutedRef.current) { console.log("[web-speech] Skipped — muted"); return; }
    if (typeof window === "undefined" || !window.speechSynthesis) { console.log("[web-speech] Skipped — speechSynthesis unavailable"); return; }
    const lang = langHint || detectLang(text);
    console.log("[web-speech] Speaking:", text.substring(0, 60) + "...", "lang:", lang);
    window.speechSynthesis.cancel(); // stop any prior utterance
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = lang;
    utter.rate = 1.05;
    utter.pitch = 1.0;
    // Try to pick a voice matching the language
    const voices = window.speechSynthesis.getVoices();
    const match = voices.find((v) => v.lang.startsWith(lang.split("-")[0]));
    if (match) utter.voice = match;
    utter.onstart = () => { console.log("[web-speech] Started"); setIsSpeaking(true); };
    utter.onend = () => {
      console.log("[web-speech] Ended");
      setIsSpeaking(false);
      if (!maintenanceModeRef.current) setSpeechBubble(null);
    };
    utter.onerror = (e) => { console.error("[web-speech] Error:", e.error); setIsSpeaking(false); };
    window.speechSynthesis.speak(utter);
  }, [detectLang]);

  // Flush all stashed response data (bubble, gesture, emote)
  // Called when first audio chunk arrives, or as fallback when TTS fails
  const flushPending = useCallback(() => {
    if (pendingSpeechText.current) {
      setSpeechBubble(pendingSpeechText.current);
      pendingSpeechText.current = null;
    }
    const actions = pendingActions.current;
    if (actions) {
      pendingActions.current = null;
      if (actions.skillId) {
        activateSkill(actions.skillId);
      } else {
        if (actions.gesture) setGesture(actions.gesture);
        if (actions.emote) handleEmote(actions.emote);
      }
    }
  }, [activateSkill, handleEmote]);

  const handleAudioData = useCallback(
    (data: string) => {
      if (mutedRef.current) return;
      if (speechTimeout.current) { clearTimeout(speechTimeout.current); speechTimeout.current = null; }
      if (pendingFlushTimeout.current) { clearTimeout(pendingFlushTimeout.current); pendingFlushTimeout.current = null; }
      window.speechSynthesis?.cancel(); // kill browser fallback if racing
      gotServerAudio.current = true;
      flushPending();
      setIsSpeaking(true);
      trackEvent("audio_playback_started");
      player.play(data);
    },
    [player, flushPending],
  );

  const handleAudioChunk = useCallback(
    (data: string) => {
      console.log("[audio] Chunk received, muted:", mutedRef.current, "size:", data.length);
      if (mutedRef.current) return;
      if (speechTimeout.current) { clearTimeout(speechTimeout.current); speechTimeout.current = null; }
      if (pendingFlushTimeout.current) { clearTimeout(pendingFlushTimeout.current); pendingFlushTimeout.current = null; }
      window.speechSynthesis?.cancel(); // kill browser fallback if racing
      gotServerAudio.current = true;
      flushPending();
      setIsSpeaking(true);
      player.enqueue(data);
    },
    [player, flushPending],
  );

  const handleAudioEnd = useCallback(() => {
    console.log("[audio] Stream end signal, gotServerAudio:", gotServerAudio.current, "pendingText:", !!currentResponseText.current);
    if (pendingFlushTimeout.current) { clearTimeout(pendingFlushTimeout.current); pendingFlushTimeout.current = null; }
    // Flush any remaining stashed data
    flushPending();

    if (!gotServerAudio.current && currentResponseText.current) {
      // No server audio arrived at all — use browser speech as fallback
      console.log("[audio] No server audio — falling back to Web Speech API");
      setSpeechBubble(currentResponseText.current);
      speakWithBrowser(currentResponseText.current, currentResponseLang.current);
    }
    // If server audio played, bubble stays until player.onEnd fires
    gotServerAudio.current = false;
    currentResponseText.current = null;
    currentResponseLang.current = undefined;
    player.markStreamEnd();
  }, [player, flushPending, speakWithBrowser]);

  function handleUsernameConfirm(name: string) {
    localStorage.setItem(USERNAME_KEY, name);
    setUsername(name);
    trackEvent("username_set");
  }

  // Subscribe to SSE for remote-triggered actions and AI responses
  // EventSource auto-reconnects natively; we track state for UI feedback
  useEffect(() => {
    console.log("[sse] Connecting to /api/avatar/events");
    const es = new EventSource("/api/avatar/events");

    es.onopen = () => { console.log("[sse] Connected"); setSseConnected(true); };
    es.onerror = (e) => { console.warn("[sse] Error/disconnected, readyState:", es.readyState, e); setSseConnected(false); };

    es.onmessage = (event) => {
      setSseConnected(true);
      try {
        const data = JSON.parse(event.data);

        console.log("[sse] Event:", data.type, data.type === "ai-audio-chunk" ? `(${(data.audioData?.length ?? 0)} chars)` : "");

        if (data.type === "maintenance-mode") {
          if (data.active && !maintenanceModeRef.current) {
            setSpeechBubble("System Maintenance");
            handleEmote("sleep");
            setMaintenanceMode(true);
          } else if (!data.active && maintenanceModeRef.current) {
            setSpeechBubble(null);
            handleEmote("wake");
            setMaintenanceMode(false);
          }
          return;
        }

        if (maintenanceModeRef.current && data.type === "ai-response") {
          return; // Ignore stale AI responses during maintenance
        }

        if (data.type === "ai-response") {
          trackEvent("ai_response_received");
          gotServerAudio.current = false;
          // Stash everything — flushed when audio starts playing
          const actions: typeof pendingActions.current = {
            gesture: data.gesture as GestureReaction | undefined,
            emote: data.emote as EmoteCommand | undefined,
            skillId: data.skillId as string | undefined,
          };

          currentResponseText.current = data.response ?? null;
          currentResponseLang.current = data.language as string | undefined;

          if (mutedRef.current) {
            // Muted: no audio will arrive, flush immediately
            if (data.response) setSpeechBubble(data.response);
            if (speechTimeout.current) clearTimeout(speechTimeout.current);
            speechTimeout.current = setTimeout(() => setSpeechBubble(null), 8000);
            if (data.skillId) {
              activateSkill(data.skillId);
            } else {
              if (data.gesture) setGesture(data.gesture as GestureReaction);
              if (data.emote) handleEmote(data.emote as EmoteCommand);
            }
          } else {
            // Show "..." loading bubble immediately
            setSpeechBubble("...");
            // Stash real text + actions — flushed when first audio chunk arrives
            pendingSpeechText.current = data.response ?? null;
            pendingActions.current = actions;
            // Safeguard: if no audio arrives within 20s, flush actions (but no browser speech here)
            if (pendingFlushTimeout.current) clearTimeout(pendingFlushTimeout.current);
            pendingFlushTimeout.current = setTimeout(() => {
              if (pendingActions.current) {
                const a = pendingActions.current;
                pendingActions.current = null;
                if (a.skillId) {
                  activateSkill(a.skillId);
                } else {
                  if (a.gesture) setGesture(a.gesture);
                  if (a.emote) handleEmote(a.emote);
                }
              }
              // Show real text in bubble if still waiting
              if (pendingSpeechText.current) {
                setSpeechBubble(pendingSpeechText.current);
                pendingSpeechText.current = null;
              }
            }, 20_000);
          }
          return;
        }

        if (data.type === "ai-audio") {
          if (data.audioData) handleAudioData(data.audioData);
          return;
        }

        if (data.type === "ai-audio-chunk") {
          if (data.audioData) handleAudioChunk(data.audioData);
          return;
        }

        if (data.type === "ai-audio-end") {
          handleAudioEnd();
          return;
        }

        // Ignore idle animations during maintenance — Bob stays asleep
        if (maintenanceModeRef.current) return;

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
  }, [handleEmote, handleAudioData, handleAudioChunk, handleAudioEnd, activateSkill, flushPending, speakWithBrowser]);

  return (
    <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
      {/* Username modal — only after localStorage has been checked */}
      {username === null && <UsernameModal onConfirm={handleUsernameConfirm} />}

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
                {speechBubble === "..." ? (
                  <span className="inline-flex gap-0.5">
                    <span className="animate-bounce [animation-delay:0ms]">.</span>
                    <span className="animate-bounce [animation-delay:150ms]">.</span>
                    <span className="animate-bounce [animation-delay:300ms]">.</span>
                  </span>
                ) : (
                  speechBubble
                )}
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
              const next = !muted;
              setMuted(next);
              trackEvent("mute_toggled", { muted: next });
              if (!next) return;
              player.stop();
              window.speechSynthesis?.cancel();
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
