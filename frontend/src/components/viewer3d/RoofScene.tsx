"use client";

import { useRef, useMemo, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, GradientTexture } from "@react-three/drei";
import * as THREE from "three";

import { Building } from "./Building";
import { RoofMesh } from "./RoofMesh";
import { SolarPanels3D } from "./SolarPanels3D";
import { Controls } from "./Controls";
import { useViewer3DStore } from "@/store/viewer3d";
import { polygonCenter, polygonDimensions } from "@/lib/geo";
import type { RoofZone } from "@/types/roof-zone";
import type { PanelLayout } from "@/types/panel-layout";
import type { Equipment, PanelSpecs } from "@/types/equipment";

interface RoofSceneProps {
  zones: RoofZone[];
  layouts: PanelLayout[];
  equipment: Equipment[];
}

function SkyBackground() {
  return (
    <mesh>
      <sphereGeometry args={[100, 32, 32]} />
      <meshBasicMaterial side={THREE.BackSide}>
        <GradientTexture
          stops={[0, 0.5, 1]}
          colors={["#87CEEB", "#B0E0E6", "#E0F0FF"]}
        />
      </meshBasicMaterial>
    </mesh>
  );
}

function Scene({ zones, layouts, equipment }: RoofSceneProps) {
  const {
    showBuilding,
    showPanels,
    showGrid,
    roofType,
    tiltDeg,
    rotationDeg,
    buildingHeight,
    setRoofType,
    setTiltDeg,
  } = useViewer3DStore();

  // Use first zone for building dimensions
  const primaryZone = zones[0];

  // Sync store with zone data on mount
  useEffect(() => {
    if (primaryZone?.roof_type) {
      setRoofType(primaryZone.roof_type);
    }
    if (primaryZone?.tilt_deg != null) {
      setTiltDeg(primaryZone.tilt_deg);
    }
  }, [primaryZone, setRoofType, setTiltDeg]);

  const { center, width, depth } = useMemo(() => {
    if (!primaryZone?.polygon) {
      return { center: { lat: 14.7167, lon: -17.4677 }, width: 10, depth: 8 };
    }
    const c = polygonCenter(primaryZone.polygon.coordinates);
    const dims = polygonDimensions(primaryZone.polygon.coordinates, c.lat);
    return {
      center: c,
      width: Math.max(dims.width, 2),
      depth: Math.max(dims.depth, 2),
    };
  }, [primaryZone]);

  // Collect all panels from all layouts
  const allPanels = useMemo(() => {
    return layouts.flatMap((l) => l.layout_geojson?.features ?? []);
  }, [layouts]);

  // Get panel dimensions from equipment
  const panelDims = useMemo(() => {
    const layout = layouts[0];
    if (!layout) return { w: 1.0, h: 1.7 };

    const panel = equipment.find(
      (e) => e.id === layout.panel_model_id && e.type === "panel"
    );
    if (!panel) return { w: 1.0, h: 1.7 };

    const specs = panel.specs as PanelSpecs;
    return {
      w: (specs.dimensions_mm?.width ?? 1000) / 1000,
      h: (specs.dimensions_mm?.length ?? 1700) / 1000,
    };
  }, [layouts, equipment]);

  return (
    <>
      <SkyBackground />

      {/* Lighting */}
      <ambientLight intensity={0.4} />
      <directionalLight
        position={[15, 20, 10]}
        intensity={1.2}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={100}
        shadow-camera-left={-30}
        shadow-camera-right={30}
        shadow-camera-top={30}
        shadow-camera-bottom={-30}
      />

      {/* Grid */}
      {showGrid && (
        <gridHelper args={[50, 50, "#888888", "#cccccc"]} />
      )}

      {/* Building */}
      {showBuilding && (
        <Building
          width={width}
          depth={depth}
          height={buildingHeight}
          rotation={rotationDeg}
        />
      )}

      {/* Roof */}
      <RoofMesh
        width={width}
        depth={depth}
        height={buildingHeight}
        tiltDeg={tiltDeg}
        roofType={roofType}
        rotation={rotationDeg}
      />

      {/* Solar panels */}
      {showPanels && allPanels.length > 0 && (
        <SolarPanels3D
          panels={allPanels}
          centerLat={center.lat}
          centerLon={center.lon}
          tiltDeg={tiltDeg}
          panelWidth={panelDims.w}
          panelHeight={panelDims.h}
          buildingHeight={buildingHeight}
          rotation={rotationDeg}
        />
      )}

      {/* Ground plane */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.01, 0]}
        receiveShadow
      >
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial color="#a8d5a2" />
      </mesh>

      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.1}
        minDistance={5}
        maxDistance={80}
      />
    </>
  );
}

export function RoofScene({ zones, layouts, equipment }: RoofSceneProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  return (
    <div className="relative w-full h-[600px] rounded-lg overflow-hidden border">
      <Canvas
        ref={canvasRef}
        shadows
        camera={{ position: [20, 20, 20], fov: 50 }}
        gl={{ preserveDrawingBuffer: true }}
      >
        <Scene zones={zones} layouts={layouts} equipment={equipment} />
      </Canvas>
      <Controls canvasRef={canvasRef} />
    </div>
  );
}
