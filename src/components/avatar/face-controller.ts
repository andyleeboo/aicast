import * as THREE from "three";
import { fetchGesture, type QuaternionSample } from "./gesture-data";
import type { GestureReaction, EmoteCommand } from "@/lib/types";

// ─── FacePose ────────────────────────────────────────────────────────
// leftLidOpen / rightLidOpen: 1.0 = fully open, 0.0 = fully closed

export interface FacePose {
  headQuat: THREE.Quaternion;
  leftLidOpen: number; // 0 = fully closed, 1 = fully open
  rightLidOpen: number;
  // Text face characters
  leftEyeText: string;
  rightEyeText: string;
  mouthText: string;
  // Legacy numeric fields (kept for gesture/state compatibility)
  mouthOpen: number; // 0 closed → 1 fully open
  mouthWidth: number; // 0.8 narrow → 1.3 wide
  // Unused but kept for state code compatibility
  leftBrowAngle: number;
  rightBrowAngle: number;
  leftBrowY: number;
  rightBrowY: number;
  mouthCurve: number;
  leftPupilOffset: THREE.Vector2;
  rightPupilOffset: THREE.Vector2;
  leftPupilScale: number;
  rightPupilScale: number;
}

// Default face characters
const DEFAULT_EYE_OPEN = "*";
const DEFAULT_EYE_CLOSED = "-";
const DEFAULT_MOUTH = "_";

export function createPose(): FacePose {
  return {
    headQuat: new THREE.Quaternion(),
    leftLidOpen: 1,
    rightLidOpen: 1,
    leftEyeText: DEFAULT_EYE_OPEN,
    rightEyeText: DEFAULT_EYE_OPEN,
    mouthText: DEFAULT_MOUTH,
    mouthOpen: 0,
    mouthWidth: 1,
    leftBrowAngle: 0, rightBrowAngle: 0,
    leftBrowY: 0, rightBrowY: 0,
    mouthCurve: 0,
    leftPupilOffset: new THREE.Vector2(),
    rightPupilOffset: new THREE.Vector2(),
    leftPupilScale: 1, rightPupilScale: 1,
  };
}

export function copyPose(dst: FacePose, src: FacePose): void {
  dst.headQuat.copy(src.headQuat);
  dst.leftLidOpen = src.leftLidOpen;
  dst.rightLidOpen = src.rightLidOpen;
  dst.leftEyeText = src.leftEyeText;
  dst.rightEyeText = src.rightEyeText;
  dst.mouthText = src.mouthText;
  dst.leftBrowAngle = src.leftBrowAngle;
  dst.rightBrowAngle = src.rightBrowAngle;
  dst.leftBrowY = src.leftBrowY;
  dst.rightBrowY = src.rightBrowY;
  dst.mouthCurve = src.mouthCurve;
  dst.mouthOpen = src.mouthOpen;
  dst.mouthWidth = src.mouthWidth;
  dst.leftPupilOffset.copy(src.leftPupilOffset);
  dst.rightPupilOffset.copy(src.rightPupilOffset);
  dst.leftPupilScale = src.leftPupilScale;
  dst.rightPupilScale = src.rightPupilScale;
}

