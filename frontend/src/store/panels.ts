import { create } from "zustand";
import type {
  AddPanelRequest,
  CreatePanelLayout,
  PanelLayout,
  PanelLayoutGeoJSON,
} from "@/types/panel-layout";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const MAX_HISTORY = 20;

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

interface HistoryEntry {
  action: "add" | "remove" | "calpinage" | "clear";
  layoutGeojson: PanelLayoutGeoJSON | null;
  numPanels: number;
}

interface PanelStore {
  layouts: PanelLayout[];
  selectedLayoutId: string | null;
  selectedPanelIndex: number | null;
  loading: boolean;
  history: HistoryEntry[];

  // Computed
  totalPanels: () => number;

  // CRUD
  fetchLayouts: (projectId: string, token: string) => Promise<void>;
  createLayout: (
    projectId: string,
    data: CreatePanelLayout,
    token: string
  ) => Promise<PanelLayout>;
  updateLayout: (
    projectId: string,
    layoutId: string,
    data: Partial<PanelLayout>,
    token: string
  ) => Promise<void>;
  deleteLayout: (
    projectId: string,
    layoutId: string,
    token: string
  ) => Promise<void>;
  addPanel: (
    projectId: string,
    layoutId: string,
    data: AddPanelRequest,
    token: string
  ) => Promise<void>;
  removePanel: (
    projectId: string,
    layoutId: string,
    panelIndex: number,
    token: string
  ) => Promise<void>;
  clearAllPanels: (
    projectId: string,
    layoutId: string,
    token: string
  ) => Promise<void>;

  // Undo
  undo: (projectId: string, token: string) => Promise<void>;

  // Selection
  setSelectedLayout: (id: string | null) => void;
  setSelectedPanelIndex: (index: number | null) => void;
}

export const usePanelStore = create<PanelStore>((set, get) => ({
  layouts: [],
  selectedLayoutId: null,
  selectedPanelIndex: null,
  loading: false,
  history: [],

  totalPanels: () => {
    return get().layouts.reduce((sum, l) => sum + l.num_panels, 0);
  },

  fetchLayouts: async (projectId, token) => {
    set({ loading: true });
    try {
      const data = await fetchApi<PanelLayout[]>(
        `/projects/${projectId}/layouts`,
        token
      );
      set({ layouts: data });
    } finally {
      set({ loading: false });
    }
  },

  createLayout: async (projectId, data, token) => {
    set({ loading: true });
    try {
      const layout = await fetchApi<PanelLayout>(
        `/projects/${projectId}/layouts`,
        token,
        { method: "POST", body: JSON.stringify(data) }
      );
      set((state) => ({
        layouts: [...state.layouts, layout],
        selectedLayoutId: layout.id,
        history: [
          ...state.history.slice(-(MAX_HISTORY - 1)),
          {
            action: "calpinage" as const,
            layoutGeojson: null,
            numPanels: 0,
          },
        ],
      }));
      return layout;
    } finally {
      set({ loading: false });
    }
  },

  updateLayout: async (projectId, layoutId, data, token) => {
    const updated = await fetchApi<PanelLayout>(
      `/projects/${projectId}/layouts/${layoutId}`,
      token,
      { method: "PUT", body: JSON.stringify(data) }
    );
    set((state) => ({
      layouts: state.layouts.map((l) => (l.id === layoutId ? updated : l)),
    }));
  },

  deleteLayout: async (projectId, layoutId, token) => {
    await fetchApi(`/projects/${projectId}/layouts/${layoutId}`, token, {
      method: "DELETE",
    });
    set((state) => ({
      layouts: state.layouts.filter((l) => l.id !== layoutId),
      selectedLayoutId:
        state.selectedLayoutId === layoutId ? null : state.selectedLayoutId,
    }));
  },

  addPanel: async (projectId, layoutId, data, token) => {
    // Save current state for undo
    const currentLayout = get().layouts.find((l) => l.id === layoutId);
    if (currentLayout) {
      set((state) => ({
        history: [
          ...state.history.slice(-(MAX_HISTORY - 1)),
          {
            action: "add" as const,
            layoutGeojson: currentLayout.layout_geojson,
            numPanels: currentLayout.num_panels,
          },
        ],
      }));
    }

    const updated = await fetchApi<PanelLayout>(
      `/projects/${projectId}/layouts/${layoutId}/add-panel`,
      token,
      { method: "POST", body: JSON.stringify(data) }
    );
    set((state) => ({
      layouts: state.layouts.map((l) => (l.id === layoutId ? updated : l)),
    }));
  },

  removePanel: async (projectId, layoutId, panelIndex, token) => {
    // Save current state for undo
    const currentLayout = get().layouts.find((l) => l.id === layoutId);
    if (currentLayout) {
      set((state) => ({
        history: [
          ...state.history.slice(-(MAX_HISTORY - 1)),
          {
            action: "remove" as const,
            layoutGeojson: currentLayout.layout_geojson,
            numPanels: currentLayout.num_panels,
          },
        ],
      }));
    }

    const updated = await fetchApi<PanelLayout>(
      `/projects/${projectId}/layouts/${layoutId}/panels/${panelIndex}`,
      token,
      { method: "DELETE" }
    );
    set((state) => ({
      layouts: state.layouts.map((l) => (l.id === layoutId ? updated : l)),
    }));
  },

  clearAllPanels: async (projectId, layoutId, token) => {
    const currentLayout = get().layouts.find((l) => l.id === layoutId);
    if (currentLayout) {
      set((state) => ({
        history: [
          ...state.history.slice(-(MAX_HISTORY - 1)),
          {
            action: "clear" as const,
            layoutGeojson: currentLayout.layout_geojson,
            numPanels: currentLayout.num_panels,
          },
        ],
      }));
    }

    // Clear by updating with empty layout
    const updated = await fetchApi<PanelLayout>(
      `/projects/${projectId}/layouts/${layoutId}`,
      token,
      {
        method: "PUT",
        body: JSON.stringify({
          layout_geojson: { type: "FeatureCollection", features: [] },
          num_panels: 0,
          num_strings: 0,
          panels_per_string: 0,
        }),
      }
    );
    set((state) => ({
      layouts: state.layouts.map((l) => (l.id === layoutId ? updated : l)),
    }));
  },

  undo: async (projectId, token) => {
    const { history, selectedLayoutId } = get();
    if (history.length === 0 || !selectedLayoutId) return;

    const lastEntry = history[history.length - 1];

    // Restore previous state via PUT
    const updated = await fetchApi<PanelLayout>(
      `/projects/${projectId}/layouts/${selectedLayoutId}`,
      token,
      {
        method: "PUT",
        body: JSON.stringify({
          layout_geojson: lastEntry.layoutGeojson,
          num_panels: lastEntry.numPanels,
        }),
      }
    );

    set((state) => ({
      layouts: state.layouts.map((l) =>
        l.id === selectedLayoutId ? updated : l
      ),
      history: state.history.slice(0, -1),
    }));
  },

  setSelectedLayout: (id) => set({ selectedLayoutId: id, selectedPanelIndex: null }),
  setSelectedPanelIndex: (index) => set({ selectedPanelIndex: index }),
}));
