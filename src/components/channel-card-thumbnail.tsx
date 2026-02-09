"use client";

import { useRef, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import * as THREE from "three";
import { HeadGeometry } from "./avatar/head-geometry";
import { TEXT_EXPRESSIONS } from "./avatar/face-controller";
import type { EmoteCommand } from "@/lib/types";
import type { HangmanClientData, TwentyQClientData } from "@/lib/games/game-types";

// ── Game preview types ────────────────────────────────────────────────

interface HangmanPreview {
  type: "hangman";
  data: HangmanClientData;
}

interface TwentyQPreview {
  type: "twentyq";
  data: TwentyQClientData;
}

export type GamePreview = HangmanPreview | TwentyQPreview;

// ── Props ─────────────────────────────────────────────────────────────

interface ChannelCardThumbnailProps {
  skinColor: [number, number, number];
  emote: EmoteCommand;
  gamePreview?: GamePreview;
  /** Offset avatar position for variety: [x, y] in world units */
  avatarOffset?: [number, number];
}

// ── Static head: frozen 3D face ───────────────────────────────────────

function StaticHead({
  skinColor,
  emote,
  position,
  scale,
}: {
  skinColor: [number, number, number];
  emote: EmoteCommand;
  position: [number, number, number];
  scale: number;
}) {
  const leftEyeRef = useRef<THREE.Mesh>(null);
  const rightEyeRef = useRef<THREE.Mesh>(null);
  const mouthRef = useRef<THREE.Mesh>(null);

  useEffect(() => {
    const expr = TEXT_EXPRESSIONS[emote];
    if (!expr) return;
    if (leftEyeRef.current) {
      (leftEyeRef.current as unknown as { text: string }).text = expr.leftEye;
    }
    if (rightEyeRef.current) {
      (rightEyeRef.current as unknown as { text: string }).text = expr.rightEye;
    }
    if (mouthRef.current) {
      (mouthRef.current as unknown as { text: string }).text = expr.mouth;
    }
  }, [emote]);

  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight position={[2, 5, 5]} intensity={1.5} />
      <directionalLight position={[-3, -2, 3]} intensity={0.5} color="#4d4d4d" />
      <group position={position} scale={[scale, scale, scale]}>
        <HeadGeometry
          leftEyeRef={leftEyeRef}
          rightEyeRef={rightEyeRef}
          mouthRef={mouthRef}
          skinColor={skinColor}
        />
      </group>
    </>
  );
}

// ── Game board panels (styled like the live GameOverlay) ──────────────

const WARMTH_COLORS = [
  "bg-blue-500",
  "bg-cyan-400",
  "bg-yellow-400",
  "bg-orange-500",
  "bg-red-500",
];

const ANSWER_STYLES: Record<string, string> = {
  YES: "bg-green-100 text-green-700",
  NO: "bg-red-100 text-red-600",
  KINDA: "bg-yellow-100 text-yellow-700",
};

