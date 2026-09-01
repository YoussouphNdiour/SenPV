import { create } from "zustand";
import type { Quote, QuoteCreateInput } from "@/types/quote";

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
  if (res.status === 204) return undefined as T;
  return res.json();
}

interface QuoteStore {
  quotes: Quote[];
  currentQuote: Quote | null;
  loading: boolean;
  error: string | null;

  fetchQuotes: (projectId: string, token: string) => Promise<void>;
  createQuote: (
    projectId: string,
    token: string,
    body: QuoteCreateInput,
  ) => Promise<Quote>;
  updateQuote: (
    projectId: string,
    quoteId: string,
    token: string,
    body: Partial<QuoteCreateInput>,
  ) => Promise<void>;
  updateStatus: (
    projectId: string,
    quoteId: string,
    token: string,
    status: string,
  ) => Promise<void>;
  setCurrentQuote: (quote: Quote | null) => void;
  reset: () => void;
}

export const useQuoteStore = create<QuoteStore>((set, get) => ({
  quotes: [],
  currentQuote: null,
  loading: false,
  error: null,

  fetchQuotes: async (projectId, token) => {
    set({ loading: true, error: null });
    try {
      const quotes = await fetchApi<Quote[]>(
        `/projects/${projectId}/quotes`,
        token,
      );
      set({ quotes, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  createQuote: async (projectId, token, body) => {
    set({ loading: true, error: null });
    try {
      const quote = await fetchApi<Quote>(
        `/projects/${projectId}/quotes`,
        token,
        { method: "POST", body: JSON.stringify(body) },
      );
      set((s) => ({
        quotes: [quote, ...s.quotes],
        currentQuote: quote,
        loading: false,
      }));
      return quote;
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
      throw err;
    }
  },

  updateQuote: async (projectId, quoteId, token, body) => {
    set({ loading: true, error: null });
    try {
      const quote = await fetchApi<Quote>(
        `/projects/${projectId}/quotes/${quoteId}`,
        token,
        { method: "PUT", body: JSON.stringify(body) },
      );
      set((s) => ({
        quotes: s.quotes.map((q) => (q.id === quoteId ? quote : q)),
        currentQuote: quote,
        loading: false,
      }));
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  updateStatus: async (projectId, quoteId, token, status) => {
    try {
      const quote = await fetchApi<Quote>(
        `/projects/${projectId}/quotes/${quoteId}/status`,
        token,
        { method: "PUT", body: JSON.stringify({ status }) },
      );
      set((s) => ({
        quotes: s.quotes.map((q) => (q.id === quoteId ? quote : q)),
        currentQuote: quote,
      }));
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },

  setCurrentQuote: (quote) => set({ currentQuote: quote }),
  reset: () =>
    set({ quotes: [], currentQuote: null, loading: false, error: null }),
}));
