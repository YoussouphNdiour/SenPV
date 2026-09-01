import { create } from "zustand";
import type {
  CreateEquipment,
  Equipment,
  PaginatedEquipment,
  UpdateEquipment,
} from "@/types/equipment";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface EquipmentStore {
  panels: Equipment[];
  inverters: Equipment[];
  loading: boolean;
  totalPanels: number;
  totalInverters: number;
  fetchPanels: (token?: string, search?: string, manufacturer?: string) => Promise<void>;
  fetchInverters: (token?: string, search?: string, manufacturer?: string) => Promise<void>;
  addEquipment: (data: CreateEquipment, token: string) => Promise<void>;
  updateEquipment: (id: string, data: UpdateEquipment, token: string) => Promise<void>;
  deleteEquipment: (id: string, token: string) => Promise<void>;
}

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

export const useEquipmentStore = create<EquipmentStore>((set) => ({
  panels: [],
  inverters: [],
  loading: false,
  totalPanels: 0,
  totalInverters: 0,

  fetchPanels: async (token, search, manufacturer) => {
    set({ loading: true });
    try {
      const params = new URLSearchParams({ type: "panel", per_page: "100" });
      if (search) params.set("search", search);
      if (manufacturer) params.set("manufacturer", manufacturer);
      const data = await fetchApi<PaginatedEquipment>(
        `/equipment?${params}`,
        token
      );
      set({ panels: data.items, totalPanels: data.total });
    } finally {
      set({ loading: false });
    }
  },

  fetchInverters: async (token, search, manufacturer) => {
    set({ loading: true });
    try {
      const params = new URLSearchParams({ type: "inverter", per_page: "100" });
      if (search) params.set("search", search);
      if (manufacturer) params.set("manufacturer", manufacturer);
      const data = await fetchApi<PaginatedEquipment>(
        `/equipment?${params}`,
        token
      );
      set({ inverters: data.items, totalInverters: data.total });
    } finally {
      set({ loading: false });
    }
  },

  addEquipment: async (data, token) => {
    await fetchApi("/equipment", token, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  updateEquipment: async (id, data, token) => {
    await fetchApi(`/equipment/${id}`, token, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  deleteEquipment: async (id, token) => {
    await fetchApi(`/equipment/${id}`, token, {
      method: "DELETE",
    });
  },
}));
