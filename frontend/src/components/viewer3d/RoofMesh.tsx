"use client";

import { useMemo } from "react";
import * as THREE from "three";
import type { RoofType } from "@/types/roof-zone";

interface RoofMeshProps {
  width: number;
  depth: number;
  height: number;
  tiltDeg: number;
  roofType: RoofType;
  rotation: number;
}

function FlatRoof({ width, depth }: { width: number; depth: number }) {
  return (
    <mesh receiveShadow>
      <planeGeometry args={[width, depth]} />
      <meshStandardMaterial
        color="#c45a3c"
        transparent
        opacity={0.7}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

function GableRoof({
  width,
  depth,
  tiltDeg,
}: {
  width: number;
  depth: number;
  tiltDeg: number;
}) {
  const tiltRad = (tiltDeg * Math.PI) / 180;
  const ridgeHeight = (depth / 2) * Math.tan(tiltRad);
  const slopeLength = (depth / 2) / Math.cos(tiltRad);

  return (
    <group>
      {/* Left slope */}
      <mesh
        position={[0, ridgeHeight / 2, -depth / 4]}
        rotation={[tiltRad, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[width, slopeLength]} />
        <meshStandardMaterial
          color="#c45a3c"
          transparent
          opacity={0.7}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* Right slope */}
      <mesh
        position={[0, ridgeHeight / 2, depth / 4]}
        rotation={[-tiltRad, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[width, slopeLength]} />
        <meshStandardMaterial
          color="#c45a3c"
          transparent
          opacity={0.7}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}

function HipRoof({
  width,
  depth,
  tiltDeg,
}: {
  width: number;
  depth: number;
  tiltDeg: number;
}) {
  const geometry = useMemo(() => {
    const tiltRad = (tiltDeg * Math.PI) / 180;
    const ridgeHeight = Math.min(width, depth) / 2 * Math.tan(tiltRad);
    const hw = width / 2;
    const hd = depth / 2;
    const inset = Math.min(hw, hd);
    const ridgeHalfLen = Math.max(0, hw - hd);

    const geo = new THREE.BufferGeometry();
    const vertices: number[] = [];

    // Front face (triangle or trapezoid)
    if (ridgeHalfLen > 0) {
      // Front slope
      vertices.push(-hw, 0, -hd, hw, 0, -hd, ridgeHalfLen, ridgeHeight, -hd + inset);
      vertices.push(-hw, 0, -hd, ridgeHalfLen, ridgeHeight, -hd + inset, -ridgeHalfLen, ridgeHeight, -hd + inset);
      // Back slope
      vertices.push(hw, 0, hd, -hw, 0, hd, -ridgeHalfLen, ridgeHeight, hd - inset);
      vertices.push(hw, 0, hd, -ridgeHalfLen, ridgeHeight, hd - inset, ridgeHalfLen, ridgeHeight, hd - inset);
      // Left slope
      vertices.push(-hw, 0, hd, -hw, 0, -hd, -ridgeHalfLen, ridgeHeight, -hd + inset);
      vertices.push(-hw, 0, hd, -ridgeHalfLen, ridgeHeight, -hd + inset, -ridgeHalfLen, ridgeHeight, hd - inset);
      // Right slope
      vertices.push(hw, 0, -hd, hw, 0, hd, ridgeHalfLen, ridgeHeight, hd - inset);
      vertices.push(hw, 0, -hd, ridgeHalfLen, ridgeHeight, hd - inset, ridgeHalfLen, ridgeHeight, -hd + inset);
    } else {
      // Perfect pyramid (square-ish footprint)
      vertices.push(-hw, 0, -hd, hw, 0, -hd, 0, ridgeHeight, 0); // front
      vertices.push(hw, 0, -hd, hw, 0, hd, 0, ridgeHeight, 0); // right
      vertices.push(hw, 0, hd, -hw, 0, hd, 0, ridgeHeight, 0); // back
      vertices.push(-hw, 0, hd, -hw, 0, -hd, 0, ridgeHeight, 0); // left
    }

    geo.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(vertices, 3)
    );
    geo.computeVertexNormals();
    return geo;
  }, [width, depth, tiltDeg]);

  return (
    <mesh geometry={geometry} receiveShadow>
      <meshStandardMaterial
        color="#c45a3c"
        transparent
        opacity={0.7}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

function ShedRoof({
  width,
  depth,
  tiltDeg,
}: {
  width: number;
  depth: number;
  tiltDeg: number;
}) {
  const tiltRad = (tiltDeg * Math.PI) / 180;
  const riseHeight = depth * Math.tan(tiltRad);
  const slopeLength = depth / Math.cos(tiltRad);

  return (
    <mesh
      position={[0, riseHeight / 2, 0]}
      rotation={[tiltRad, 0, 0]}
      receiveShadow
    >
      <planeGeometry args={[width, slopeLength]} />
      <meshStandardMaterial
        color="#c45a3c"
        transparent
        opacity={0.7}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

export function RoofMesh({
  width,
  depth,
  height,
  tiltDeg,
  roofType,
  rotation,
}: RoofMeshProps) {
  return (
    <group position={[0, height, 0]} rotation-y={(rotation * Math.PI) / 180}>
      {roofType === "flat" && <FlatRoof width={width} depth={depth} />}
      {roofType === "gable" && (
        <GableRoof width={width} depth={depth} tiltDeg={tiltDeg} />
      )}
      {roofType === "hip" && (
        <HipRoof width={width} depth={depth} tiltDeg={tiltDeg} />
      )}
      {roofType === "shed" && (
        <ShedRoof width={width} depth={depth} tiltDeg={tiltDeg} />
      )}
    </group>
  );
}
