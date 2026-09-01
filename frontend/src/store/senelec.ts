import { create } from "zustand";
import type { BillResult, SavingsResult, TariffData } from "@/types/senelec";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function fetchApi<T>(path: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
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

interface SenelecStore {
  tariffs: TariffData | null;
  bill: BillResult | null;
  savings: SavingsResult | null;
  monthlyKwh: number;
  tariffTier: string | null;
  loading: boolean;
  error: string | null;

  setMonthlyKwh: (kwh: number) => void;
  setTariffTier: (tier: string | null) => void;
  fetchTariffs: () => Promise<void>;
  fetchBill: (monthlyKwh: number, tariffTier?: string | null) => Promise<void>;
  fetchSavings: (
    monthlyKwh: number,
    annualProductionKwh: number,
    tariffTier?: string | null,
  ) => Promise<void>;
  reset: () => void;
}

export const useSenelecStore = create<SenelecStore>((set) => ({
  tariffs: null,
  bill: null,
  savings: null,
  monthlyKwh: 0,
  tariffTier: null,
  loading: false,
  error: null,

  setMonthlyKwh: (kwh) => set({ monthlyKwh: kwh }),
  setTariffTier: (tier) => set({ tariffTier: tier }),

  fetchTariffs: async () => {
    try {
      const data = await fetchApi<TariffData>("/senelec/tariffs");
      set({ tariffs: data });
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },

  fetchBill: async (monthlyKwh, tariffTier) => {
    set({ loading: true, error: null });
    try {
      const body: Record<string, unknown> = { monthly_kwh: monthlyKwh };
      if (tariffTier) body.tariff_tier = tariffTier;
      const result = await fetchApi<BillResult>("/senelec/bill", {
        method: "POST",
        body: JSON.stringify(body),
      });
      set({ bill: result, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  fetchSavings: async (monthlyKwh, annualProductionKwh, tariffTier) => {
    set({ loading: true, error: null });
    try {
      const body: Record<string, unknown> = {
        monthly_kwh: monthlyKwh,
        annual_production_kwh: annualProductionKwh,
      };
      if (tariffTier) body.tariff_tier = tariffTier;
      const result = await fetchApi<SavingsResult>("/senelec/savings", {
        method: "POST",
        body: JSON.stringify(body),
      });
      set({ savings: result, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  reset: () =>
    set({
      bill: null,
      savings: null,
      monthlyKwh: 0,
      tariffTier: null,
      loading: false,
      error: null,
    }),
}));
