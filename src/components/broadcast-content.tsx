"use client";

import { useState, useCallback, useRef, useEffect, startTransition } from "react";
import { AvatarCanvas } from "./avatar/avatar-canvas";
import { ChatPanel } from "./chat-panel";
import { UsernameModal } from "./username-modal";
import { GameOverlay } from "./game/game-overlay";
import { useAudioPlayer } from "@/hooks/use-audio-player";
import { useSpeechBubble } from "@/hooks/use-speech-bubble";
import { getSkill } from "@/lib/avatar-actions";
import { trackEvent } from "@/lib/firebase";
import type { ScenePose } from "./avatar/face-controller";
import type { Channel, GestureReaction, EmoteCommand, DonationTier } from "@/lib/types";
import type { DonationEvent } from "./chat-panel";
import type { GameClientState } from "@/lib/games/game-types";

interface BroadcastContentProps {
  channel: Channel;
}

const USERNAME_KEY = "aicast_username";
const CHAT_WIDTH_KEY = "aicast_chat_width";
const DEFAULT_CHAT_WIDTH = 380;
const MIN_CHAT_WIDTH = 200;
const MAX_CHAT_RATIO = 0.6; // chat can grow up to 60% of viewport width

const AVATAR_HEIGHT_KEY = "aicast_avatar_height";
const DEFAULT_AVATAR_HEIGHT = 250;
const MIN_AVATAR_HEIGHT = 120;
const MAX_AVATAR_RATIO = 0.65; // avatar can take up to 65% of viewport height

