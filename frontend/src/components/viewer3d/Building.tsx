"use client";

interface BuildingProps {
  width: number;
  depth: number;
  height: number;
  rotation: number;
}

export function Building({ width, depth, height, rotation }: BuildingProps) {
  return (
    <group rotation-y={(rotation * Math.PI) / 180}>
      <mesh position={[0, height / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial color="#e0e0e0" />
      </mesh>
    </group>
  );
}