function HangmanPanel({ data }: { data: HangmanClientData }) {
  const wrongLetters = data.guessedLetters.filter(
    (l) => !data.maskedWord.includes(l),
  );
  const correctLetters = data.guessedLetters.filter(
    (l) => data.maskedWord.includes(l),
  );

  return (
    <div className="flex h-full w-full flex-col overflow-hidden rounded-xl bg-white/95 shadow-lg ring-1 ring-black/5">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 px-2.5 py-1.5">
        <span className="text-[9px] font-bold uppercase tracking-wider text-gray-500">
          Hangman
        </span>
        <span className="rounded-full bg-green-100 px-1.5 py-0.5 text-[8px] font-semibold text-green-700">
          LIVE
        </span>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-2 p-2">
        {/* Category */}
        <div className="text-[9px] font-medium uppercase tracking-wider text-gray-400">
          {data.category}
        </div>

        {/* Gallows SVG */}
        <svg viewBox="0 0 200 200" className="h-16 w-16">
          <line x1="40" y1="180" x2="160" y2="180" stroke="#374151" strokeWidth="3" strokeLinecap="round" />
          <line x1="60" y1="180" x2="60" y2="30" stroke="#374151" strokeWidth="3" strokeLinecap="round" />
          <line x1="60" y1="30" x2="120" y2="30" stroke="#374151" strokeWidth="3" strokeLinecap="round" />
          <line x1="120" y1="30" x2="120" y2="50" stroke="#374151" strokeWidth="3" strokeLinecap="round" />
          {data.wrongGuesses >= 1 && <circle cx="120" cy="62" r="12" fill="none" stroke="#1f2937" strokeWidth="2.5" />}
          {data.wrongGuesses >= 2 && <line x1="120" y1="74" x2="120" y2="120" stroke="#1f2937" strokeWidth="2.5" strokeLinecap="round" />}
        </svg>

        {/* Word */}
        <div className="flex items-center gap-1">
          {data.maskedWord.map((ch, i) => (
            <span
              key={i}
              className={`inline-flex h-6 w-[18px] items-center justify-center border-b-2 text-[11px] font-bold ${
                ch === "_"
                  ? "border-gray-400 text-transparent"
                  : "border-gray-700 text-gray-800"
              }`}
            >
              {ch === "_" ? "\u00A0" : ch.toUpperCase()}
            </span>
          ))}
        </div>

        {/* Guessed letters */}
        <div className="flex flex-wrap items-center justify-center gap-0.5">
          {correctLetters.map((l) => (
            <span key={l} className="rounded bg-green-100 px-1 py-0.5 text-[8px] font-semibold text-green-700">
              {l.toUpperCase()}
            </span>
          ))}
          {wrongLetters.map((l) => (
            <span key={l} className="rounded bg-red-100 px-1 py-0.5 text-[8px] font-semibold text-red-500 line-through">
              {l.toUpperCase()}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function TwentyQPanel({ data }: { data: TwentyQClientData }) {
  return (
    <div className="flex h-full w-full flex-col overflow-hidden rounded-xl bg-white/95 shadow-lg ring-1 ring-black/5">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 px-2.5 py-1.5">
        <span className="text-[9px] font-bold uppercase tracking-wider text-gray-500">
          20 Questions
        </span>
        <span className="rounded-full bg-green-100 px-1.5 py-0.5 text-[8px] font-semibold text-green-700">
          LIVE
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-1.5 overflow-hidden p-2">
        {/* Category + counter */}
        <div className="flex items-center justify-between">
          <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider text-purple-700">
            {data.category}
          </span>
          <span className="text-[10px] text-gray-500">
            <span className="font-bold text-gray-700">{data.questionsAsked}</span>
            <span className="text-gray-400">/{data.maxQuestions}</span>
          </span>
        </div>

        {/* Temperature meter */}
        <div className="flex gap-0.5">
          {WARMTH_COLORS.map((color, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-sm ${color} ${
                i < data.warmth ? "opacity-100" : "opacity-20"
              }`}
            />
          ))}
        </div>

        {/* Q&A History */}
        <div className="flex-1 space-y-1 overflow-hidden">
          {data.history.map((entry, i) => (
            <div key={i} className="rounded bg-gray-50 px-1.5 py-1">
              <div className="flex items-start gap-1">
                <span className="shrink-0 text-[8px] font-bold text-gray-400">Q{i + 1}</span>
                <span className="text-[9px] leading-tight text-gray-700">{entry.question}</span>
              </div>
              {entry.answer !== null && (
                <div className="mt-0.5 flex items-center gap-1">
                  <span className={`rounded px-1 py-0.5 text-[8px] font-bold ${ANSWER_STYLES[entry.answer] ?? "bg-gray-100 text-gray-600"}`}>
                    {entry.answer}
                  </span>
                  <div className="flex gap-px">
                    {Array.from({ length: 5 }, (_, j) => (
                      <div
                        key={j}
                        className={`h-1 w-1 rounded-full ${
                          j < entry.warmth ? WARMTH_COLORS[entry.warmth - 1] : "bg-gray-200"
                        }`}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────

export function ChannelCardThumbnail({
  skinColor,
  emote,
  gamePreview,
  avatarOffset,
}: ChannelCardThumbnailProps) {
  // When a game is active, shift avatar left and shrink it (like the live stream does)
  const hasGame = !!gamePreview;
  const avatarPosition: [number, number, number] = hasGame
    ? [-1.6, 0, 0]
    : [avatarOffset?.[0] ?? 0, avatarOffset?.[1] ?? 0, 0];
  const avatarScale = hasGame ? 0.75 : 1;

  return (
    <div className="relative h-48 w-full bg-black">
      {/* 3D avatar canvas */}
      <Canvas
        gl={{ antialias: true, alpha: true }}
        camera={{ fov: 45, position: [0, 0, 5] }}
        frameloop="demand"
        style={{ background: "transparent" }}
      >
        <StaticHead
          skinColor={skinColor}
          emote={emote}
          position={avatarPosition}
          scale={avatarScale}
        />
      </Canvas>

      {/* Game panel overlay — right side, mimicking live GameOverlay */}
      {gamePreview && (
        <div className="absolute right-2 top-2 bottom-2 w-[42%] max-w-[180px]">
          {gamePreview.type === "hangman" && (
            <HangmanPanel data={gamePreview.data} />
          )}
          {gamePreview.type === "twentyq" && (
            <TwentyQPanel data={gamePreview.data} />
          )}
        </div>
      )}
    </div>
  );
}