export function BroadcastContent({ channel }: BroadcastContentProps) {
  const [gesture, setGesture] = useState<GestureReaction | null>(null);
  const [emote, setEmote] = useState<{ command: EmoteCommand; key: number } | null>(null);
  const [sleeping, setSleeping] = useState(false);
  const [muted, setMuted] = useState(false);
  const [sseConnected, setSseConnected] = useState(true);
  const [scenePose, setScenePose] = useState<Partial<ScenePose> | null>(null);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [gameState, setGameState] = useState<GameClientState | null>(null);
  const [donations, setDonations] = useState<DonationEvent[]>([]);
  const sceneResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gameEndTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gameStateRef = useRef(gameState);
  // undefined = not loaded yet, null = no username stored
  const [username, setUsername] = useState<string | null | undefined>(undefined);
  const [chatWidth, setChatWidth] = useState(DEFAULT_CHAT_WIDTH);
  const [avatarHeight, setAvatarHeight] = useState(DEFAULT_AVATAR_HEIGHT);
  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const dragStartWidth = useRef(0);
  const dragStartY = useRef(0);
  const dragStartHeight = useRef(0);

  // Hydrate from localStorage after mount to avoid SSR mismatch
  useEffect(() => {
    const stored = localStorage.getItem(USERNAME_KEY);
    const storedWidth = localStorage.getItem(CHAT_WIDTH_KEY);
    const storedHeight = localStorage.getItem(AVATAR_HEIGHT_KEY);
    startTransition(() => {
      setUsername(stored);
      if (storedWidth) {
        const w = Number(storedWidth);
        if (w >= MIN_CHAT_WIDTH && w <= window.innerWidth * MAX_CHAT_RATIO) setChatWidth(w);
      }
      if (storedHeight) {
        const h = Number(storedHeight);
        if (h >= MIN_AVATAR_HEIGHT && h <= window.innerHeight * MAX_AVATAR_RATIO) setAvatarHeight(h);
      }
    });
  }, []);

  const currentResponseText = useRef<string | null>(null); // for browser fallback (avoids stale closure)
  const currentResponseLang = useRef<string | undefined>(undefined);
  const gotServerAudio = useRef(false);
  const emoteCounter = useRef(0);
  const lockedUntil = useRef(0);
  const pendingEmote = useRef<EmoteCommand | null>(null);
  const mutedRef = useRef(muted);
  const maintenanceModeRef = useRef(maintenanceMode);
  const cachedVoices = useRef<SpeechSynthesisVoice[]>([]);

  // Speech bubble hook — decouples text display from audio playback
  const bubble = useSpeechBubble();
  const bubbleRef = useRef(bubble);
  useEffect(() => { bubbleRef.current = bubble; });

  // Pre-load speech synthesis voices (they load async in Chrome/Safari)
  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    const loadVoices = () => { cachedVoices.current = window.speechSynthesis.getVoices(); };
    loadVoices(); // may already be available
    window.speechSynthesis.addEventListener("voiceschanged", loadVoices);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", loadVoices);
  }, []);

  // Keep refs in sync so callbacks see the latest values
  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);
  useEffect(() => {
    maintenanceModeRef.current = maintenanceMode;
  }, [maintenanceMode]);
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  const player = useAudioPlayer({
    onEnd: () => {
      bubbleRef.current.speakingEnded();
    },
    onError: () => {
      bubbleRef.current.speakingEnded();
    },
  });
  const playerRef = useRef(player);
  useEffect(() => { playerRef.current = player; });

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
    if (typeof window === "undefined" || !window.speechSynthesis) {
      console.log("[web-speech] speechSynthesis unavailable — showing text for reading");
      bubbleRef.current.showForReading(text);
      return;
    }
    const lang = langHint || detectLang(text);
    console.log("[web-speech] Speaking:", text.substring(0, 60) + "...", "lang:", lang);
    window.speechSynthesis.cancel(); // stop any prior utterance
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = lang;
    utter.rate = 0.95;
    utter.pitch = 0.85;
    // Pick a voice matching the language from the pre-loaded cache
    const voices = cachedVoices.current.length > 0
      ? cachedVoices.current
      : window.speechSynthesis.getVoices(); // last-resort sync call
    const langPrefix = lang.split("-")[0];
    // Prefer a non-default, local/high-quality voice for the target language
    const match =
      voices.find((v) => v.lang.startsWith(langPrefix) && !v.default && v.localService) ||
      voices.find((v) => v.lang.startsWith(langPrefix) && !v.default) ||
      voices.find((v) => v.lang.startsWith(langPrefix));
    if (match) {
      utter.voice = match;
      console.log("[web-speech] Selected voice:", match.name, match.lang);
    } else {
      console.warn("[web-speech] No voice found for", lang, "— available:", voices.length);
    }
    utter.onstart = () => { console.log("[web-speech] Started"); bubbleRef.current.speakingStarted(); };
    utter.onend = () => { console.log("[web-speech] Ended"); bubbleRef.current.speakingEnded(); };
    utter.onerror = (e) => { console.error("[web-speech] Error:", e.error); bubbleRef.current.speakingEnded(); };
    window.speechSynthesis.speak(utter);
  }, [detectLang]);

  const handleAudioChunk = useCallback(
    (data: string) => {
      console.log("[audio] Chunk received, muted:", mutedRef.current, "size:", data.length);
      if (mutedRef.current) return;
      window.speechSynthesis?.cancel(); // kill browser fallback if racing
      gotServerAudio.current = true;
      bubbleRef.current.speakingStarted();
      playerRef.current.enqueue(data);
    },
    [],
  );

  const handleAudioEnd = useCallback(() => {
    console.log("[audio] Stream end signal, gotServerAudio:", gotServerAudio.current);

    if (!gotServerAudio.current && !mutedRef.current) {
      // No server audio arrived at all — use browser speech as fallback.
      // The bubble already shows text (set on ai-response), so just trigger speech.
      if (currentResponseText.current) {
        console.log("[audio] No server audio — falling back to Web Speech API");
        trackEvent("tts_played", { provider: "browser_fallback" });
        speakWithBrowser(currentResponseText.current, currentResponseLang.current);
      }
    } else if (gotServerAudio.current) {
      trackEvent("tts_played", { provider: "server" });
    }
    gotServerAudio.current = false;
    currentResponseText.current = null;
    currentResponseLang.current = undefined;
    playerRef.current.markStreamEnd();
  }, [speakWithBrowser]);

  function handleUsernameConfirm(name: string) {
    localStorage.setItem(USERNAME_KEY, name);
    setUsername(name);
    trackEvent("username_set");
  }

  // Notification sound for Gold/Red donations (Web Audio API — no files needed)
  const playDonationSound = useCallback((tier: DonationTier) => {
    if (tier === "blue" || mutedRef.current) return;
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain).connect(ctx.destination);
      osc.frequency.value = tier === "red" ? 880 : 660;
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      osc.start();
      osc.stop(ctx.currentTime + 0.5);
    } catch (err) {
      console.warn("[donation-sound] AudioContext error:", err);
    }
  }, []);

  // Handle game state updates (called from SSE events AND from direct API responses)
  const handleGameState = useCallback((gs: GameClientState) => {
    setGameState(gs);

    // Analytics: track game lifecycle
    if (gs.status === "playing" && !gameStateRef.current) {
      trackEvent("game_started", { game_type: gs.type, game_id: gs.gameId });
    } else if (gs.status === "won") {
      trackEvent("game_won", { game_type: gs.type, game_id: gs.gameId });
    } else if (gs.status === "lost") {
      trackEvent("game_lost", { game_type: gs.type, game_id: gs.gameId });
    }

    if (gs.status === "playing") {
      // On mobile, move Bob off-screen (game overlay covers full canvas);
      // on desktop, slide left to make room for the game panel.
      const isMobile = window.innerWidth < 1024;
      setScenePose(
        isMobile
          ? { x: 3.5, y: -2.5, scale: 0.3 }
          : { x: -1.8, scale: 0.7 },
      );
      if (gameEndTimer.current) {
        clearTimeout(gameEndTimer.current);
        gameEndTimer.current = null;
      }
    } else {
      // Game ended (won/lost) — wait 5s then hide overlay and reset Bob
      if (gameEndTimer.current) clearTimeout(gameEndTimer.current);
      gameEndTimer.current = setTimeout(() => {
        setGameState(null);
        setScenePose(null);
        gameEndTimer.current = null;
      }, 5000);
    }
  }, []);

  // On mount: track session start + check if a game is already running
  useEffect(() => {
    trackEvent("stream_session_start", {
      channel: channel.id,
      platform: /Mobi|Android/i.test(navigator.userAgent) ? "mobile" : "desktop",
    });
    fetch("/api/game")
      .then((r) => r.json())
      .then((data) => { if (data.state) handleGameState(data.state); })
      .catch((err) => { console.warn("[broadcast] Failed to fetch initial game state:", err); });
  }, [handleGameState]);

  // Subscribe to SSE for remote-triggered actions and AI responses
  // EventSource auto-reconnects natively; we track state for UI feedback
  useEffect(() => {
    console.log(`[sse] Connecting to /api/avatar/events?channel=${channel.id}`);
    const es = new EventSource(`/api/avatar/events?channel=${channel.id}`);

    es.onopen = () => { console.log("[sse] Connected"); setSseConnected(true); };
    es.onerror = (e) => { console.warn("[sse] Error/disconnected, readyState:", es.readyState, e); setSseConnected(false); };

    es.onmessage = (event) => {
      setSseConnected(true);
      try {
        const data = JSON.parse(event.data);

        console.log("[sse] Event:", data.type, data.type === "ai-audio-chunk" ? `(${(data.audioData?.length ?? 0)} chars)` : "");

        if (data.type === "maintenance-mode") {
          if (data.active && !maintenanceModeRef.current) {
            bubbleRef.current.showMaintenance("System Maintenance");
            handleEmote("sleep");
            setMaintenanceMode(true);
          } else if (!data.active && maintenanceModeRef.current) {
            bubbleRef.current.clearMaintenance();
            handleEmote("wake");
            setMaintenanceMode(false);
          }
          return;
        }

        if (data.type === "donation") {
          const event: DonationEvent = {
            id: data.id,
            donationTier: data.donationTier,
            donationAmount: data.donationAmount,
            donationUsername: data.donationUsername,
            donationContent: data.donationContent,
          };
          setDonations((prev) => [...prev, event]);
          playDonationSound(event.donationTier);
          trackEvent("donation_received", { tier: event.donationTier, amount: event.donationAmount });
          return;
        }

        if (data.type === "ai-thinking") {
          bubbleRef.current.showLoading();
          setGesture("uncertain");
          return;
        }

        if (maintenanceModeRef.current && data.type === "ai-response") {
          return; // Ignore stale AI responses during maintenance
        }

        if (data.type === "ai-response") {
          trackEvent("ai_response_received");
          gotServerAudio.current = false;
          currentResponseText.current = data.response ?? null;
          currentResponseLang.current = data.language as string | undefined;

          // Fire actions immediately (no stashing)
          if (data.skillId) {
            activateSkill(data.skillId);
          } else {
            if (data.gesture) setGesture(data.gesture as GestureReaction);
            if (data.emote) handleEmote(data.emote as EmoteCommand);
          }

          if (mutedRef.current) {
            // Muted: show text for reading duration, no audio
            if (data.response) bubbleRef.current.showForReading(data.response);
          } else {
            // Unmuted: show loading then immediately show real text
            bubbleRef.current.showLoading();
            if (data.response) bubbleRef.current.showResponse(data.response);
          }
          return;
        }

        if (data.type === "ai-audio") {
          // Legacy single-shot audio
          if (data.audioData) {
            if (mutedRef.current) return;
            window.speechSynthesis?.cancel();
            gotServerAudio.current = true;
            bubbleRef.current.speakingStarted();
            playerRef.current.play(data.audioData);
          }
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

        if (data.type === "game-state" && data.gameState) {
          handleGameState(data.gameState as GameClientState);
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
      } catch (err) {
        if (err instanceof SyntaxError) {
          console.warn("[sse] Malformed event data:", event.data?.substring(0, 100));
        } else {
          console.error("[sse] Error processing event:", err);
        }
      }
    };

    return () => {
      es.close();
      if (gameEndTimer.current) clearTimeout(gameEndTimer.current);
    };
  }, [channel.id, handleEmote, handleAudioChunk, handleAudioEnd, activateSkill, playDonationSound]);

  // --- Draggable divider logic (mobile: vertical, desktop: horizontal) ---
  const [dragging, setDragging] = useState(false);
  const chatWidthRef = useRef(chatWidth);
  useEffect(() => { chatWidthRef.current = chatWidth; });
  const avatarHeightRef = useRef(avatarHeight);
  useEffect(() => { avatarHeightRef.current = avatarHeight; });

  const handleDividerPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    isDragging.current = true;
    setDragging(true);
    document.body.style.userSelect = "none";

    const isDesktop = window.innerWidth >= 1024;

    if (isDesktop) {
      // Desktop: drag left/right to resize chat width
      dragStartX.current = e.clientX;
      dragStartWidth.current = chatWidthRef.current;
      document.body.style.cursor = "col-resize";

      const maxW = Math.floor(window.innerWidth * MAX_CHAT_RATIO);
      const clamp = (v: number) => Math.min(maxW, Math.max(MIN_CHAT_WIDTH, v));

      const onMove = (ev: PointerEvent) => {
        setChatWidth(clamp(dragStartWidth.current - (ev.clientX - dragStartX.current)));
      };
      const onUp = (ev: PointerEvent) => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        isDragging.current = false;
        setDragging(false);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        const finalW = clamp(dragStartWidth.current - (ev.clientX - dragStartX.current));
        localStorage.setItem(CHAT_WIDTH_KEY, String(finalW));
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    } else {
      // Mobile: drag up/down to resize avatar height
      dragStartY.current = e.clientY;
      dragStartHeight.current = avatarHeightRef.current;
      document.body.style.cursor = "row-resize";

      const maxH = Math.floor(window.innerHeight * MAX_AVATAR_RATIO);
      const clamp = (v: number) => Math.min(maxH, Math.max(MIN_AVATAR_HEIGHT, v));

      const onMove = (ev: PointerEvent) => {
        setAvatarHeight(clamp(dragStartHeight.current + (ev.clientY - dragStartY.current)));
      };
      const onUp = (ev: PointerEvent) => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        isDragging.current = false;
        setDragging(false);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        const finalH = clamp(dragStartHeight.current + (ev.clientY - dragStartY.current));
        localStorage.setItem(AVATAR_HEIGHT_KEY, String(finalH));
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    }
  }, []);

  return (
    <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
      {/* Username modal — only after localStorage has been checked */}
      {username === null && <UsernameModal onConfirm={handleUsernameConfirm} />}

      {/* Stream area — adjustable height on mobile, fills remaining space on desktop */}
      <div
        className={`relative flex shrink-0 flex-col lg:h-auto lg:min-w-0 lg:flex-1 lg:shrink ${gameState ? "max-lg:h-[min(300px,55vh)]" : "h-[var(--avatar-h)]"}`}
        style={{ "--avatar-h": `${avatarHeight}px` } as React.CSSProperties}
      >
        {/* 3D Avatar */}
        <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-black">
          <AvatarCanvas
            gesture={gesture}
            onGestureComplete={handleGestureComplete}
            emote={emote}
            onEmoteComplete={handleEmoteComplete}
            isSpeaking={bubble.isSpeaking}
            scenePose={scenePose}
            skinColor={channel.streamer.skinColor}
          />
          {gameState && <GameOverlay gameState={gameState} />}
        </div>

        {/* Speech bubble — flows below canvas on mobile, floats over canvas on desktop.
             Hidden on mobile during games (Bob speaks via audio anyway). */}
        <div
          className={`pointer-events-none z-10 justify-center transition-all duration-300 max-lg:mx-4 max-lg:py-1.5 lg:absolute lg:left-1/2 lg:top-[15%] lg:max-w-md lg:-translate-x-1/2 ${
            gameState ? "max-lg:hidden " : ""
          }${
            bubble.text
              ? "flex opacity-100 lg:translate-y-0"
              : "hidden lg:flex lg:-translate-y-4 lg:opacity-0"
          }`}
        >
          {bubble.text && (
            <div className={`relative rounded-2xl bg-white px-5 py-2.5 text-sm leading-relaxed text-gray-900 shadow-lg transition-shadow duration-300 lg:py-3 ${bubble.isSpeaking ? "ring-2 ring-accent/60 shadow-[0_0_15px_rgba(145,71,255,0.3)]" : ""}`}>
              {bubble.text === "..." ? (
                <span className="inline-flex gap-0.5">
                  <span className="animate-bounce [animation-delay:0ms]">.</span>
                  <span className="animate-bounce [animation-delay:150ms]">.</span>
                  <span className="animate-bounce [animation-delay:300ms]">.</span>
                </span>
              ) : (
                bubble.text
              )}
              {/* Tail — mobile: points UP toward Bob above */}
              <div className="absolute -top-2 left-1/2 -translate-x-1/2 lg:hidden">
                <div className="h-0 w-0 border-l-8 border-r-8 border-b-8 border-l-transparent border-r-transparent border-b-white" />
              </div>
              {/* Tail — desktop: points DOWN toward Bob below */}
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 max-lg:hidden">
                <div className="h-0 w-0 border-l-8 border-r-8 border-t-8 border-l-transparent border-r-transparent border-t-white" />
              </div>
            </div>
          )}
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

      {/* Draggable divider — horizontal on mobile, vertical on desktop.
           Outer div is the wide grab zone (20px), inner div is the visible 2px line.
           touch-action:none prevents browser gestures on touch screens. */}
      <div
        className="z-10 flex shrink-0 cursor-row-resize items-center justify-center lg:cursor-col-resize"
        style={{ touchAction: "none" }}
        onPointerDown={handleDividerPointerDown}
      >
        {/* Mobile: horizontal grab zone (20px tall, full width) */}
        <div className="flex h-5 w-full -my-2 items-center justify-center lg:hidden">
          <div className={`h-0.5 w-10 rounded-full transition-colors ${dragging ? "bg-accent" : "bg-border hover:bg-muted"}`} />
        </div>
        {/* Desktop: vertical grab zone (20px wide, full height) */}
        <div className="hidden h-full w-5 -mx-1.5 items-center justify-center lg:flex">
          <div className={`h-full w-0.5 transition-colors ${dragging ? "bg-accent" : "bg-border hover:bg-muted"}`} />
        </div>
      </div>

      {/* Chat — on mobile flex-1 fills the column; on desktop lg:flex-none + width pins it */}
      <div
        className="min-h-0 flex-1 border-t border-border lg:h-auto lg:w-[var(--chat-w)] lg:flex-none lg:border-t-0"
        style={{ "--chat-w": `${chatWidth}px` } as React.CSSProperties}
      >
        {username ? (
          <ChatPanel
            channelId={channel.id}
            streamerName={channel.streamer.name}
            username={username}
            onEmote={handleEmote}
            onGesture={setGesture}
            onUserInteraction={handleUserInteraction}
            onGameState={handleGameState}
            onMessageSent={() => {
              bubbleRef.current.showLoading();
              setGesture("uncertain");
            }}
            donations={donations}
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
