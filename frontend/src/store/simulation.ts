import { create } from "zustand";
import type { SimulationResult, OptimizationResult } from "@/types/simulation";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function fetchApi<T>(
  path: string,
  token: string,
  options?: RequestInit,
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { ...headers, ...options?.headers },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `API error ${res.status}`);
  }
  return res.json();
}

interface SimulationStore {
  current: SimulationResult | null;
  history: SimulationResult[];
  optimization: OptimizationResult | null;
  loading: boolean;
  optimizing: boolean;
  error: string | null;

  runSimulation: (
    projectId: string,
    token: string,
    panelLayoutId?: string,
    lossesPct?: number,
  ) => Promise<void>;
  fetchHistory: (projectId: string, token: string) => Promise<void>;
  optimize: (projectId: string, token: string, panelLayoutId?: string) => Promise<void>;
  reset: () => void;
}

export const useSimulationStore = create<SimulationStore>((set) => ({
  current: null,
  history: [],
  optimization: null,
  loading: false,
  optimizing: false,
  error: null,

  runSimulation: async (projectId, token, panelLayoutId, lossesPct) => {
    set({ loading: true, error: null });
    try {
      const body: Record<string, unknown> = {};
      if (panelLayoutId) body.panel_layout_id = panelLayoutId;
      if (lossesPct !== undefined) body.losses_pct = lossesPct;

      const result = await fetchApi<SimulationResult>(
        `/projects/${projectId}/simulate`,
        token,
        { method: "POST", body: JSON.stringify(body) },
      );
      set((state) => ({
        current: result,
        history: [result, ...state.history],
        loading: false,
      }));
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  fetchHistory: async (projectId, token) => {
    try {
      const results = await fetchApi<SimulationResult[]>(
        `/projects/${projectId}/simulations`,
        token,
      );
      set({ history: results, current: results[0] ?? null });
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },

  optimize: async (projectId, token, panelLayoutId) => {
    set({ optimizing: true, error: null });
    try {
      const body: Record<string, unknown> = {};
      if (panelLayoutId) body.panel_layout_id = panelLayoutId;

      const result = await fetchApi<OptimizationResult>(
        `/projects/${projectId}/optimize`,
        token,
        { method: "POST", body: JSON.stringify(body) },
      );
      set({ optimization: result, optimizing: false });
    } catch (err) {
      set({ error: (err as Error).message, optimizing: false });
    }
  },

  reset: () =>
    set({
      current: null,
      history: [],
      optimization: null,
      loading: false,
      optimizing: false,
      error: null,
    }),
}));