function lerpScalar(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function lerpPose(
  dst: FacePose,
  a: FacePose,
  b: FacePose,
  t: number,
): void {
  dst.headQuat.copy(a.headQuat).slerp(b.headQuat, t);
  dst.leftLidOpen = lerpScalar(a.leftLidOpen, b.leftLidOpen, t);
  dst.rightLidOpen = lerpScalar(a.rightLidOpen, b.rightLidOpen, t);
  // Text fields snap at midpoint (can't interpolate characters)
  dst.leftEyeText = t > 0.5 ? b.leftEyeText : a.leftEyeText;
  dst.rightEyeText = t > 0.5 ? b.rightEyeText : a.rightEyeText;
  dst.mouthText = t > 0.5 ? b.mouthText : a.mouthText;
  dst.leftBrowAngle = lerpScalar(a.leftBrowAngle, b.leftBrowAngle, t);
  dst.rightBrowAngle = lerpScalar(a.rightBrowAngle, b.rightBrowAngle, t);
  dst.leftBrowY = lerpScalar(a.leftBrowY, b.leftBrowY, t);
  dst.rightBrowY = lerpScalar(a.rightBrowY, b.rightBrowY, t);
  dst.mouthCurve = lerpScalar(a.mouthCurve, b.mouthCurve, t);
  dst.mouthOpen = lerpScalar(a.mouthOpen, b.mouthOpen, t);
  dst.mouthWidth = lerpScalar(a.mouthWidth, b.mouthWidth, t);
  dst.leftPupilOffset.lerpVectors(a.leftPupilOffset, b.leftPupilOffset, t);
  dst.rightPupilOffset.lerpVectors(a.rightPupilOffset, b.rightPupilOffset, t);
  dst.leftPupilScale = lerpScalar(a.leftPupilScale, b.leftPupilScale, t);
  dst.rightPupilScale = lerpScalar(a.rightPupilScale, b.rightPupilScale, t);
}

// ─── FaceRig (ref bundle for Three.js objects) ──────────────────────

export interface FaceRig {
  head: THREE.Group;
  leftEye: THREE.Mesh;
  rightEye: THREE.Mesh;
  mouth: THREE.Mesh;
}

/** Reset expression fields to neutral defaults */
function resetExpression(pose: FacePose): void {
  pose.leftLidOpen = 1;
  pose.rightLidOpen = 1;
  pose.leftEyeText = DEFAULT_EYE_OPEN;
  pose.rightEyeText = DEFAULT_EYE_OPEN;
  pose.mouthText = DEFAULT_MOUTH;
  pose.leftBrowAngle = 0;
  pose.rightBrowAngle = 0;
  pose.leftBrowY = 0;
  pose.rightBrowY = 0;
  pose.mouthCurve = 0;
  pose.mouthOpen = 0;
  pose.mouthWidth = 1;
  pose.leftPupilOffset.set(0, 0);
  pose.rightPupilOffset.set(0, 0);
  pose.leftPupilScale = 1;
  pose.rightPupilScale = 1;
}

// ─── Easing helpers ──────────────────────────────────────────────────

function easeOutQuad(t: number): number {
  return 1 - (1 - t) * (1 - t);
}

function easeInQuad(t: number): number {
  return t * t;
}

// ─── Pre-allocated THREE temps (module scope, zero GC) ───────────────

const _axisX = new THREE.Vector3(1, 0, 0);
const _axisY = new THREE.Vector3(0, 1, 0);
const _axisZ = new THREE.Vector3(0, 0, 1);
const _qA = new THREE.Quaternion();
const _qB = new THREE.Quaternion();
const _qSleepTarget = new THREE.Quaternion().setFromAxisAngle(_axisX, -0.44);

// Lid constants: 1.0 = open, 0.0 = closed
const LID_OPEN = 1.0;
const LID_CLOSED = 0.0;

// ─── AnimationState interface ────────────────────────────────────────

interface TransitionRequest {
  nextState: "idle";
  blendOut: number;
}

interface AnimationState {
  readonly name: string;
  readonly controlsEyes: boolean;
  enter(currentPose: FacePose): void;
  update(
    dt: number,
    elapsed: number,
    outPose: FacePose,
  ): TransitionRequest | null;
  exit(): void;
}

// ─── IdleState ───────────────────────────────────────────────────────

class IdleState implements AnimationState {
  readonly name = "idle";
  readonly controlsEyes = false;

  private phaseX = Math.random() * Math.PI * 2;
  private phaseY = Math.random() * Math.PI * 2;
  private phaseZ = Math.random() * Math.PI * 2;
  private timeOffset = 10 + Math.random() * 20;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  enter(currentPose: FacePose): void {
    // wander is continuous via performance.now — nothing to reset
  }

  update(_dt: number, _elapsed: number, outPose: FacePose): null {
    const amp = 0.21;
    const t = performance.now() / 1000 + this.timeOffset;
    const px = this.phaseX;
    const py = this.phaseY;
    const pz = this.phaseZ;

    const pitch =
      amp * (0.6 * Math.sin(0.5 * t + px) + 0.4 * Math.sin(1.1 * t + px + 1.0));
    const yaw =
      amp * (0.6 * Math.sin(0.4 * t + py) + 0.4 * Math.sin(0.9 * t + py + 2.0));
    const roll = amp * 0.3 * Math.sin(0.3 * t + pz);

    _qA.setFromAxisAngle(_axisY, yaw);
    _qB.setFromAxisAngle(_axisX, pitch);
    _qA.multiply(_qB);
    _qB.setFromAxisAngle(_axisZ, roll);
    _qA.multiply(_qB);

    outPose.headQuat.copy(_qA);
    outPose.leftLidOpen = 1;
    outPose.rightLidOpen = 1;
    outPose.leftEyeText = DEFAULT_EYE_OPEN;
    outPose.rightEyeText = DEFAULT_EYE_OPEN;
    outPose.mouthText = DEFAULT_MOUTH;

    // Idle expressions: slight smile, gently raised brows
    outPose.leftBrowAngle = 0.05;
    outPose.rightBrowAngle = 0.05;
    outPose.leftBrowY = 0.01;
    outPose.rightBrowY = 0.01;
    outPose.mouthCurve = 0.2;
    outPose.mouthOpen = 0;
    outPose.mouthWidth = 1;

    // Pupil micro-saccades: slow procedural drift
    const saccadeX = 0.005 * Math.sin(1.7 * t + 3.1) + 0.003 * Math.sin(2.9 * t);
    const saccadeY = 0.004 * Math.sin(1.3 * t + 1.7) + 0.003 * Math.sin(2.3 * t + 0.5);
    outPose.leftPupilOffset.set(saccadeX, saccadeY);
    outPose.rightPupilOffset.set(saccadeX, saccadeY);
    outPose.leftPupilScale = 1;
    outPose.rightPupilScale = 1;

    return null;
  }

  exit(): void {}
}

// ─── GestureState ────────────────────────────────────────────────────

function findSurrounding(
  samples: QuaternionSample[],
  time: number,
): [QuaternionSample, QuaternionSample, number] {
  let lo = 0;
  let hi = samples.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (samples[mid].t <= time) lo = mid;
    else hi = mid;
  }
  const a = samples[lo];
  const b = samples[hi];
  const span = b.t - a.t;
  const frac = span > 0 ? (time - a.t) / span : 0;
  return [a, b, Math.max(0, Math.min(1, frac))];
}

function sampleToQuat(s: QuaternionSample, target: THREE.Quaternion) {
  target.set(s.x, s.y, s.z, s.w);
}

class GestureState implements AnimationState {
  readonly name = "gesture";
  readonly controlsEyes = false;

  private samples: QuaternionSample[] = [];
  private duration = 0;
  gestureType: GestureReaction = "uncertain";

  loadSamples(samples: QuaternionSample[], gestureType: GestureReaction): void {
    this.samples = samples;
    this.duration = samples.length > 0 ? samples[samples.length - 1].t : 0;
    this.gestureType = gestureType;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  enter(currentPose: FacePose): void {
    // controller's crossfade handles blend-in
  }

  private applyGestureExpression(outPose: FacePose): void {
    // Gestures keep default text face
    outPose.leftEyeText = DEFAULT_EYE_OPEN;
    outPose.rightEyeText = DEFAULT_EYE_OPEN;
    outPose.mouthText = DEFAULT_MOUTH;

    switch (this.gestureType) {
      case "yes":
        outPose.leftBrowAngle = 0.15;
        outPose.rightBrowAngle = 0.15;
        outPose.leftBrowY = 0.03;
        outPose.rightBrowY = 0.03;
        outPose.mouthCurve = 0.4;
        outPose.mouthOpen = 0;
        outPose.mouthWidth = 1.1;
        outPose.leftPupilOffset.set(0, 0);
        outPose.rightPupilOffset.set(0, 0);
        outPose.leftPupilScale = 1;
        outPose.rightPupilScale = 1;
        break;
      case "no":
        outPose.leftBrowAngle = -0.1;
        outPose.rightBrowAngle = -0.1;
        outPose.leftBrowY = -0.01;
        outPose.rightBrowY = -0.01;
        outPose.mouthCurve = -0.2;
        outPose.mouthOpen = 0;
        outPose.mouthWidth = 0.9;
        // pupils follow head direction
        outPose.leftPupilOffset.set(0, 0);
        outPose.rightPupilOffset.set(0, 0);
        outPose.leftPupilScale = 1;
        outPose.rightPupilScale = 1;
        break;
      case "uncertain":
        outPose.leftBrowAngle = 0.2;
        outPose.rightBrowAngle = -0.1;
        outPose.leftBrowY = 0.04;
        outPose.rightBrowY = -0.01;
        outPose.mouthCurve = 0;
        outPose.mouthOpen = 0;
        outPose.mouthWidth = 1;
        // look up-left
        outPose.leftPupilOffset.set(-0.01, 0.01);
        outPose.rightPupilOffset.set(-0.01, 0.01);
        outPose.leftPupilScale = 1;
        outPose.rightPupilScale = 1;
        break;
    }
  }

  update(
    _dt: number,
    elapsed: number,
    outPose: FacePose,
  ): TransitionRequest | null {
    const s = this.samples;
    if (s.length === 0) return { nextState: "idle", blendOut: 0 };

    if (elapsed >= this.duration) {
      sampleToQuat(s[s.length - 1], outPose.headQuat);
      outPose.leftLidOpen = LID_OPEN;
      outPose.rightLidOpen = LID_OPEN;
      this.applyGestureExpression(outPose);
      return { nextState: "idle", blendOut: 0.25 };
    }

    const [a, b, frac] = findSurrounding(s, elapsed);
    sampleToQuat(a, _qA);
    sampleToQuat(b, _qB);
    outPose.headQuat.copy(_qA).slerp(_qB, frac);
    outPose.leftLidOpen = LID_OPEN;
    outPose.rightLidOpen = LID_OPEN;
    this.applyGestureExpression(outPose);

    return null;
  }

  exit(): void {
    this.samples = [];
    this.duration = 0;
  }
}

// ─── WinkState ───────────────────────────────────────────────────────

const WINK_CLOSE_DURATION = 0.08; // smooth close for the winking eye
const WINK_TILT_IN = 0.3;
const WINK_HOLD = 2.0;
const WINK_TILT_OUT = 0.3;
const WINK_OPEN_DURATION = 0.08; // smooth open at the end
const WINK_TILT_ANGLE = 0.18;
const WINK_TOTAL = WINK_TILT_IN + WINK_HOLD + WINK_TILT_OUT;

class WinkState implements AnimationState {
  readonly name = "wink";
  readonly controlsEyes = true;

