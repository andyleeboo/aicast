"use client";

import { useRef, useState, useCallback, useEffect } from "react";

interface UseAudioPlayerOptions {
  onEnd?: () => void;
}

export function useAudioPlayer(options?: UseAudioPlayerOptions) {
  const ctxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const onEndRef = useRef(options?.onEnd);

  // Keep callback ref in sync
  useEffect(() => {
    onEndRef.current = options?.onEnd;
  }, [options?.onEnd]);

  const getContext = useCallback(() => {
    if (!ctxRef.current) {
      ctxRef.current = new AudioContext({ sampleRate: 24000 });
    }
    return ctxRef.current;
  }, []);

  const stop = useCallback(() => {
    if (sourceRef.current) {
      try {
        sourceRef.current.stop();
      } catch {
        // Already stopped
      }
      sourceRef.current = null;
    }
    setIsPlaying(false);
  }, []);

  const play = useCallback(
    async (base64: string) => {
      // Stop any current playback
      stop();

      const ctx = getContext();

      // Resume context if suspended (browser autoplay policy)
      if (ctx.state === "suspended") {
        await ctx.resume();
      }

      // Decode base64 PCM to Float32Array (24kHz, mono, 16-bit signed LE)
      const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
      const samples = new Float32Array(bytes.length / 2);
      const view = new DataView(bytes.buffer);
      for (let i = 0; i < samples.length; i++) {
        samples[i] = view.getInt16(i * 2, true) / 32768;
      }

      const buffer = ctx.createBuffer(1, samples.length, 24000);
      buffer.getChannelData(0).set(samples);

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);

      source.onended = () => {
        sourceRef.current = null;
        setIsPlaying(false);
        onEndRef.current?.();
      };

      sourceRef.current = source;
      setIsPlaying(true);
      setDuration(buffer.duration);
      source.start();
    },
    [stop, getContext],
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (sourceRef.current) {
        try {
          sourceRef.current.stop();
        } catch {
          // Already stopped
        }
      }
      if (ctxRef.current) {
        ctxRef.current.close();
      }
    };
  }, []);

  return { play, stop, isPlaying, duration };
}
