import { create } from "zustand";
import type {
  CreateRoofZone,
  RoofZone,
  UpdateRoofZone,
} from "@/types/roof-zone";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function fetchApi<T>(
  path: string,
  token?: string,
  options?: RequestInit
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { ...headers, ...options?.headers },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `API error ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export type MapMode =
  | "navigate"
  | "draw-zone"
  | "draw-rect"
  | "edit-zone"
  | "delete-zone"
  | "add-panel"
  | "select-panel"
  | "delete-panel";

interface MapStore {
  mapMode: MapMode;
  selectedZoneId: string | null;
  zones: RoofZone[];
  drawingPoints: [number, number][];
  setMapMode: (mode: MapMode) => void;
  setSelectedZone: (id: string | null) => void;
  addDrawingPoint: (point: [number, number]) => void;
  clearDrawingPoints: () => void;
  undoDrawingPoint: () => void;

  // CRUD
  fetchZones: (projectId: string, token: string) => Promise<void>;
  addZone: (
    projectId: string,
    data: CreateRoofZone,
    token: string
  ) => Promise<RoofZone>;
  updateZone: (
    projectId: string,
    zoneId: string,
    data: UpdateRoofZone,
    token: string
  ) => Promise<void>;
  removeZone: (
    projectId: string,
    zoneId: string,
    token: string
  ) => Promise<void>;
}

export const useMapStore = create<MapStore>((set) => ({
  mapMode: "navigate",
  selectedZoneId: null,
  zones: [],
  drawingPoints: [],

  setMapMode: (mode) => set({ mapMode: mode, selectedZoneId: null }),
  setSelectedZone: (id) => set({ selectedZoneId: id }),
  addDrawingPoint: (point) =>
    set((state) => ({ drawingPoints: [...state.drawingPoints, point] })),
  clearDrawingPoints: () => set({ drawingPoints: [] }),
  undoDrawingPoint: () =>
    set((state) => ({
      drawingPoints: state.drawingPoints.slice(0, -1),
    })),

  fetchZones: async (projectId, token) => {
    const data = await fetchApi<RoofZone[]>(
      `/projects/${projectId}/zones`,
      token
    );
    set({ zones: data });
  },

  addZone: async (projectId, data, token) => {
    const zone = await fetchApi<RoofZone>(
      `/projects/${projectId}/zones`,
      token,
      { method: "POST", body: JSON.stringify(data) }
    );
    set((state) => ({ zones: [...state.zones, zone] }));
    return zone;
  },

  updateZone: async (projectId, zoneId, data, token) => {
    const updated = await fetchApi<RoofZone>(
      `/projects/${projectId}/zones/${zoneId}`,
      token,
      { method: "PUT", body: JSON.stringify(data) }
    );
    set((state) => ({
      zones: state.zones.map((z) => (z.id === zoneId ? updated : z)),
    }));
  },

  removeZone: async (projectId, zoneId, token) => {
    await fetchApi(`/projects/${projectId}/zones/${zoneId}`, token, {
      method: "DELETE",
    });
    set((state) => ({
      zones: state.zones.filter((z) => z.id !== zoneId),
      selectedZoneId:
        state.selectedZoneId === zoneId ? null : state.selectedZoneId,
    }));
  },
}));