  private entryQuat = new THREE.Quaternion();
  private tiltTarget = new THREE.Quaternion();

  enter(currentPose: FacePose): void {
    this.entryQuat.copy(currentPose.headQuat);
    // tilt target = entry * small Z rotation
    this.tiltTarget
      .copy(this.entryQuat)
      .multiply(new THREE.Quaternion().setFromAxisAngle(_axisZ, WINK_TILT_ANGLE));
  }

  update(
    _dt: number,
    elapsed: number,
    outPose: FacePose,
  ): TransitionRequest | null {
    if (elapsed >= WINK_TOTAL) {
      outPose.headQuat.copy(this.entryQuat);
      resetExpression(outPose);
      outPose.leftLidOpen = LID_OPEN;
      outPose.rightLidOpen = LID_OPEN;
      return { nextState: "idle", blendOut: 0.2 };
    }

    // right eye closed entire time, left eye open
    outPose.rightLidOpen = LID_CLOSED;
    outPose.leftLidOpen = LID_OPEN;

    // Right eye: smooth close at start, smooth open at end, closed during hold
    if (elapsed < WINK_CLOSE_DURATION) {
      // Smoothly close the right eye
      const t = easeOutQuad(elapsed / WINK_CLOSE_DURATION);
      outPose.rightLidOpen = LID_OPEN + (LID_CLOSED - LID_OPEN) * t;
    } else if (elapsed >= WINK_TOTAL - WINK_OPEN_DURATION) {
      // Smoothly re-open the right eye
      const t = easeOutQuad(
        (elapsed - (WINK_TOTAL - WINK_OPEN_DURATION)) / WINK_OPEN_DURATION,
      );
      outPose.rightLidOpen = LID_CLOSED + (LID_OPEN - LID_CLOSED) * t;
    } else {
      outPose.rightLidOpen = LID_CLOSED;
    }

    // Head tilt animation (unchanged logic)
    if (elapsed < WINK_TILT_IN) {
      const t = easeOutQuad(elapsed / WINK_TILT_IN);
      outPose.headQuat.copy(this.entryQuat).slerp(this.tiltTarget, t);
    } else if (elapsed < WINK_TILT_IN + WINK_HOLD) {
      outPose.headQuat.copy(this.tiltTarget);
    } else {
      const t = easeOutQuad(
        (elapsed - WINK_TILT_IN - WINK_HOLD) / WINK_TILT_OUT,
      );
      outPose.headQuat.copy(this.tiltTarget).slerp(this.entryQuat, t);
    }

    // Wink: left eye open, right eye closed, cheeky mouth
    outPose.leftEyeText = DEFAULT_EYE_OPEN;
    outPose.rightEyeText = DEFAULT_EYE_CLOSED;
    outPose.mouthText = "ε";
    outPose.leftBrowAngle = 0.2;
    outPose.rightBrowAngle = -0.05;
    outPose.leftBrowY = 0.04;
    outPose.rightBrowY = 0;
    outPose.mouthCurve = 0.5;
    outPose.mouthOpen = 0;
    outPose.mouthWidth = 1.15;
    outPose.leftPupilOffset.set(0, 0);
    outPose.rightPupilOffset.set(0, 0);
    outPose.leftPupilScale = 1;
    outPose.rightPupilScale = 1;

    return null;
  }

  exit(): void {}
}

// ─── BlinkEmoteState ─────────────────────────────────────────────────

const BLINK_EMOTE_CLOSE = 0.06; // time to close lids
const BLINK_EMOTE_HOLD = 0.06; // hold closed
const BLINK_EMOTE_OPEN = 0.06; // time to re-open
const BLINK_EMOTE_TOTAL =
  BLINK_EMOTE_CLOSE + BLINK_EMOTE_HOLD + BLINK_EMOTE_OPEN;

class BlinkEmoteState implements AnimationState {
  readonly name = "blinkEmote";
  readonly controlsEyes = true;

  private frozenQuat = new THREE.Quaternion();

  enter(currentPose: FacePose): void {
    this.frozenQuat.copy(currentPose.headQuat);
  }

