/* eslint-disable react-hooks/immutability */
import { useRef, useMemo, useCallback, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { FaceController, type FaceRig, type ScenePose } from "./face-controller";
import type { GestureReaction, EmoteCommand } from "@/lib/types";

interface UseFaceAnimationOptions {
  headRef: React.RefObject<THREE.Group | null>;
  leftEyeRef: React.RefObject<THREE.Mesh | null>;
  rightEyeRef: React.RefObject<THREE.Mesh | null>;
  mouthRef: React.RefObject<THREE.Mesh | null>;
  onGestureComplete: () => void;
  onEmoteComplete: () => void;
  isSpeaking: boolean;
}

export function useFaceAnimation({
  headRef,
  leftEyeRef,
  rightEyeRef,
  mouthRef,
  onGestureComplete,
  onEmoteComplete,
  isSpeaking,
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
    const leftEye = leftEyeRef.current;
    const rightEye = rightEyeRef.current;
    const mouth = mouthRef.current;
    if (!head || !leftEye || !rightEye || !mouth) return;

    const rig: FaceRig = { head, leftEye, rightEye, mouth };

    controller.isSpeakingFlag = isSpeaking;
    const result = controller.update(delta, rig);
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

  const setScenePose = useCallback(
    (pose: Partial<ScenePose>) => {
      controller.setScenePose(pose);
    },
    [controller],
  );

  const resetScenePose = useCallback(() => {
    controller.resetScenePose();
  }, [controller]);

  return { playGesture, triggerEmote, isSleeping, setScenePose, resetScenePose };
}
