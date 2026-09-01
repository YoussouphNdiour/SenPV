import { create } from "zustand";
import type { Client, CreateClient, UpdateClient } from "@/types/client";

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

interface ClientStore {
  clients: Client[];
  loading: boolean;
  fetchClients: (
    token: string,
    filters?: { search?: string; page?: number; per_page?: number }
  ) => Promise<void>;
  createClient: (data: CreateClient, token: string) => Promise<Client>;
  updateClient: (
    id: string,
    data: UpdateClient,
    token: string
  ) => Promise<void>;
  deleteClient: (id: string, token: string) => Promise<void>;
}

export const useClientStore = create<ClientStore>((set) => ({
  clients: [],
  loading: false,

  fetchClients: async (token, filters) => {
    set({ loading: true });
    try {
      const params = new URLSearchParams();
      if (filters?.search) params.set("search", filters.search);
      if (filters?.page) params.set("page", String(filters.page));
      if (filters?.per_page) params.set("per_page", String(filters.per_page));
      const qs = params.toString();
      const data = await fetchApi<Client[]>(
        `/clients${qs ? `?${qs}` : ""}`,
        token
      );
      set({ clients: data });
    } finally {
      set({ loading: false });
    }
  },

  createClient: async (data, token) => {
    const client = await fetchApi<Client>("/clients", token, {
      method: "POST",
      body: JSON.stringify(data),
    });
    set((state) => ({ clients: [client, ...state.clients] }));
    return client;
  },

  updateClient: async (id, data, token) => {
    const updated = await fetchApi<Client>(`/clients/${id}`, token, {
      method: "PUT",
      body: JSON.stringify(data),
    });
    set((state) => ({
      clients: state.clients.map((c) => (c.id === id ? updated : c)),
    }));
  },

  deleteClient: async (id, token) => {
    await fetchApi(`/clients/${id}`, token, { method: "DELETE" });
    set((state) => ({
      clients: state.clients.filter((c) => c.id !== id),
    }));
  },
}));
