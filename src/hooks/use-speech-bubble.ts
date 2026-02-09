"use client";

import { useState, useCallback, useRef } from "react";

export interface UseSpeechBubbleReturn {
  /** Current bubble text. `null` = hidden, `"..."` = loading indicator. */
  text: string | null;
  /** Whether Bob is actively speaking (controls glow ring). */
  isSpeaking: boolean;

  /** Show real response text immediately (decoupled from audio). */
  showResponse: (text: string) => void;
  /** Show text scaled to reading duration — for muted viewers (no audio). */
  showForReading: (text: string) => void;
  /** Show "..." loading indicator. */
  showLoading: () => void;
  /** Audio/speech playback started — activates glow, cancels any auto-clear. */
  speakingStarted: () => void;
  /** Audio/speech playback ended — deactivates glow, starts linger timer. */
  speakingEnded: () => void;
  /** Force-clear bubble and all timers. */
  clear: () => void;
  /** Show a maintenance message that persists until clearMaintenance(). */
  showMaintenance: (msg: string) => void;
  /** Exit maintenance mode and clear the bubble. */
  clearMaintenance: () => void;
}

/** Duration the bubble lingers after speech ends (ms). */
const LINGER_MS = 2000;
/** Minimum auto-clear time for muted/no-audio path (ms). */
const MIN_READ_MS = 5000;
/** Per-character reading time — gives ~75 WPM reading speed (ms). */
const MS_PER_CHAR = 80;
/** Safety net: if speaking never starts/ends, auto-clear after this (ms). */
const SAFETY_NET_MS = 15_000;

export function useSpeechBubble(): UseSpeechBubbleReturn {
  const [text, setText] = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const lingerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const safetyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const readTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const maintenanceRef = useRef(false);
  const responseTextRef = useRef<string | null>(null);

  const clearAllTimers = useCallback(() => {
    if (lingerTimer.current) { clearTimeout(lingerTimer.current); lingerTimer.current = null; }
    if (safetyTimer.current) { clearTimeout(safetyTimer.current); safetyTimer.current = null; }
    if (readTimer.current) { clearTimeout(readTimer.current); readTimer.current = null; }
  }, []);

  const clear = useCallback(() => {
    clearAllTimers();
    setText(null);
    setIsSpeaking(false);
    responseTextRef.current = null;
  }, [clearAllTimers]);

  const showLoading = useCallback(() => {
    clearAllTimers();
    setText("...");
    // Safety net: auto-clear "..." if server never responds (matches showResponse pattern)
    safetyTimer.current = setTimeout(() => {
      if (!maintenanceRef.current) {
        setText(null);
        setIsSpeaking(false);
      }
    }, SAFETY_NET_MS);
  }, [clearAllTimers]);

  const showResponse = useCallback((response: string) => {
    clearAllTimers();
    setText(response);
    responseTextRef.current = response;

    // Safety net: if speakingStarted/speakingEnded never fire,
    // auto-clear after SAFETY_NET_MS so the bubble doesn't stick forever.
    safetyTimer.current = setTimeout(() => {
      if (!maintenanceRef.current) {
        setText(null);
        setIsSpeaking(false);
      }
    }, SAFETY_NET_MS);
  }, [clearAllTimers]);

  const showForReading = useCallback((response: string) => {
    clearAllTimers();
    setText(response);

    const duration = Math.max(MIN_READ_MS, response.length * MS_PER_CHAR);
    readTimer.current = setTimeout(() => {
      if (!maintenanceRef.current) setText(null);
    }, duration);
  }, [clearAllTimers]);

  const speakingStarted = useCallback(() => {
    setIsSpeaking(true);
    // Cancel all auto-clear timers — speech is active, bubble stays
    if (safetyTimer.current) { clearTimeout(safetyTimer.current); safetyTimer.current = null; }
    if (lingerTimer.current) { clearTimeout(lingerTimer.current); lingerTimer.current = null; }
    if (readTimer.current) { clearTimeout(readTimer.current); readTimer.current = null; }
  }, []);

  const speakingEnded = useCallback(() => {
    setIsSpeaking(false);
    if (safetyTimer.current) { clearTimeout(safetyTimer.current); safetyTimer.current = null; }
    if (readTimer.current) { clearTimeout(readTimer.current); readTimer.current = null; }

    // Keep text visible after speech ends — scale linger to text length
    const charCount = responseTextRef.current?.length ?? 0;
    const linger = Math.max(LINGER_MS, charCount * MS_PER_CHAR);
    if (lingerTimer.current) clearTimeout(lingerTimer.current);
    lingerTimer.current = setTimeout(() => {
      if (!maintenanceRef.current) setText(null);
    }, linger);
  }, []);

  const showMaintenance = useCallback((msg: string) => {
    clearAllTimers();
    maintenanceRef.current = true;
    setText(msg);
  }, [clearAllTimers]);

  const clearMaintenance = useCallback(() => {
    maintenanceRef.current = false;
    clear();
  }, [clear]);

  return {
    text,
    isSpeaking,
    showResponse,
    showForReading,
    showLoading,
    speakingStarted,
    speakingEnded,
    clear,
    showMaintenance,
    clearMaintenance,
  };
}
