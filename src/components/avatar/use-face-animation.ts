import { useRef, useMemo, useCallback, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { FaceController } from "./face-controller";
import type { GestureReaction, EmoteCommand } from "@/lib/types";

interface UseFaceAnimationOptions {
  headRef: React.RefObject<THREE.Group | null>;
  leftLidRef: React.RefObject<THREE.Group | null>;
  rightLidRef: React.RefObject<THREE.Group | null>;
  onGestureComplete: () => void;
  onEmoteComplete: () => void;
}

export function useFaceAnimation({
  headRef,
  leftLidRef,
  rightLidRef,
  onGestureComplete,
  onEmoteComplete,
}: UseFaceAnimationOptions) {
  const controller = useMemo(() => new FaceController(), []);
  const isSleeping = useRef(false);

  // Refs to hold latest callbacks (avoids mutating the controller)
  const gestureCompleteCb = useRef(onGestureComplete);
  const emoteCompleteCb = useRef(onEmoteComplete);
  useEffect(() => {
    gestureCompleteCb.current = onGestureComplete;
    emoteCompleteCb.current = onEmoteComplete;
  }, [onGestureComplete, onEmoteComplete]);

  // Single useFrame — the ONLY place Three.js objects are mutated
  useFrame((_, delta) => {
    const head = headRef.current;
    const leftLid = leftLidRef.current;
    const rightLid = rightLidRef.current;
    if (!head || !leftLid || !rightLid) return;

    const result = controller.update(delta, head, leftLid, rightLid);
    isSleeping.current = controller.isSleeping;

    if (result.gestureCompleted) gestureCompleteCb.current();
    if (result.emoteCompleted) emoteCompleteCb.current();
  });

  const playGesture = useCallback(
    (gesture: GestureReaction) => {
      controller.playGesture(gesture);
    },
    [controller],
  );

  const triggerEmote = useCallback(
    (command: EmoteCommand) => {
      controller.triggerEmote(command);
    },
    [controller],
  );

  return { playGesture, triggerEmote, isSleeping };
}