  update(
    _dt: number,
    elapsed: number,
    outPose: FacePose,
  ): TransitionRequest | null {
    outPose.headQuat.copy(this.frozenQuat);
    resetExpression(outPose);

    let lidOpen: number;
    if (elapsed < BLINK_EMOTE_CLOSE) {
      // Closing phase — ease in (accelerate shut)
      const t = easeInQuad(elapsed / BLINK_EMOTE_CLOSE);
      lidOpen = LID_OPEN + (LID_CLOSED - LID_OPEN) * t;
    } else if (elapsed < BLINK_EMOTE_CLOSE + BLINK_EMOTE_HOLD) {
      // Hold closed
      lidOpen = LID_CLOSED;
    } else if (elapsed < BLINK_EMOTE_TOTAL) {
      // Opening phase — ease out (decelerate open)
      const t = easeOutQuad(
        (elapsed - BLINK_EMOTE_CLOSE - BLINK_EMOTE_HOLD) / BLINK_EMOTE_OPEN,
      );
      lidOpen = LID_CLOSED + (LID_OPEN - LID_CLOSED) * t;
    } else {
      outPose.leftLidOpen = LID_OPEN;
      outPose.rightLidOpen = LID_OPEN;
      return { nextState: "idle", blendOut: 0 };
    }

    outPose.leftLidOpen = lidOpen;
    outPose.rightLidOpen = lidOpen;
    return null;
  }

  exit(): void {}
}

// ─── SleepState ──────────────────────────────────────────────────────

const SLEEP_ENTER_DURATION = 0.8;
const SLEEP_EXIT_DURATION = 0.5;

type SleepPhase = "entering" | "sleeping" | "exiting";

class SleepState implements AnimationState {
  readonly name = "sleep";
  readonly controlsEyes = true;

  private phase: SleepPhase = "entering";
  private phaseStart = 0;
  private entryQuat = new THREE.Quaternion();
  private exitStartQuat = new THREE.Quaternion();
  private phaseElapsed = 0;

  sleeping = false;

  enter(currentPose: FacePose): void {
    this.phase = "entering";
    this.phaseStart = 0;
    this.phaseElapsed = 0;
    this.entryQuat.copy(currentPose.headQuat);
    this.sleeping = true;
  }

  wake(): void {
    if (this.phase === "exiting") return;
    this.phase = "exiting";
    this.phaseElapsed = 0;
    // exitStartQuat is set in update when phase changes
  }

  private applySleepExpression(outPose: FacePose): void {
    outPose.leftEyeText = DEFAULT_EYE_CLOSED;
    outPose.rightEyeText = DEFAULT_EYE_CLOSED;
    outPose.mouthText = "﹏";
    outPose.leftBrowAngle = -0.15;
    outPose.rightBrowAngle = -0.15;
    outPose.leftBrowY = -0.03;
    outPose.rightBrowY = -0.03;
    outPose.mouthCurve = 0;
    outPose.mouthOpen = 0.05;
    outPose.mouthWidth = 0.9;
    outPose.leftPupilOffset.set(0, 0);
    outPose.rightPupilOffset.set(0, 0);
    outPose.leftPupilScale = 1;
    outPose.rightPupilScale = 1;
  }

  update(
    _dt: number,
    elapsed: number,
    outPose: FacePose,
  ): TransitionRequest | null {
    // phaseElapsed tracks time within current sub-phase
    if (this.phase === "entering") {
      this.phaseElapsed = elapsed;
    }

    if (this.phase === "entering") {
      const t = Math.min(this.phaseElapsed / SLEEP_ENTER_DURATION, 1);
      const eased = easeInQuad(t);

      outPose.headQuat.copy(this.entryQuat).slerp(_qSleepTarget, eased);

      // Smoothly close eyes over the first 50% of entering
      const lidCloseT = Math.min(t / 0.5, 1.0);
      const lidEased = easeInQuad(lidCloseT);
      const lidVal = LID_OPEN + (LID_CLOSED - LID_OPEN) * lidEased;
      outPose.leftLidOpen = lidVal;
      outPose.rightLidOpen = lidVal;

      this.applySleepExpression(outPose);

      if (t >= 1) {
        this.phase = "sleeping";
        this.phaseStart = elapsed;
      }
      return null;
    }

    if (this.phase === "sleeping") {
      const sleepElapsed = elapsed - this.phaseStart;
      const breathOffset = 0.03 * Math.sin(2 * Math.PI * 0.4 * sleepElapsed);
      _qA.setFromAxisAngle(_axisX, breathOffset);
      outPose.headQuat.copy(_qSleepTarget).multiply(_qA);

      outPose.leftLidOpen = LID_CLOSED;
      outPose.rightLidOpen = LID_CLOSED;
      this.applySleepExpression(outPose);
      return null;
    }

    // exiting
    if (this.phaseElapsed === 0) {
      this.exitStartQuat.copy(outPose.headQuat);
    }
    this.phaseElapsed += _dt;

    const t = Math.min(this.phaseElapsed / SLEEP_EXIT_DURATION, 1);
    const eased = easeOutQuad(t);

    outPose.headQuat.copy(this.exitStartQuat).slerp(_qA.identity(), eased);

    // Smoothly open eyes starting at 30% of exit duration
    const lidOpenT = Math.max(0, (t - 0.3) / 0.7);
    const lidEased = easeOutQuad(Math.min(lidOpenT, 1.0));
    const lidVal = LID_CLOSED + (LID_OPEN - LID_CLOSED) * lidEased;
    outPose.leftLidOpen = lidVal;
    outPose.rightLidOpen = lidVal;

    // Blend expression from sleep to neutral during exit
    if (t < 0.5) {
      this.applySleepExpression(outPose);
    } else {
      resetExpression(outPose);
      // Override lid values since resetExpression sets them to 1
      outPose.leftLidOpen = lidVal;
      outPose.rightLidOpen = lidVal;
    }

    if (t >= 1) {
      this.sleeping = false;
      return { nextState: "idle", blendOut: 0.3 };
    }
    return null;
  }

