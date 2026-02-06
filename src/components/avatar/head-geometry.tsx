import { forwardRef } from "react";
import * as THREE from "three";

// Pre-create materials to avoid re-creation on every render
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

interface HeadGeometryProps {
  leftEyeRef: React.RefObject<THREE.Mesh | null>;
  rightEyeRef: React.RefObject<THREE.Mesh | null>;
}

export const HeadGeometry = forwardRef<THREE.Group, HeadGeometryProps>(
  function HeadGeometry({ leftEyeRef, rightEyeRef }, ref) {
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
            position={[-0.25, 0.15, 0.1]}
            material={eyeMaterial}
          >
            <sphereGeometry args={[0.08, 16, 16]} />
          </mesh>

          {/* Right eye */}
          <mesh
            ref={rightEyeRef}
            position={[0.25, 0.15, 0.1]}
            material={eyeMaterial}
          >
            <sphereGeometry args={[0.08, 16, 16]} />
          </mesh>

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
