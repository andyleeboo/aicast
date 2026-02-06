"use client";

import { Canvas } from "@react-three/fiber";
import { HeadScene } from "./head-scene";
import type { GestureReaction, EmoteCommand } from "@/lib/types";

interface AvatarCanvasProps {
  gesture: GestureReaction | null;
  onGestureComplete: () => void;
  emote: { command: EmoteCommand; key: number } | null;
  onEmoteComplete: () => void;
}

export function AvatarCanvas({
  gesture,
  onGestureComplete,
  emote,
  onEmoteComplete,
}: AvatarCanvasProps) {
  return (
    <div className="relative h-full w-full">
      {/* Glow effects behind canvas */}
      <div className="absolute inset-0 opacity-30">
        <div className="absolute left-1/4 top-1/4 h-64 w-64 animate-pulse rounded-full bg-accent/10 blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 h-48 w-48 animate-pulse rounded-full bg-accent/5 blur-3xl [animation-delay:1s]" />
      </div>

      <Canvas
        gl={{ antialias: true, alpha: true }}
        camera={{ fov: 45, position: [0, 0, 5] }}
        style={{ background: "transparent" }}
      >
        <HeadScene
          gesture={gesture}
          onGestureComplete={onGestureComplete}
          emote={emote}
          onEmoteComplete={onEmoteComplete}
        />
      </Canvas>
    </div>
  );
}