  exit(): void {
    this.sleeping = false;
  }
}

// ─── Text Expression System ─────────────────────────────────────────

interface TextExpression {
  leftEye: string;
  rightEye: string;
  mouth: string;
}

/**
 * Comprehensive kaomoji expression table.
 * Each key is an EmoteCommand; the value defines the text characters
 * for leftEye, rightEye, and mouth on the avatar face.
 */
export const TEXT_EXPRESSIONS: Record<string, TextExpression> = {
  // ── Core emotions ─────────────────────────────────────────────
  happy:       { leftEye: "^", rightEye: "^", mouth: "ω" },
  sad:         { leftEye: "T", rightEye: "T", mouth: "_" },
  surprised:   { leftEye: "◎", rightEye: "◎", mouth: "○" },
  thinking:    { leftEye: "¬", rightEye: "¬", mouth: "." },
  angry:       { leftEye: "╬", rightEye: "╬", mouth: "益" },
  confused:    { leftEye: "◑", rightEye: "◐", mouth: "?" },
  excited:     { leftEye: "★", rightEye: "★", mouth: "∀" },
  love:        { leftEye: "♥", rightEye: "♥", mouth: "ω" },
  smug:        { leftEye: "￣", rightEye: "￣", mouth: "ε" },
  crying:      { leftEye: "Ṫ", rightEye: "Ṫ", mouth: "Д" },
  laughing:    { leftEye: "≧", rightEye: "≦", mouth: "▽" },
  worried:     { leftEye: "；", rightEye: "；", mouth: "∧" },
  nervous:     { leftEye: "'", rightEye: "'", mouth: "∀" },
  proud:       { leftEye: "⌐", rightEye: "⌐", mouth: "▽" },
  shy:         { leftEye: "╯", rightEye: "╰", mouth: "∧" },
  bored:       { leftEye: "￣", rightEye: "￣", mouth: "ε" },
  tired:       { leftEye: "=", rightEye: "=", mouth: "ω" },
  disgusted:   { leftEye: "ಠ", rightEye: "ಠ", mouth: "_" },
  scared:      { leftEye: "゜", rightEye: "゜", mouth: "Д" },
  determined:  { leftEye: "•̀", rightEye: "•́", mouth: "﹃" },

  // ── Happy variants ────────────────────────────────────────────
  joy:         { leftEye: "◕", rightEye: "◕", mouth: "ᴗ" },
  bliss:       { leftEye: "˘", rightEye: "˘", mouth: "ω" },
  grinning:    { leftEye: "＾", rightEye: "＾", mouth: "▽" },
  cheerful:    { leftEye: "◠", rightEye: "◠", mouth: "◡" },
  gleeful:     { leftEye: "✧", rightEye: "✧", mouth: "▽" },
  delighted:   { leftEye: "ˊ", rightEye: "ˋ", mouth: "ᗜ" },
  euphoric:    { leftEye: "≧", rightEye: "≦", mouth: "◡" },
  content:     { leftEye: "ᵕ", rightEye: "ᵕ", mouth: "ᴗ" },
  radiant:     { leftEye: "☆", rightEye: "☆", mouth: "∀" },
  playful:     { leftEye: "◕", rightEye: "◕", mouth: "ε" },

  // ── Sad variants ──────────────────────────────────────────────
  heartbroken: { leftEye: "╥", rightEye: "╥", mouth: "∩" },
  melancholy:  { leftEye: "ᵕ̣̣", rightEye: "ᵕ̣̣", mouth: "。" },
  sobbing:     { leftEye: "இ", rightEye: "இ", mouth: "Д" },
  gloomy:      { leftEye: "ˊ", rightEye: "ˋ", mouth: "ω" },
  depressed:   { leftEye: "⌒", rightEye: "⌒", mouth: "_" },
  lonely:      { leftEye: "；", rightEye: "；", mouth: "ω" },
  disappointed:{ leftEye: "ˋ", rightEye: "ˊ", mouth: "ε" },
  weeping:     { leftEye: "╯", rightEye: "╰", mouth: "Д" },
  moping:      { leftEye: "−", rightEye: "−", mouth: "ε" },
  miserable:   { leftEye: "Ⱥ", rightEye: "Ⱥ", mouth: "﹏" },

  // ── Angry variants ────────────────────────────────────────────
  furious:     { leftEye: "╬", rightEye: "╬", mouth: "Д" },
  irritated:   { leftEye: "¬", rightEye: "¬", mouth: "益" },
  annoyed:     { leftEye: "¬", rightEye: "¬", mouth: "ε" },
  raging:      { leftEye: "╬", rightEye: "╬", mouth: "皿" },
  grumpy:      { leftEye: "ˋ", rightEye: "ˊ", mouth: "益" },
  hostile:     { leftEye: "▼", rightEye: "▼", mouth: "益" },
  seething:    { leftEye: "╬", rightEye: "╬", mouth: "∀" },
  frustrated:  { leftEye: "≧", rightEye: "≦", mouth: "﹏" },
  indignant:   { leftEye: "ˋ", rightEye: "ˊ", mouth: "_" },
  cranky:      { leftEye: "−", rightEye: "−", mouth: "﹏" },

  // ── Surprise variants ─────────────────────────────────────────
  shocked:     { leftEye: "⊙", rightEye: "⊙", mouth: "Д" },
  amazed:      { leftEye: "✧", rightEye: "✧", mouth: "○" },
  astonished:  { leftEye: "◉", rightEye: "◉", mouth: "□" },
  startled:    { leftEye: "゜", rightEye: "゜", mouth: "ロ" },
  speechless:  { leftEye: "◎", rightEye: "◎", mouth: " " },
  stunned:     { leftEye: "⊙", rightEye: "⊙", mouth: "ロ" },
  flabbergasted:{ leftEye: "Ꙫ", rightEye: "Ꙫ", mouth: "□" },
  awed:        { leftEye: "☆", rightEye: "☆", mouth: "○" },
  dumbfounded: { leftEye: "⊙", rightEye: "⊙", mouth: "_" },
  bewildered:  { leftEye: "◑", rightEye: "◐", mouth: "□" },

  // ── Love/affection ────────────────────────────────────────────
  adoring:     { leftEye: "♡", rightEye: "♡", mouth: "ᴗ" },
  crushing:    { leftEye: "♥", rightEye: "♥", mouth: "ᴗ" },
  smitten:     { leftEye: "♡", rightEye: "♡", mouth: "ω" },
  lovestruck:  { leftEye: "❤", rightEye: "❤", mouth: "∀" },
  infatuated:  { leftEye: "♥", rightEye: "♥", mouth: "ε" },
  yearning:    { leftEye: "♡", rightEye: "♡", mouth: "ε" },
  charmed:     { leftEye: "˘", rightEye: "˘", mouth: "ε" },
  devoted:     { leftEye: "♥", rightEye: "♥", mouth: "◡" },
  tender:      { leftEye: "ᵕ", rightEye: "ᵕ", mouth: "ω" },
  warm:        { leftEye: "◠", rightEye: "◠", mouth: "ω" },

  // ── Smug/confident ────────────────────────────────────────────
  sassy:       { leftEye: "￣", rightEye: "￣", mouth: "∀" },
  cocky:       { leftEye: "⌐", rightEye: "⌐", mouth: "ε" },
  superior:    { leftEye: "⌐", rightEye: "⌐", mouth: "ω" },
  victorious:  { leftEye: "≧", rightEye: "≦", mouth: "∀" },
  triumphant:  { leftEye: "★", rightEye: "★", mouth: "▽" },
  cheeky:      { leftEye: "◕", rightEye: "◕", mouth: "ε" },
  mischievous: { leftEye: "¬", rightEye: "¬", mouth: "ω" },
  devious:     { leftEye: "¬", rightEye: "¬", mouth: "▽" },
  brazen:      { leftEye: "⌐", rightEye: "⌐", mouth: "▽" },
  sly:         { leftEye: "−", rightEye: "−", mouth: "ε" },

  // ── Confused/thinking ─────────────────────────────────────────
  puzzled:     { leftEye: "◑", rightEye: "◐", mouth: "ε" },
  pondering:   { leftEye: "ˋ", rightEye: "ˊ", mouth: "ω" },
  curious:     { leftEye: "◕", rightEye: "◕", mouth: "?" },
  skeptical:   { leftEye: "ˋ", rightEye: "ˊ", mouth: "_" },
  questioning: { leftEye: "?", rightEye: "?", mouth: "ω" },
  perplexed:   { leftEye: "◎", rightEye: "◎", mouth: "?" },
  dubious:     { leftEye: "ˋ", rightEye: "ˊ", mouth: "﹏" },
  uncertain:   { leftEye: "；", rightEye: "；", mouth: "ε" },
  clueless:    { leftEye: "？", rightEye: "？", mouth: "ω" },
  contemplating:{ leftEye: "ˋ", rightEye: "ˊ", mouth: "。" },

  // ── Scared/nervous ────────────────────────────────────────────
  terrified:   { leftEye: "⊙", rightEye: "⊙", mouth: "Д" },
  anxious:     { leftEye: "；", rightEye: "；", mouth: "﹏" },
  panicked:    { leftEye: "゜", rightEye: "゜", mouth: "□" },
  spooked:     { leftEye: "⊙", rightEye: "⊙", mouth: "∧" },
  uneasy:      { leftEye: "'", rightEye: "'", mouth: "﹏" },
  dread:       { leftEye: "⊙", rightEye: "⊙", mouth: "﹏" },
  timid:       { leftEye: "；", rightEye: "；", mouth: "∧" },
  petrified:   { leftEye: "Ꙫ", rightEye: "Ꙫ", mouth: "Д" },
  jumpy:       { leftEye: "゜", rightEye: "゜", mouth: "∀" },
  creepedout:  { leftEye: "⊙", rightEye: "⊙", mouth: "ε" },

  // ── Cute/kawaii ────────────────────────────────────────────────
  uwu:         { leftEye: "◕", rightEye: "◕", mouth: "ᴗ" },
  sparkles:    { leftEye: "✧", rightEye: "✧", mouth: "ω" },
  kawaii:      { leftEye: "◕", rightEye: "◕", mouth: "ω" },
  innocent:    { leftEye: "◕", rightEye: "◕", mouth: "。" },
  bubbly:      { leftEye: "◠", rightEye: "◠", mouth: "▽" },
  adorable:    { leftEye: "˘", rightEye: "˘", mouth: "ᴗ" },
  puppy:       { leftEye: "◕", rightEye: "◕", mouth: "∧" },
  cutesy:      { leftEye: "✿", rightEye: "✿", mouth: "ω" },
  dainty:      { leftEye: "˘", rightEye: "˘", mouth: "◡" },
  sweet:       { leftEye: "◠", rightEye: "◠", mouth: "ᴗ" },

  // ── Silly/goofy ───────────────────────────────────────────────
  derp:        { leftEye: "◑", rightEye: "◐", mouth: "ω" },
  goofy:       { leftEye: "◑", rightEye: "◐", mouth: "▽" },
  zany:        { leftEye: "✧", rightEye: "◑", mouth: "▽" },
  wacky:       { leftEye: "≧", rightEye: "◑", mouth: "∀" },
  silly:       { leftEye: "◕", rightEye: "◑", mouth: "ε" },
  bonkers:     { leftEye: "★", rightEye: "◑", mouth: "Д" },
  nutty:       { leftEye: "◎", rightEye: "◑", mouth: "ω" },
  dorky:       { leftEye: "◕", rightEye: "◕", mouth: "ε" },
  loopy:       { leftEye: "◑", rightEye: "◐", mouth: "∀" },
  clowning:    { leftEye: "★", rightEye: "☆", mouth: "▽" },

  // ── Cool/confident ────────────────────────────────────────────
  cool:        { leftEye: "■", rightEye: "■", mouth: "ε" },
  chill:       { leftEye: "−", rightEye: "−", mouth: "ω" },
  suave:       { leftEye: "￣", rightEye: "￣", mouth: "ω" },
  aloof:       { leftEye: "−", rightEye: "−", mouth: "_" },
  nonchalant:  { leftEye: "￣", rightEye: "￣", mouth: "_" },
  confident:   { leftEye: "⌐", rightEye: "⌐", mouth: "∀" },
  smooth:      { leftEye: "−", rightEye: "−", mouth: "∀" },
  composed:    { leftEye: "−", rightEye: "−", mouth: "◡" },
  unfazed:     { leftEye: "￣", rightEye: "￣", mouth: "◡" },
  stoic:       { leftEye: "−", rightEye: "−", mouth: "。" },

  // ── Tired/sleepy ──────────────────────────────────────────────
  drowsy:      { leftEye: "=", rightEye: "=", mouth: "﹏" },
  exhausted:   { leftEye: "×", rightEye: "×", mouth: "﹏" },
  sleepy:      { leftEye: "˘", rightEye: "˘", mouth: "﹏" },
  yawning:     { leftEye: "=", rightEye: "=", mouth: "○" },
  fatigued:    { leftEye: "=", rightEye: "=", mouth: "_" },
  zonked:      { leftEye: "×", rightEye: "×", mouth: "_" },
  drained:     { leftEye: "−", rightEye: "−", mouth: "﹏" },
  lethargic:   { leftEye: "=", rightEye: "=", mouth: "ε" },
  weary:       { leftEye: "−", rightEye: "=", mouth: "﹏" },
  dazed:       { leftEye: "◎", rightEye: "◎", mouth: "。" },

  // ── Disgust/discomfort ────────────────────────────────────────
  grossed:     { leftEye: "ಠ", rightEye: "ಠ", mouth: "益" },
  repulsed:    { leftEye: "ಠ", rightEye: "ಠ", mouth: "Д" },
  nauseated:   { leftEye: "×", rightEye: "×", mouth: "﹏" },
  cringing:    { leftEye: "⌒", rightEye: "⌒", mouth: "∧" },
  uncomfortable:{ leftEye: "；", rightEye: "；", mouth: "_" },
  appalled:    { leftEye: "ಠ", rightEye: "ಠ", mouth: "□" },
  yikes:       { leftEye: "⊙", rightEye: "⊙", mouth: "﹏" },
  eww:         { leftEye: "ಠ", rightEye: "ಠ", mouth: "﹏" },
  ick:         { leftEye: "×", rightEye: "×", mouth: "益" },
  queasy:      { leftEye: "；", rightEye: "；", mouth: "﹏" },

  // ── Special/dramatic ──────────────────────────────────────────
  dead:        { leftEye: "×", rightEye: "×", mouth: "_" },
  mindblown:   { leftEye: "⊙", rightEye: "⊙", mouth: "○" },
  facepalm:    { leftEye: "−", rightEye: "−", mouth: "﹏" },
  shrug:       { leftEye: "￣", rightEye: "￣", mouth: "∀" },
  judging:     { leftEye: "ಠ", rightEye: "ಠ", mouth: "_" },
  plotting:    { leftEye: "¬", rightEye: "¬", mouth: "ε" },
  suspicious:  { leftEye: "¬", rightEye: "¬", mouth: "_" },
  pouting:     { leftEye: "◕", rightEye: "◕", mouth: "3" },
  flirty:      { leftEye: "◕", rightEye: "-", mouth: "ε" },
  daydreaming: { leftEye: "˘", rightEye: "˘", mouth: "。" },
  zen:         { leftEye: "￣", rightEye: "￣", mouth: "。" },
  hyper:       { leftEye: "☆", rightEye: "☆", mouth: "▽" },
  dramatic:    { leftEye: "◉", rightEye: "◉", mouth: "Д" },
  sarcastic:   { leftEye: "￣", rightEye: "￣", mouth: "ε" },
  starstruck:  { leftEye: "★", rightEye: "★", mouth: "○" },
  grateful:    { leftEye: "◕", rightEye: "◕", mouth: "◡" },
  hopeful:     { leftEye: "◕", rightEye: "◕", mouth: "ᴗ" },
  nostalgic:   { leftEye: "ˋ", rightEye: "ˊ", mouth: "ω" },
  peaceful:    { leftEye: "˘", rightEye: "˘", mouth: "◡" },
  fierce:      { leftEye: "▼", rightEye: "▼", mouth: "∀" },
};

// ─── ExpressionEmoteState ────────────────────────────────────────────

const EXPRESSION_BLEND_IN = 0.2;
const EXPRESSION_HOLD = 3.5;
const EXPRESSION_BLEND_OUT = 0.3;
const EXPRESSION_TOTAL = EXPRESSION_BLEND_IN + EXPRESSION_HOLD + EXPRESSION_BLEND_OUT;

class ExpressionEmoteState implements AnimationState {
  readonly name = "expression";
  readonly controlsEyes = true; // controls eyes since we change eye text

