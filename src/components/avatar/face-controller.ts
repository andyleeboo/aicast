import * as THREE from "three";
import { fetchGesture, type QuaternionSample } from "./gesture-data";
import type { GestureReaction, EmoteCommand } from "@/lib/types";

// ─── FacePose ────────────────────────────────────────────────────────
// leftLidOpen / rightLidOpen: 1.0 = fully open, 0.0 = fully closed

export interface FacePose {
  headQuat: THREE.Quaternion;
  leftLidOpen: number;
  rightLidOpen: number;
}

export function createPose(): FacePose {
  return {
    headQuat: new THREE.Quaternion(),
    leftLidOpen: 1.0,
    rightLidOpen: 1.0,
  };
}

export function copyPose(dst: FacePose, src: FacePose): void {
  dst.headQuat.copy(src.headQuat);
  dst.leftLidOpen = src.leftLidOpen;
  dst.rightLidOpen = src.rightLidOpen;
}

export function lerpPose(
  dst: FacePose,
  a: FacePose,
  b: FacePose,
  t: number,
): void {
  dst.headQuat.copy(a.headQuat).slerp(b.headQuat, t);
  dst.leftLidOpen = a.leftLidOpen + (b.leftLidOpen - a.leftLidOpen) * t;
  dst.rightLidOpen = a.rightLidOpen + (b.rightLidOpen - a.rightLidOpen) * t;
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

// Eyelid rotation mapping: lidOpen [0..1] -> rotation around X-axis (radians)
// lidOpen=1 -> lid tipped back behind eye top (hidden)
// lidOpen=0 -> lid swung down over the eye (covering it)
export const LID_OPEN_ANGLE = -1.2; // radians — lid tipped back behind eye top
export const LID_CLOSED_ANGLE = 0.15; // radians — lid just past vertical covering eye

/** Convert a lidOpen value [0..1] to an X-axis rotation angle for the eyelid mesh. */
export function lidOpenToAngle(lidOpen: number): number {
  return LID_CLOSED_ANGLE + (LID_OPEN_ANGLE - LID_CLOSED_ANGLE) * lidOpen;
}

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
    outPose.leftLidOpen = LID_OPEN;
    outPose.rightLidOpen = LID_OPEN;

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

  loadSamples(samples: QuaternionSample[]): void {
    this.samples = samples;
    this.duration = samples.length > 0 ? samples[samples.length - 1].t : 0;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  enter(currentPose: FacePose): void {
    // controller's crossfade handles blend-in
  }

  update(
    _dt: number,
    elapsed: number,
    outPose: FacePose,
  ): TransitionRequest | null {
    const s = this.samples;
    if (s.length === 0) return { nextState: "idle", blendOut: 0 };

    if (elapsed >= this.duration) {
      // hold last sample pose for crossfade to pick up
      sampleToQuat(s[s.length - 1], outPose.headQuat);
      outPose.leftLidOpen = LID_OPEN;
      outPose.rightLidOpen = LID_OPEN;
      return { nextState: "idle", blendOut: 0.25 };
    }

    const [a, b, frac] = findSurrounding(s, elapsed);
    sampleToQuat(a, _qA);
    sampleToQuat(b, _qB);
    outPose.headQuat.copy(_qA).slerp(_qB, frac);
    outPose.leftLidOpen = LID_OPEN;
    outPose.rightLidOpen = LID_OPEN;

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
      // hold entry pose for crossfade
      outPose.headQuat.copy(this.entryQuat);
      outPose.leftLidOpen = LID_OPEN;
      outPose.rightLidOpen = LID_OPEN;
      return { nextState: "idle", blendOut: 0.2 };
    }

    // Left eye stays open
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

      if (t >= 1) {
        this.phase = "sleeping";
        this.phaseStart = elapsed;
      }
      return null;
    }

    if (this.phase === "sleeping") {
      const sleepElapsed = elapsed - this.phaseStart;
      // breathing: multiply small pitch offset onto sleep target
      const breathOffset = 0.03 * Math.sin(2 * Math.PI * 0.4 * sleepElapsed);
      _qA.setFromAxisAngle(_axisX, breathOffset);
      outPose.headQuat.copy(_qSleepTarget).multiply(_qA);

      outPose.leftLidOpen = LID_CLOSED;
      outPose.rightLidOpen = LID_CLOSED;
      return null;
    }

    // exiting
    if (this.phaseElapsed === 0) {
      // first frame of exit — capture current head pose
      this.exitStartQuat.copy(outPose.headQuat);
    }
    this.phaseElapsed += _dt;

    const t = Math.min(this.phaseElapsed / SLEEP_EXIT_DURATION, 1);
    const eased = easeOutQuad(t);

    // SLERP toward identity (so crossfade to idle wander handles the rest)
    outPose.headQuat.copy(this.exitStartQuat).slerp(_qA.identity(), eased);

    // Smoothly open eyes starting at 30% of exit duration
    const lidOpenT = Math.max(0, (t - 0.3) / 0.7);
    const lidEased = easeOutQuad(Math.min(lidOpenT, 1.0));
    const lidVal = LID_CLOSED + (LID_OPEN - LID_CLOSED) * lidEased;
    outPose.leftLidOpen = lidVal;
    outPose.rightLidOpen = lidVal;

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
    this.gestureState.loadSamples(recording.samples);
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
  }

  // ── Per-frame update ─────────────────────────────────────────

  update(
    dt: number,
    head: THREE.Group,
    leftLid: THREE.Group,
    rightLid: THREE.Group,
  ): UpdateResult {
    const result: UpdateResult = {
      gestureCompleted: false,
      emoteCompleted: false,
    };

    // Clamp delta to prevent jumps on tab re-focus
    const clampedDt = Math.min(dt, 0.1);
    const now = performance.now() / 1000;

    // Entrance animation
    if (!this.entranceDone) {
      if (this.entranceStart < 0) this.entranceStart = now;
      const elapsed = now - this.entranceStart;
      const t = Math.min(elapsed / this.ENTRANCE_DURATION, 1);
      const s = easeOutQuad(t);
      head.scale.set(s, s, s);
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
        this.activeState === this.sleepState;

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

    // Write to Three.js objects
    head.quaternion.copy(this.outputPose.headQuat);
    leftLid.rotation.x = lidOpenToAngle(this.outputPose.leftLidOpen);
    rightLid.rotation.x = lidOpenToAngle(this.outputPose.rightLidOpen);

    return result;
  }
}
