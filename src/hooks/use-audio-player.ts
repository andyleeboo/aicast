"use client";

import { useRef, useState, useCallback, useEffect } from "react";

interface UseAudioPlayerOptions {
  onEnd?: () => void;
  onError?: (err: unknown) => void;
}

/**
 * Streaming audio player that queues base64 PCM chunks and plays them
 * sequentially. Each chunk plays as soon as the previous one finishes.
 *
 * - `enqueue(base64)` — add a chunk to the playback queue
 * - `markStreamEnd()` — signal that no more chunks will arrive; fires `onEnd` after last chunk
 * - `play(base64)` — legacy single-shot playback (stops current stream, plays one buffer)
 * - `stop()` — stop all playback and clear the queue
 */
export function useAudioPlayer(options?: UseAudioPlayerOptions) {
  const ctxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const queueRef = useRef<AudioBuffer[]>([]);
  const streamEndRef = useRef(false);
  const playingRef = useRef(false);
  const playNextRef = useRef<() => void>(() => {});
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const onEndRef = useRef(options?.onEnd);
  const onErrorRef = useRef(options?.onError);

  useEffect(() => {
    onEndRef.current = options?.onEnd;
    onErrorRef.current = options?.onError;
  }, [options?.onEnd, options?.onError]);

  const getContext = useCallback(() => {
    if (!ctxRef.current || ctxRef.current.state === "closed") {
      ctxRef.current = new AudioContext({ sampleRate: 24000 });
    }
    return ctxRef.current;
  }, []);

  const warmup = useCallback(() => {
    const ctx = getContext();
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }
  }, [getContext]);

  /** Decode base64 PCM (24kHz mono 16-bit signed LE) into an AudioBuffer. */
  const decodeChunk = useCallback(
    (base64: string): AudioBuffer => {
      const ctx = getContext();
      const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
      const samples = new Float32Array(bytes.length / 2);
      const view = new DataView(bytes.buffer);
      for (let i = 0; i < samples.length; i++) {
        samples[i] = view.getInt16(i * 2, true) / 32768;
      }
      const buffer = ctx.createBuffer(1, samples.length, 24000);
      buffer.getChannelData(0).set(samples);
      return buffer;
    },
    [getContext],
  );

  /** Play the next buffer in the queue. Uses ref for recursive self-calls. */
  const playNext = useCallback(() => {
    const ctx = getContext();
    const buffer = queueRef.current.shift();

    if (!buffer) {
      // Queue empty — if stream is done, fire onEnd
      if (streamEndRef.current) {
        playingRef.current = false;
        setIsPlaying(false);
        streamEndRef.current = false;
        onEndRef.current?.();
      } else {
        // Waiting for more chunks
        playingRef.current = false;
      }
      return;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);

    source.onended = () => {
      sourceRef.current = null;
      playNextRef.current();
    };

    sourceRef.current = source;
    playingRef.current = true;
    setIsPlaying(true);
    setDuration((d) => d + buffer.duration);
    source.start();
  }, [getContext]);

  // Keep the ref in sync so the onended callback always calls the latest version
  useEffect(() => {
    playNextRef.current = playNext;
  }, [playNext]);

  /** Add a base64 PCM chunk to the playback queue. Starts playback if not already playing. */
  const enqueue = useCallback(
    async (base64: string) => {
      try {
        const ctx = getContext();
        if (ctx.state === "suspended") {
          await ctx.resume();
        }

        const buffer = decodeChunk(base64);
        queueRef.current.push(buffer);

        // Start playback if not already running
        if (!playingRef.current) {
          setIsPlaying(true);
          playNext();
        }
      } catch (err) {
        console.error("[audio] Chunk decode/enqueue failed:", err);
        onErrorRef.current?.(err);
      }
    },
    [getContext, decodeChunk, playNext],
  );

  /** Signal that no more chunks will arrive. Fires onEnd after the last queued chunk finishes. */
  const markStreamEnd = useCallback(() => {
    streamEndRef.current = true;
    // If nothing is playing, fire onEnd immediately
    if (!playingRef.current && queueRef.current.length === 0) {
      setIsPlaying(false);
      onEndRef.current?.();
    }
  }, []);

  const stop = useCallback(() => {
    // Clear the queue
    queueRef.current = [];
    streamEndRef.current = false;
    playingRef.current = false;

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

  /** Legacy single-shot playback (stops stream, plays one full buffer). */
  const play = useCallback(
    async (base64: string) => {
      stop();
      await enqueue(base64);
      markStreamEnd();
    },
    [stop, enqueue, markStreamEnd],
  );

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

  return { play, enqueue, markStreamEnd, stop, warmup, isPlaying, duration };
}