  private expressionKey = "happy";
  private frozenQuat = new THREE.Quaternion();

  setExpression(key: string): void {
    this.expressionKey = key;
  }

  enter(currentPose: FacePose): void {
    this.frozenQuat.copy(currentPose.headQuat);
  }

  update(
    _dt: number,
    elapsed: number,
    outPose: FacePose,
  ): TransitionRequest | null {
    const expr = TEXT_EXPRESSIONS[this.expressionKey];
    if (!expr) {
      resetExpression(outPose);
      outPose.headQuat.copy(this.frozenQuat);
      return { nextState: "idle", blendOut: 0.2 };
    }

    if (elapsed >= EXPRESSION_TOTAL) {
      resetExpression(outPose);
      outPose.headQuat.copy(this.frozenQuat);
      return { nextState: "idle", blendOut: 0.2 };
    }

    outPose.headQuat.copy(this.frozenQuat);

    // Snap text at blend-in threshold
    if (elapsed >= EXPRESSION_BLEND_IN * 0.3) {
      outPose.leftEyeText = expr.leftEye;
      outPose.rightEyeText = expr.rightEye;
      outPose.mouthText = expr.mouth;
      outPose.leftLidOpen = 1;
      outPose.rightLidOpen = 1;
    } else {
      outPose.leftEyeText = DEFAULT_EYE_OPEN;
      outPose.rightEyeText = DEFAULT_EYE_OPEN;
      outPose.mouthText = DEFAULT_MOUTH;
      outPose.leftLidOpen = 1;
      outPose.rightLidOpen = 1;
    }

    // Snap back to default near end
    if (elapsed > EXPRESSION_BLEND_IN + EXPRESSION_HOLD + EXPRESSION_BLEND_OUT * 0.7) {
      outPose.leftEyeText = DEFAULT_EYE_OPEN;
      outPose.rightEyeText = DEFAULT_EYE_OPEN;
      outPose.mouthText = DEFAULT_MOUTH;
    }

    return null;
  }

