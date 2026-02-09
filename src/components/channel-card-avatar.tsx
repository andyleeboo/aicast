"use client";

import { useRef, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import * as THREE from "three";
import { HeadGeometry } from "./avatar/head-geometry";
import { TEXT_EXPRESSIONS } from "./avatar/face-controller";
import type { EmoteCommand } from "@/lib/types";

interface ChannelCardAvatarProps {
  skinColor: [number, number, number];
  emote: EmoteCommand;
  /** Head rotation [yaw, pitch] in radians for variety */
  headAngle?: [number, number];
}

function StaticHeadZoomed({
  skinColor,
  emote,
  headAngle,
}: {
  skinColor: [number, number, number];
  emote: EmoteCommand;
  headAngle?: [number, number];
}) {
  const leftEyeRef = useRef<THREE.Mesh>(null);
  const rightEyeRef = useRef<THREE.Mesh>(null);
  const mouthRef = useRef<THREE.Mesh>(null);
  const headRef = useRef<THREE.Group>(null);

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
    if (headRef.current && headAngle) {
      headRef.current.rotation.set(headAngle[1], headAngle[0], 0);
    }
  }, [emote, headAngle]);

  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight position={[2, 5, 5]} intensity={1.5} />
      <directionalLight position={[-3, -2, 3]} intensity={0.5} color="#4d4d4d" />
      <group ref={headRef}>
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

export function ChannelCardAvatar({ skinColor, emote, headAngle }: ChannelCardAvatarProps) {
  return (
    <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full ring-2 ring-border">
      <Canvas
        gl={{ antialias: true, alpha: true }}
        camera={{ fov: 45, position: [0, 0.1, 3.2] }}
        frameloop="demand"
        style={{ background: "transparent" }}
      >
        <StaticHeadZoomed skinColor={skinColor} emote={emote} headAngle={headAngle} />
      </Canvas>
    </div>
  );
}
