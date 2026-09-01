import { create } from "zustand";
import type {
  CreateProject,
  Project,
  ProjectStatus,
  UpdateProject,
} from "@/types/project";

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

interface ProjectStore {
  projects: Project[];
  currentProject: Project | null;
  loading: boolean;
  fetchProjects: (
    token: string,
    filters?: {
      status?: string;
      search?: string;
      page?: number;
      per_page?: number;
      sort_by?: string;
      order?: string;
    }
  ) => Promise<void>;
  fetchProject: (id: string, token: string) => Promise<void>;
  createProject: (data: CreateProject, token: string) => Promise<Project>;
  updateProject: (
    id: string,
    data: UpdateProject,
    token: string
  ) => Promise<void>;
  deleteProject: (id: string, token: string) => Promise<void>;
  updateStatus: (
    id: string,
    status: ProjectStatus,
    token: string
  ) => Promise<void>;
}

export const useProjectStore = create<ProjectStore>((set) => ({
  projects: [],
  currentProject: null,
  loading: false,

  fetchProjects: async (token, filters) => {
    set({ loading: true });
    try {
      const params = new URLSearchParams();
      if (filters?.status) params.set("status", filters.status);
      if (filters?.search) params.set("search", filters.search);
      if (filters?.page) params.set("page", String(filters.page));
      if (filters?.per_page) params.set("per_page", String(filters.per_page));
      if (filters?.sort_by) params.set("sort_by", filters.sort_by);
      if (filters?.order) params.set("order", filters.order);
      const qs = params.toString();
      const data = await fetchApi<Project[]>(
        `/projects${qs ? `?${qs}` : ""}`,
        token
      );
      set({ projects: data });
    } finally {
      set({ loading: false });
    }
  },

  fetchProject: async (id, token) => {
    set({ loading: true });
    try {
      const data = await fetchApi<Project>(`/projects/${id}`, token);
      set({ currentProject: data });
    } finally {
      set({ loading: false });
    }
  },

  createProject: async (data, token) => {
    const project = await fetchApi<Project>("/projects", token, {
      method: "POST",
      body: JSON.stringify(data),
    });
    set((state) => ({ projects: [project, ...state.projects] }));
    return project;
  },

  updateProject: async (id, data, token) => {
    const updated = await fetchApi<Project>(`/projects/${id}`, token, {
      method: "PUT",
      body: JSON.stringify(data),
    });
    set((state) => ({
      projects: state.projects.map((p) => (p.id === id ? updated : p)),
      currentProject:
        state.currentProject?.id === id ? updated : state.currentProject,
    }));
  },

  deleteProject: async (id, token) => {
    await fetchApi(`/projects/${id}`, token, { method: "DELETE" });
    set((state) => ({
      projects: state.projects.filter((p) => p.id !== id),
      currentProject:
        state.currentProject?.id === id ? null : state.currentProject,
    }));
  },

  updateStatus: async (id, status, token) => {
    const updated = await fetchApi<Project>(`/projects/${id}`, token, {
      method: "PUT",
      body: JSON.stringify({ status }),
    });
    set((state) => ({
      projects: state.projects.map((p) => (p.id === id ? updated : p)),
      currentProject:
        state.currentProject?.id === id ? updated : state.currentProject,
    }));
  },
}));
