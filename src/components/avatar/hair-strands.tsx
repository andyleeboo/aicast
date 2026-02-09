import { useRef, useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

// ─── Configuration ───────────────────────────────────────────────────

const SEGMENTS = 4;
const SEG_LEN = 0.1;
const BASE_RADIUS = 0.025;
const TIP_RADIUS = 0.008;

// Beard uses thinner strands
const BEARD_BASE_RADIUS = 0.018;
const BEARD_TIP_RADIUS = 0.005;
const BEARD_SEG_LEN = 0.08;

// Spring physics
const SPRING_K = 28;
const DAMPING = 4.2;
const INERTIA = 2.8;

interface StrandDef {
  pos: [number, number, number];
  restPitch: number; // per-joint forward curl
  restRoll: number; // per-joint lateral curl
  baseRot?: [number, number, number]; // euler rotation at strand root
  beard?: boolean; // uses beard geometry
}

const PI = Math.PI;

const STRANDS: StrandDef[] = [
  // ═══════════════════════════════════════════
  // HEAD HAIR
  // ═══════════════════════════════════════════

  // ── Front tuft (dense cluster) ──
  { pos: [0, 0.97, 0.22], restPitch: 0.2, restRoll: 0 },
  { pos: [-0.08, 0.96, 0.24], restPitch: 0.22, restRoll: -0.04 },
  { pos: [0.08, 0.96, 0.24], restPitch: 0.22, restRoll: 0.04 },
  { pos: [-0.16, 0.94, 0.2], restPitch: 0.18, restRoll: -0.08 },
  { pos: [0.16, 0.94, 0.2], restPitch: 0.18, restRoll: 0.08 },

  // ── Mid row ──
  { pos: [0, 0.98, 0.1], restPitch: 0.1, restRoll: 0 },
  { pos: [-0.12, 0.97, 0.12], restPitch: 0.12, restRoll: -0.06 },
  { pos: [0.12, 0.97, 0.12], restPitch: 0.12, restRoll: 0.06 },
  { pos: [-0.22, 0.93, 0.1], restPitch: 0.1, restRoll: -0.12 },
  { pos: [0.22, 0.93, 0.1], restPitch: 0.1, restRoll: 0.12 },

  // ── Crown ──
  { pos: [0, 0.99, 0], restPitch: 0.05, restRoll: 0 },
  { pos: [-0.1, 0.98, -0.02], restPitch: 0.04, restRoll: -0.06 },
  { pos: [0.1, 0.98, -0.02], restPitch: 0.04, restRoll: 0.06 },

  // ── Side wisps ──
  { pos: [-0.3, 0.88, 0.08], restPitch: 0.08, restRoll: -0.2 },
  { pos: [0.3, 0.88, 0.08], restPitch: 0.08, restRoll: 0.2 },
  { pos: [-0.32, 0.85, -0.05], restPitch: 0.04, restRoll: -0.22 },
  { pos: [0.32, 0.85, -0.05], restPitch: 0.04, restRoll: 0.22 },

  // ── Back ──
  { pos: [0, 0.96, -0.12], restPitch: -0.08, restRoll: 0 },
  { pos: [-0.14, 0.94, -0.1], restPitch: -0.06, restRoll: -0.05 },
  { pos: [0.14, 0.94, -0.1], restPitch: -0.06, restRoll: 0.05 },

  // ═══════════════════════════════════════════
  // BEARD (flipped to hang downward)
  // ═══════════════════════════════════════════

  // ── Chin center ──
  { pos: [0, -0.48, 0.86], restPitch: -0.06, restRoll: 0, baseRot: [PI, 0, 0], beard: true },
  { pos: [0, -0.55, 0.82], restPitch: -0.04, restRoll: 0, baseRot: [PI, 0, 0], beard: true },
  { pos: [-0.06, -0.52, 0.84], restPitch: -0.05, restRoll: 0.03, baseRot: [PI, 0, 0], beard: true },
  { pos: [0.06, -0.52, 0.84], restPitch: -0.05, restRoll: -0.03, baseRot: [PI, 0, 0], beard: true },

  // ── Jaw sides ──
  { pos: [-0.18, -0.42, 0.82], restPitch: -0.04, restRoll: 0.08, baseRot: [PI, 0, 0], beard: true },
  { pos: [0.18, -0.42, 0.82], restPitch: -0.04, restRoll: -0.08, baseRot: [PI, 0, 0], beard: true },
  { pos: [-0.28, -0.32, 0.78], restPitch: -0.03, restRoll: 0.12, baseRot: [PI, 0, 0], beard: true },
  { pos: [0.28, -0.32, 0.78], restPitch: -0.03, restRoll: -0.12, baseRot: [PI, 0, 0], beard: true },

  // ── Under chin (longer strands) ──
  { pos: [-0.1, -0.56, 0.78], restPitch: -0.03, restRoll: 0.04, baseRot: [PI, 0, 0], beard: true },
  { pos: [0.1, -0.56, 0.78], restPitch: -0.03, restRoll: -0.04, baseRot: [PI, 0, 0], beard: true },
];

// ─── Default hair color (overridden by props) ──────────────────────

// Tapered cylinder per segment depth — hair
const hairGeoms = Array.from({ length: SEGMENTS }, (_, i) => {
  const rBottom = THREE.MathUtils.lerp(BASE_RADIUS, TIP_RADIUS, i / SEGMENTS);
  const rTop = THREE.MathUtils.lerp(BASE_RADIUS, TIP_RADIUS, (i + 1) / SEGMENTS);
  return new THREE.CylinderGeometry(rTop, rBottom, SEG_LEN, 6);
});

// Tapered cylinder per segment depth — beard (thinner, shorter)
const beardGeoms = Array.from({ length: SEGMENTS }, (_, i) => {
  const rBottom = THREE.MathUtils.lerp(BEARD_BASE_RADIUS, BEARD_TIP_RADIUS, i / SEGMENTS);
  const rTop = THREE.MathUtils.lerp(BEARD_BASE_RADIUS, BEARD_TIP_RADIUS, (i + 1) / SEGMENTS);
  return new THREE.CylinderGeometry(rTop, rBottom, BEARD_SEG_LEN, 6);
});

const _wq = new THREE.Quaternion();
const _dq = new THREE.Quaternion();
const _eu = new THREE.Euler();

// ─── Physics state per joint ────────────────────────────────────────

interface JointPhysics {
  ax: number; // angle X (pitch)
  az: number; // angle Z (lateral)
  vx: number;
  vz: number;
}

// ─── HairStrands ────────────────────────────────────────────────────

interface HairStrandsProps {
  hairColor?: [number, number, number];
  showBeard?: boolean;
}

export function HairStrands({ hairColor = [0.16, 0.12, 0.1], showBeard = true }: HairStrandsProps) {
  const rootRef = useRef<THREE.Group>(null);
  const headObj = useRef<THREE.Object3D | null>(null);
  const prevQ = useRef(new THREE.Quaternion());

  const hairMaterial = useMemo(
    () =>
      new THREE.MeshPhongMaterial({
        color: new THREE.Color(...hairColor),
        shininess: 40,
      }),
    [hairColor],
  );

  const activeStrands = useMemo(
    () => (showBeard ? STRANDS : STRANDS.filter((s) => !s.beard)),
    [showBeard],
  );

  // Joint group refs: [strand][segment]
  const jointRefs = useRef<(THREE.Group | null)[][]>(
    activeStrands.map(() => Array(SEGMENTS).fill(null)),
  );

  // Spring state: [strand][segment]
  const physics = useRef<JointPhysics[][]>(
    activeStrands.map((s) =>
      Array.from({ length: SEGMENTS }, () => ({
        ax: s.restPitch,
        az: s.restRoll,
        vx: 0,
        vz: 0,
      })),
    ),
  );

  // Re-init physics and refs when active strands change
  useEffect(() => {
    jointRefs.current = activeStrands.map(() => Array(SEGMENTS).fill(null));
    physics.current = activeStrands.map((s) =>
      Array.from({ length: SEGMENTS }, () => ({
        ax: s.restPitch,
        az: s.restRoll,
        vx: 0,
        vz: 0,
      })),
    );
  }, [activeStrands]);

  // Stable ref callbacks — created once per activeStrands set, sets initial rest rotation
  const refCbs = useMemo(
    () =>
      activeStrands.map((s, si) =>
        Array.from(
          { length: SEGMENTS },
          (_, d) => (g: THREE.Group | null) => {
            jointRefs.current[si][d] = g;
            if (g) {
              g.rotation.x = s.restPitch;
              g.rotation.z = s.restRoll;
            }
          },
        ),
      ),
    [activeStrands],
  );

  useFrame((_, delta) => {
    // Lazy-init: find head group (our parent) on first frame
    if (!headObj.current) {
      const parent = rootRef.current?.parent;
      if (!parent) return;
      headObj.current = parent;
      prevQ.current.copy(parent.quaternion);
      return;
    }

    const dt = Math.min(delta, 0.05);

    // Head angular velocity in local space: deltaQ = prevQ⁻¹ * currQ
    _wq.copy(headObj.current.quaternion);
    _dq.copy(prevQ.current).invert().multiply(_wq);
    _eu.setFromQuaternion(_dq, "XYZ");
    const hvx = _eu.x / dt; // pitch velocity
    const hvy = _eu.y / dt; // yaw velocity
    prevQ.current.copy(_wq);

    for (let s = 0; s < activeStrands.length; s++) {
      const def = activeStrands[s];
      const ph = physics.current[s];

      for (let j = 0; j < SEGMENTS; j++) {
        const p = ph[j];
        const grp = jointRefs.current[s][j];
        if (!grp) continue;

        // Tip segments react more strongly (0.2 → 1.0)
        const tipFactor = (j + 1) / SEGMENTS;

        // Spring toward rest + damping + head inertia
        p.vx +=
          (-SPRING_K * (p.ax - def.restPitch) -
            DAMPING * p.vx -
            hvx * INERTIA * tipFactor) *
          dt;
        p.vz +=
          (-SPRING_K * (p.az - def.restRoll) -
            DAMPING * p.vz +
            hvy * INERTIA * tipFactor) *
          dt;

        p.ax += p.vx * dt;
        p.az += p.vz * dt;

        grp.rotation.x = p.ax;
        grp.rotation.z = p.az;
      }
    }
  });

  return (
    <group ref={rootRef}>
      {activeStrands.map((strand, si) => (
        <group key={si} position={strand.pos} rotation={strand.baseRot}>
          <ChainSegment depth={0} refs={refCbs[si]} beard={!!strand.beard} material={hairMaterial} />
        </group>
      ))}
    </group>
  );
}

// ─── Recursive chain segment ────────────────────────────────────────

interface ChainSegmentProps {
  depth: number;
  refs: ((g: THREE.Group | null) => void)[];
  beard: boolean;
  material: THREE.Material;
}

function ChainSegment({ depth, refs, beard, material }: ChainSegmentProps) {
  const geoms = beard ? beardGeoms : hairGeoms;
  const len = beard ? BEARD_SEG_LEN : SEG_LEN;

  return (
    <group ref={refs[depth]}>
      <mesh
        position={[0, len / 2, 0]}
        material={material}
        geometry={geoms[depth]}
      />
      {depth < SEGMENTS - 1 && (
        <group position={[0, len, 0]}>
          <ChainSegment depth={depth + 1} refs={refs} beard={beard} material={material} />
        </group>
      )}
    </group>
  );
}
