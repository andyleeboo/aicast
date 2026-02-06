import { useRef, useEffect } from "react";
import * as THREE from "three";
import { HeadGeometry } from "./head-geometry";
import { useFaceAnimation } from "./use-face-animation";
import type { ScenePose } from "./face-controller";
import type { GestureReaction, EmoteCommand } from "@/lib/types";

interface HeadSceneProps {
  gesture: GestureReaction | null;
  onGestureComplete: () => void;
  emote: { command: EmoteCommand; key: number } | null;
  onEmoteComplete: () => void;
  isSpeaking: boolean;
  scenePose?: Partial<ScenePose> | null;
}

export function HeadScene({
  gesture,
  onGestureComplete,
  emote,
  onEmoteComplete,
  isSpeaking,
  scenePose,
}: HeadSceneProps) {
  const headRef = useRef<THREE.Group>(null);
  const leftEyeRef = useRef<THREE.Mesh>(null);
  const rightEyeRef = useRef<THREE.Mesh>(null);
  const mouthRef = useRef<THREE.Mesh>(null);

  const { playGesture, triggerEmote, isSleeping, setScenePose, resetScenePose } =
    useFaceAnimation({
      headRef,
      leftEyeRef,
      rightEyeRef,
      mouthRef,
      onGestureComplete,
      onEmoteComplete,
      isSpeaking,
    });

  // Trigger gestures (skip during sleep)
  useEffect(() => {
    if (gesture && !isSleeping.current) {
      playGesture(gesture);
    }
  }, [gesture, playGesture, isSleeping]);

  // Trigger emotes
  useEffect(() => {
    if (emote) {
      triggerEmote(emote.command);
    }
  }, [emote, triggerEmote]);

  // Apply scene pose changes
  useEffect(() => {
    if (scenePose) {
      setScenePose(scenePose);
    } else {
      resetScenePose();
    }
  }, [scenePose, setScenePose, resetScenePose]);

  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight position={[2, 5, 5]} intensity={1.5} />
      <directionalLight
        position={[-3, -2, 3]}
        intensity={0.5}
        color="#4d4d4d"
      />

      <HeadGeometry
        ref={headRef}
        leftEyeRef={leftEyeRef}
        rightEyeRef={rightEyeRef}
        mouthRef={mouthRef}
      />
    </>
  );
}
