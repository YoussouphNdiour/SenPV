"use client";

import { useRef, useMemo, useEffect, useState } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { wgs84ToLocal3D } from "@/lib/geo";
import type { PanelPosition } from "@/types/panel-layout";

interface SolarPanels3DProps {
  panels: PanelPosition[];
  centerLat: number;
  centerLon: number;
  tiltDeg: number;
  panelWidth: number; // meters
  panelHeight: number; // meters
  buildingHeight: number;
  rotation: number;
}

const PANEL_COLOR = new THREE.Color("#1a2744");
const HOVER_EMISSION = new THREE.Color("#4466aa");
const DUMMY = new THREE.Object3D();

export function SolarPanels3D({
  panels,
  centerLat,
  centerLon,
  tiltDeg,
  panelWidth,
  panelHeight,
  buildingHeight,
  rotation,
}: SolarPanels3DProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [animProgress, setAnimProgress] = useState(0);

  const positions = useMemo(() => {
    return panels.map((panel) => {
      // Use center of the panel polygon
      const coords = panel.geometry.coordinates[0];
      let sumLon = 0,
        sumLat = 0;
      for (const [lon, lat] of coords) {
        sumLon += lon;
        sumLat += lat;
      }
      const cLon = sumLon / coords.length;
      const cLat = sumLat / coords.length;
      return wgs84ToLocal3D(cLat, cLon, centerLat, centerLon, tiltDeg);
    });
  }, [panels, centerLat, centerLon, tiltDeg]);

  // Pop-in animation
  useEffect(() => {
    setAnimProgress(0);
  }, [panels.length]);

  useFrame((_, delta) => {
    if (animProgress < 1) {
      setAnimProgress((p) => Math.min(1, p + delta * 3));
    }

    if (!meshRef.current) return;

    const scale = easeOutBack(animProgress);
    const rotRad = (rotation * Math.PI) / 180;

    for (let i = 0; i < positions.length; i++) {
      const pos = positions[i];
      DUMMY.position.set(pos.x, buildingHeight + pos.y + 0.05, pos.z);
      DUMMY.rotation.set(0, rotRad, 0);
      DUMMY.scale.setScalar(scale);
      DUMMY.updateMatrix();
      meshRef.current.setMatrixAt(i, DUMMY.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  if (panels.length === 0) return null;

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, panels.length]}
      castShadow
      receiveShadow
      onPointerOver={(e) => {
        e.stopPropagation();
        setHoveredIndex(e.instanceId ?? null);
      }}
      onPointerOut={() => setHoveredIndex(null)}
    >
      <boxGeometry args={[panelWidth, 0.04, panelHeight]} />
      <meshStandardMaterial
        color={PANEL_COLOR}
        metalness={0.3}
        roughness={0.6}
        emissive={hoveredIndex !== null ? HOVER_EMISSION : undefined}
        emissiveIntensity={hoveredIndex !== null ? 0.3 : 0}
      />
    </instancedMesh>
  );
}

function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}