  exit(): void {}
}

// ─── FaceController ──────────────────────────────────────────────────

export interface UpdateResult {
  gestureCompleted: boolean;
  emoteCompleted: boolean;
}

// Idle blink timing
const IDLE_BLINK_CLOSE = 0.05; // time to close
const IDLE_BLINK_HOLD = 0.04; // hold shut
const IDLE_BLINK_OPEN = 0.06; // time to re-open
const IDLE_BLINK_TOTAL = IDLE_BLINK_CLOSE + IDLE_BLINK_HOLD + IDLE_BLINK_OPEN;

export class FaceController {
  // States (persistent singletons)
  private idleState = new IdleState();
  private gestureState = new GestureState();
  private winkState = new WinkState();
  private blinkEmoteState = new BlinkEmoteState();
  private sleepState = new SleepState();
  private expressionEmoteState = new ExpressionEmoteState();

  // Active state
  private activeState: AnimationState = this.idleState;
  private stateElapsed = 0;

  // Crossfade
  private blending = false;
  private blendDuration = 0;
  private blendElapsed = 0;
  private frozenPose: FacePose = createPose();
  private livePose: FacePose = createPose();
  private outputPose: FacePose = createPose();

  // Idle blink overlay (runs when activeState.controlsEyes === false)
  private nextBlinkTime = 3 + Math.random() * 2;
  private blinkStart = -1;

  // Entrance animation
  private entranceStart = -1;
  private entranceDone = false;
  private readonly ENTRANCE_DURATION = 0.6;

