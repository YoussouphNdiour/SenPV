import { create } from "zustand";
import type { RoofType } from "@/types/roof-zone";

interface Viewer3DStore {
  // Visibility toggles
  showBuilding: boolean;
  showPanels: boolean;
  showGrid: boolean;

  // Roof parameters
  roofType: RoofType;
  tiltDeg: number;
  rotationDeg: number;
  buildingHeight: number;

  // Actions
  setShowBuilding: (v: boolean) => void;
  setShowPanels: (v: boolean) => void;
  setShowGrid: (v: boolean) => void;
  setRoofType: (t: RoofType) => void;
  setTiltDeg: (v: number) => void;
  setRotationDeg: (v: number) => void;
  setBuildingHeight: (v: number) => void;
  resetView: () => void;
}

const DEFAULTS = {
  showBuilding: true,
  showPanels: true,
  showGrid: true,
  roofType: "flat" as RoofType,
  tiltDeg: 15,
  rotationDeg: 0,
  buildingHeight: 3,
};

export const useViewer3DStore = create<Viewer3DStore>((set) => ({
  ...DEFAULTS,

  setShowBuilding: (v) => set({ showBuilding: v }),
  setShowPanels: (v) => set({ showPanels: v }),
  setShowGrid: (v) => set({ showGrid: v }),
  setRoofType: (t) => set({ roofType: t }),
  setTiltDeg: (v) => set({ tiltDeg: v }),
  setRotationDeg: (v) => set({ rotationDeg: v }),
  setBuildingHeight: (v) => set({ buildingHeight: v }),
  resetView: () => set(DEFAULTS),
}));
