import { create } from "zustand";
import type {
  ChartData,
  DashboardStats,
  PipelineData,
  RecentProject,
} from "@/types/dashboard";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function fetchApi<T>(path: string, token?: string): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  const res = await fetch(`${API_URL}${path}`, { headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `API error ${res.status}`);
  }
  return res.json();
}

interface DashboardStore {
  stats: DashboardStats | null;
  recentProjects: RecentProject[];
  pipeline: PipelineData | null;
  chartData: ChartData | null;
  loading: boolean;
  fetchStats: (token: string) => Promise<void>;
  fetchRecentProjects: (token: string) => Promise<void>;
  fetchPipeline: (token: string) => Promise<void>;
  fetchChartData: (token: string) => Promise<void>;
}

export const useDashboardStore = create<DashboardStore>((set) => ({
  stats: null,
  recentProjects: [],
  pipeline: null,
  chartData: null,
  loading: false,

  fetchStats: async (token) => {
    set({ loading: true });
    try {
      const data = await fetchApi<DashboardStats>("/dashboard/stats", token);
      set({ stats: data });
    } finally {
      set({ loading: false });
    }
  },

  fetchRecentProjects: async (token) => {
    const data = await fetchApi<RecentProject[]>(
      "/dashboard/recent-projects",
      token
    );
    set({ recentProjects: data });
  },

  fetchPipeline: async (token) => {
    const data = await fetchApi<PipelineData>("/dashboard/pipeline", token);
    set({ pipeline: data });
  },

  fetchChartData: async (token) => {
    const data = await fetchApi<ChartData>("/dashboard/charts", token);
    set({ chartData: data });
  },
}));
