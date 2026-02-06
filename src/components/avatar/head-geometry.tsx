import { forwardRef } from "react";
import * as THREE from "three";
import { Text } from "@react-three/drei";

// curveRadius is a valid troika-three-text prop but not in drei's TS types
const CURVE_PROPS = { curveRadius: 1.0 } as Record<string, unknown>;

// Pre-create materials to avoid re-creation on every render
const skinMaterial = new THREE.MeshPhongMaterial({
  color: new THREE.Color(0.95, 0.85, 0.75),
});
const earOuterMaterial = new THREE.MeshPhongMaterial({
  color: new THREE.Color(0.9, 0.78, 0.68),
});
const earInnerMaterial = new THREE.MeshPhongMaterial({
  color: new THREE.Color(0.85, 0.65, 0.55),
});

interface HeadGeometryProps {
  leftEyeRef: React.RefObject<THREE.Mesh | null>;
  rightEyeRef: React.RefObject<THREE.Mesh | null>;
  mouthRef: React.RefObject<THREE.Mesh | null>;
}

export const HeadGeometry = forwardRef<THREE.Group, HeadGeometryProps>(
  function HeadGeometry({ leftEyeRef, rightEyeRef, mouthRef }, ref) {
    return (
      <group ref={ref}>
        {/* Head sphere */}
        <mesh material={skinMaterial}>
          <sphereGeometry args={[1.0, 64, 64]} />
        </mesh>

        {/* Face group - positioned on front of head */}
        <group position={[0, 0, 1.02]}>

          {/* Left eye — * */}
          <Text
            ref={leftEyeRef}
            position={[-0.22, 0.12, 0]}
            fontSize={0.2}
            color="black"
            anchorX="center"
            anchorY="middle"
            {...CURVE_PROPS}
          >
            *
          </Text>

          {/* Right eye — * */}
          <Text
            ref={rightEyeRef}
            position={[0.22, 0.12, 0]}
            fontSize={0.2}
            color="black"
            anchorX="center"
            anchorY="middle"
            {...CURVE_PROPS}
          >
            *
          </Text>

          {/* Mouth — _ */}
          <Text
            ref={mouthRef}
            position={[0, -0.18, 0]}
            fontSize={0.2}
            color="black"
            anchorX="center"
            anchorY="middle"
            {...CURVE_PROPS}
          >
            _
          </Text>

        </group>

        {/* Left ear */}
        <group position={[-0.95, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <mesh material={earOuterMaterial}>
            <capsuleGeometry args={[0.25, 0.2, 8, 16]} />
          </mesh>
          <mesh position={[0.08, 0, 0.05]} material={earInnerMaterial}>
            <capsuleGeometry args={[0.12, 0.11, 8, 16]} />
          </mesh>
        </group>

        {/* Right ear */}
        <group position={[0.95, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <mesh material={earOuterMaterial}>
            <capsuleGeometry args={[0.25, 0.2, 8, 16]} />
          </mesh>
          <mesh position={[-0.08, 0, 0.05]} material={earInnerMaterial}>
            <capsuleGeometry args={[0.12, 0.11, 8, 16]} />
          </mesh>
        </group>

      </group>
    );
  },
);
