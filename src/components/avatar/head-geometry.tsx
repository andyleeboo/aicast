import { forwardRef, useMemo } from "react";
import * as THREE from "three";
import { LID_OPEN_ANGLE } from "./face-controller";

// ─── Pre-created materials (module scope, zero GC) ───────────────────

const skinMaterial = new THREE.MeshPhongMaterial({
  color: new THREE.Color(0.95, 0.85, 0.75),
});
const eyeMaterial = new THREE.MeshPhongMaterial({
  color: new THREE.Color(0.2, 0.2, 0.25),
});
const noseMaterial = new THREE.MeshPhongMaterial({
  color: new THREE.Color(0.9, 0.75, 0.65),
});
const earOuterMaterial = new THREE.MeshPhongMaterial({
  color: new THREE.Color(0.9, 0.78, 0.68),
});
const earInnerMaterial = new THREE.MeshPhongMaterial({
  color: new THREE.Color(0.85, 0.65, 0.55),
});
// Eyelid uses the same color as the head skin
const lidMaterial = new THREE.MeshPhongMaterial({
  color: new THREE.Color(0.95, 0.85, 0.75),
  side: THREE.DoubleSide, // visible from inside when lid swings over eye
});

// ─── Eyelid geometry constants ───────────────────────────────────────
//
// Eye sphere: radius 0.08, positioned at y=0.15 relative to face group.
// Eyelid pivot: at the top of the eye (y = 0.15 + 0.08 = 0.23).
// The lid is a thin curved shell (partial sphere) that hangs from the pivot.
// When rotated around local X by LID_OPEN_ANGLE, it hides above/behind the eye.
// When rotated to LID_CLOSED_ANGLE, it covers the front of the eye.

const EYE_RADIUS = 0.08;
const EYE_Y = 0.15; // eye center Y within face group
const EYE_Z = 0.1; // eye center Z within face group
const LID_RADIUS = 0.095; // slightly larger than the eye to sit on top
const LID_PIVOT_Y = EYE_Y + EYE_RADIUS; // top of the eye = 0.23

// The lid mesh hangs below its pivot. The mesh origin is at the pivot point.
// The shell extends downward (negative local Y) to cover the eye.

interface HeadGeometryProps {
  leftEyeRef: React.RefObject<THREE.Mesh | null>;
  rightEyeRef: React.RefObject<THREE.Mesh | null>;
  leftLidRef: React.RefObject<THREE.Group | null>;
  rightLidRef: React.RefObject<THREE.Group | null>;
}

/**
 * Creates a partial sphere geometry to serve as an eyelid shell.
 * The geometry is a hemisphere-like arc centered at the origin,
 * extending downward to cover an eye below it.
 *
 * phiStart/phiLength control the horizontal sweep (full width of eye).
 * thetaStart/thetaLength control the vertical sweep (top-down arc).
 *
 * The shell is positioned so its "top" is at the origin (the pivot point),
 * and it arcs downward.
 */
function createLidGeometry(): THREE.BufferGeometry {
  // SphereGeometry with limited theta range to make a shell cap
  // theta: 0 = north pole (+Y), PI = south pole (-Y)
  // We want a shell from roughly the equator up to a bit past it,
  // but since the pivot is at the top of the eye and the lid hangs down,
  // we create the shell so it covers ~180 degrees of arc downward.
  //
  // After creation, we translate the geometry so the top of the arc
  // is at the local origin (the pivot point).

  const widthSegments = 16;
  const heightSegments = 8;

  // Create a partial sphere:
  // phi: horizontal sweep - slightly wider than the eye
  const phiStart = Math.PI * 0.15; // start slightly inward from the full circle
  const phiLength = Math.PI * 0.7; // ~126 degree sweep across

  // theta: vertical sweep from top
  const thetaStart = 0; // start from top
  const thetaLength = Math.PI * 0.55; // sweep down ~99 degrees

  const geo = new THREE.SphereGeometry(
    LID_RADIUS,
    widthSegments,
    heightSegments,
    phiStart,
    phiLength,
    thetaStart,
    thetaLength,
  );

  // The sphere is centered at origin with +Y up. The north pole (theta=0)
  // is at (0, LID_RADIUS, 0). We want the pivot at that top point, so
  // translate everything down by LID_RADIUS so the north pole sits at origin.
  geo.translate(0, -LID_RADIUS, 0);

  // Rotate the geometry 90 degrees around Y so the shell faces +Z (toward camera)
  // The partial sphere phi sweep is around Y axis, and by default faces +X.
  // We need it facing +Z (the front of the face).
  geo.rotateY(Math.PI * 0.5);

  return geo;
}

export const HeadGeometry = forwardRef<THREE.Group, HeadGeometryProps>(
  function HeadGeometry({ leftEyeRef, rightEyeRef, leftLidRef, rightLidRef }, ref) {
    // Create lid geometry once (shared between both lids)
    const lidGeometry = useMemo(() => createLidGeometry(), []);

    return (
      <group ref={ref}>
        {/* Head sphere */}
        <mesh material={skinMaterial}>
          <sphereGeometry args={[1.0, 64, 64]} />
        </mesh>

        {/* Face group - positioned on front of head */}
        <group position={[0, 0, 0.85]}>
          {/* Left eye */}
          <mesh
            ref={leftEyeRef}
            position={[-0.25, EYE_Y, EYE_Z]}
            material={eyeMaterial}
          >
            <sphereGeometry args={[EYE_RADIUS, 16, 16]} />
          </mesh>

          {/* Left eyelid — pivot at top of left eye */}
          <group
            ref={leftLidRef}
            position={[-0.25, LID_PIVOT_Y, EYE_Z]}
            rotation={[LID_OPEN_ANGLE, 0, 0]}
          >
            <mesh geometry={lidGeometry} material={lidMaterial} />
          </group>

          {/* Right eye */}
          <mesh
            ref={rightEyeRef}
            position={[0.25, EYE_Y, EYE_Z]}
            material={eyeMaterial}
          >
            <sphereGeometry args={[EYE_RADIUS, 16, 16]} />
          </mesh>

          {/* Right eyelid — pivot at top of right eye */}
          <group
            ref={rightLidRef}
            position={[0.25, LID_PIVOT_Y, EYE_Z]}
            rotation={[LID_OPEN_ANGLE, 0, 0]}
          >
            <mesh geometry={lidGeometry} material={lidMaterial} />
          </group>

          {/* Nose - cylinder as truncated cone, rotated -90deg on X */}
          <mesh
            position={[0, -0.05, 0.15]}
            rotation={[-Math.PI / 2, 0, 0]}
            material={noseMaterial}
          >
            <cylinderGeometry args={[0.02, 0.06, 0.15, 16]} />
          </mesh>
        </group>

        {/* Left ear */}
        <group position={[-0.95, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          {/* Outer */}
          <mesh material={earOuterMaterial}>
            <capsuleGeometry args={[0.25, 0.2, 8, 16]} />
          </mesh>
          {/* Inner */}
          <mesh position={[0.08, 0, 0.05]} material={earInnerMaterial}>
            <capsuleGeometry args={[0.12, 0.11, 8, 16]} />
          </mesh>
        </group>

        {/* Right ear */}
        <group position={[0.95, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          {/* Outer */}
          <mesh material={earOuterMaterial}>
            <capsuleGeometry args={[0.25, 0.2, 8, 16]} />
          </mesh>
          {/* Inner */}
          <mesh position={[-0.08, 0, 0.05]} material={earInnerMaterial}>
            <capsuleGeometry args={[0.12, 0.11, 8, 16]} />
          </mesh>
        </group>
      </group>
    );
  },
);