  // Speaking state (set externally each frame)
  isSpeakingFlag = false;

  constructor() {
    this.idleState.enter(this.outputPose);
  }

  get isSleeping(): boolean {
    return this.sleepState.sleeping;
  }

  // ── Transitions ──────────────────────────────────────────────

  private transitionTo(state: AnimationState, blendDuration: number): void {
    this.activeState.exit();

    // Freeze current output as blend source
    copyPose(this.frozenPose, this.outputPose);

    state.enter(this.outputPose);
    this.activeState = state;
    this.stateElapsed = 0;

    if (blendDuration > 0) {
      this.blending = true;
      this.blendDuration = blendDuration;
      this.blendElapsed = 0;
    } else {
      this.blending = false;
    }
  }

  private transitionToIdle(blendDuration: number): void {
    this.transitionTo(this.idleState, blendDuration);
  }

  // ── Public API ───────────────────────────────────────────────

  async playGesture(gesture: GestureReaction): Promise<void> {
    const recording = await fetchGesture(gesture);
    this.gestureState.loadSamples(recording.samples, gesture);
    this.transitionTo(this.gestureState, 0.25);
  }

  triggerEmote(command: EmoteCommand): void {
    if (command === "sleep") {
      this.transitionTo(this.sleepState, 0);
      return;
    }

    if (command === "wake") {
      if (this.activeState === this.sleepState) {
        this.sleepState.wake();
      }
      return;
    }

    if (command === "wink") {
      this.transitionTo(this.winkState, 0.15);
      return;
    }

    if (command === "blink") {
      this.transitionTo(this.blinkEmoteState, 0);
      return;
    }

    // Text expression emotes — any key in TEXT_EXPRESSIONS
    if (command in TEXT_EXPRESSIONS) {
      this.expressionEmoteState.setExpression(command);
      this.transitionTo(this.expressionEmoteState, 0.15);
      return;
    }
  }

  // ── Per-frame update ─────────────────────────────────────────

  update(dt: number, rig: FaceRig): UpdateResult {
    const result: UpdateResult = { gestureCompleted: false, emoteCompleted: false };

    // Clamp delta to prevent jumps on tab re-focus
    const clampedDt = Math.min(dt, 0.1);
    const now = performance.now() / 1000;

    // Entrance animation
    if (!this.entranceDone) {
      if (this.entranceStart < 0) this.entranceStart = now;
      const elapsed = now - this.entranceStart;
      const t = Math.min(elapsed / this.ENTRANCE_DURATION, 1);
      const s = easeOutQuad(t);
      rig.head.scale.set(s, s, s);
      if (t >= 1) this.entranceDone = true;
      return result;
    }

    // Advance state
    this.stateElapsed += clampedDt;
    const request = this.activeState.update(
      clampedDt,
      this.stateElapsed,
      this.livePose,
    );

    // Apply crossfade
    if (this.blending) {
      this.blendElapsed += clampedDt;
      const t = Math.min(this.blendElapsed / this.blendDuration, 1);
      const eased = easeOutQuad(t);
      lerpPose(this.outputPose, this.frozenPose, this.livePose, eased);
      if (t >= 1) this.blending = false;
    } else {
      copyPose(this.outputPose, this.livePose);
    }

    // Handle transition requests from the state
    if (request) {
      const wasGesture = this.activeState === this.gestureState;
      const wasEmote =
        this.activeState === this.winkState ||
        this.activeState === this.blinkEmoteState ||
        this.activeState === this.sleepState ||
        this.activeState === this.expressionEmoteState;

      this.transitionToIdle(request.blendOut);

      if (wasGesture) result.gestureCompleted = true;
      if (wasEmote) result.emoteCompleted = true;
    }

    // Idle blink overlay (when active state doesn't control eyes)
    if (!this.activeState.controlsEyes) {
      if (this.blinkStart < 0) {
        if (now > this.nextBlinkTime) {
          this.blinkStart = now;
        }
      }

      if (this.blinkStart >= 0) {
        const blinkElapsed = now - this.blinkStart;

        if (blinkElapsed < IDLE_BLINK_CLOSE) {
          // Closing
          const t = easeInQuad(blinkElapsed / IDLE_BLINK_CLOSE);
          const lidVal = LID_OPEN + (LID_CLOSED - LID_OPEN) * t;
          this.outputPose.leftLidOpen = lidVal;
          this.outputPose.rightLidOpen = lidVal;
        } else if (blinkElapsed < IDLE_BLINK_CLOSE + IDLE_BLINK_HOLD) {
          // Hold closed
          this.outputPose.leftLidOpen = LID_CLOSED;
          this.outputPose.rightLidOpen = LID_CLOSED;
        } else if (blinkElapsed < IDLE_BLINK_TOTAL) {
          // Opening
          const t = easeOutQuad(
            (blinkElapsed - IDLE_BLINK_CLOSE - IDLE_BLINK_HOLD) /
              IDLE_BLINK_OPEN,
          );
          const lidVal = LID_CLOSED + (LID_OPEN - LID_CLOSED) * t;
          this.outputPose.leftLidOpen = lidVal;
          this.outputPose.rightLidOpen = lidVal;
        } else {
          // Blink finished
          this.outputPose.leftLidOpen = LID_OPEN;
          this.outputPose.rightLidOpen = LID_OPEN;
          this.blinkStart = -1;
          this.nextBlinkTime = now + 3 + Math.random() * 2;
        }
      }
    }

    // Speaking overlay: alternate mouth text when speaking
    if (this.isSpeakingFlag && this.activeState !== this.sleepState) {
      const speakCycle = Math.sin(now * 12);
      this.outputPose.mouthText = speakCycle > 0 ? "○" : DEFAULT_MOUTH;
    }

    // ── Write pose to Three.js objects ──────────────────────────
    const p = this.outputPose;

    rig.head.quaternion.copy(p.headQuat);

    // Eyes: use text from pose, but override with closed char when lid is shut
    const le = rig.leftEye as unknown as { text: string };
    const re = rig.rightEye as unknown as { text: string };
    le.text = p.leftLidOpen > 0.5 ? p.leftEyeText : DEFAULT_EYE_CLOSED;
    re.text = p.rightLidOpen > 0.5 ? p.rightEyeText : DEFAULT_EYE_CLOSED;

    // Mouth: use text from pose, override when speaking
    const mo = rig.mouth as unknown as { text: string };
    mo.text = p.mouthText;

    return result;
  }
}
