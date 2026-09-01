import { create } from "zustand";
import type { FinancialRequest, FinancialResult } from "@/types/financial";

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

interface FinancialStore {
  result: FinancialResult | null;
  loading: boolean;
  error: string | null;

  calculate: (
    projectId: string,
    token: string,
    body: FinancialRequest,
  ) => Promise<void>;
  fetchLatest: (projectId: string, token: string) => Promise<void>;
  reset: () => void;
}

export const useFinancialStore = create<FinancialStore>((set) => ({
  result: null,
  loading: false,
  error: null,

  calculate: async (projectId, token, body) => {
    set({ loading: true, error: null });
    try {
      const result = await fetchApi<FinancialResult>(
        `/projects/${projectId}/financial`,
        token,
        { method: "POST", body: JSON.stringify(body) },
      );
      set({ result, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  fetchLatest: async (projectId, token) => {
    try {
      const result = await fetchApi<FinancialResult>(
        `/projects/${projectId}/financial`,
        token,
      );
      set({ result });
    } catch {
      // No previous analysis — not an error
    }
  },

  reset: () => set({ result: null, loading: false, error: null }),
}));
