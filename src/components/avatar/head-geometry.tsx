import { forwardRef, useMemo } from "react";
import * as THREE from "three";
import { Text } from "@react-three/drei";

// curveRadius is a valid troika-three-text prop but not in drei's TS types
const CURVE_PROPS = { curveRadius: 1.0 } as Record<string, unknown>;

interface HeadGeometryProps {
  leftEyeRef: React.RefObject<THREE.Mesh | null>;
  rightEyeRef: React.RefObject<THREE.Mesh | null>;
  mouthRef: React.RefObject<THREE.Mesh | null>;
  skinColor?: [number, number, number];
}

export const HeadGeometry = forwardRef<THREE.Group, HeadGeometryProps>(
  function HeadGeometry({ leftEyeRef, rightEyeRef, mouthRef, skinColor = [0.95, 0.85, 0.75] }, ref) {
    const [skinMat, earOuterMat, earInnerMat] = useMemo(() => {
      const [r, g, b] = skinColor;
      return [
        new THREE.MeshPhongMaterial({ color: new THREE.Color(r, g, b) }),
        new THREE.MeshPhongMaterial({ color: new THREE.Color(r - 0.05, g - 0.07, b - 0.07) }),
        new THREE.MeshPhongMaterial({ color: new THREE.Color(r - 0.1, g - 0.2, b - 0.2) }),
      ];
    }, [skinColor]);
    return (
      <group ref={ref}>
        {/* Head sphere */}
        <mesh material={skinMat}>
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
          <mesh material={earOuterMat}>
            <capsuleGeometry args={[0.25, 0.2, 8, 16]} />
          </mesh>
          <mesh position={[0.08, 0, 0.05]} material={earInnerMat}>
            <capsuleGeometry args={[0.12, 0.11, 8, 16]} />
          </mesh>
        </group>

        {/* Right ear */}
        <group position={[0.95, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <mesh material={earOuterMat}>
            <capsuleGeometry args={[0.25, 0.2, 8, 16]} />
          </mesh>
          <mesh position={[-0.08, 0, 0.05]} material={earInnerMat}>
            <capsuleGeometry args={[0.12, 0.11, 8, 16]} />
          </mesh>
        </group>

      </group>
    );
  },
);
