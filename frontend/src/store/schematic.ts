import { create } from 'zustand';
import { Node, Edge } from '@xyflow/react';
import type { SchematicNodeData, SchematicEdgeData, ValidationError, SchematicGenerateResponse } from '@/types/schematic';

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function fetchApi<T>(path: string, token: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(detail || res.statusText);
  }
  return res.json();
}

interface SchematicStore {
  nodes: Node<SchematicNodeData>[];
  edges: Edge<SchematicEdgeData>[];
  validationErrors: ValidationError[];
  loading: boolean;
  error: string | null;
  hasSchematic: boolean;

  generateSchematic: (projectId: string, token: string) => Promise<void>;
  loadSchematic: (projectId: string, token: string) => Promise<void>;
  saveSchematic: (projectId: string, token: string) => Promise<void>;
  validateSchematic: (projectId: string, token: string) => Promise<void>;
  exportSvg: (projectId: string, token: string) => Promise<void>;
  updateNodes: (nodes: Node<SchematicNodeData>[]) => void;
  updateEdges: (edges: Edge<SchematicEdgeData>[]) => void;
  reset: () => void;
}

export const useSchematicStore = create<SchematicStore>((set, get) => ({
  nodes: [],
  edges: [],
  validationErrors: [],
  loading: false,
  error: null,
  hasSchematic: false,

  generateSchematic: async (projectId, token) => {
    set({ loading: true, error: null });
    try {
      const data = await fetchApi<SchematicGenerateResponse>(
        `/projects/${projectId}/schematic/generate`,
        token,
        { method: "POST" }
      );
      set({
        nodes: data.nodes.map(n => ({ ...n, data: n.data } as Node<SchematicNodeData>)),
        edges: data.edges.map(e => ({ ...e, data: e.data } as Edge<SchematicEdgeData>)),
        validationErrors: data.validation_errors,
        hasSchematic: true,
        loading: false,
      });
    } catch (e) {
      set({ error: (e as Error).message, loading: false });
    }
  },

  loadSchematic: async (projectId, token) => {
    set({ loading: true, error: null });
    try {
      const data = await fetchApi<any>(
        `/projects/${projectId}/schematic`,
        token
      );
      set({
        nodes: data.nodes.map((n: any) => ({ ...n, data: n.data })),
        edges: data.edges.map((e: any) => ({ ...e, data: e.data })),
        validationErrors: data.validation_errors || [],
        hasSchematic: true,
        loading: false,
      });
    } catch (e) {
      // 404 means no schematic yet
      set({ hasSchematic: false, loading: false });
    }
  },

  saveSchematic: async (projectId, token) => {
    set({ loading: true, error: null });
    try {
      const { nodes, edges } = get();
      const data = await fetchApi<any>(
        `/projects/${projectId}/schematic`,
        token,
        {
          method: "PUT",
          body: JSON.stringify({
            nodes: nodes.map(n => ({
              id: n.id,
              type: n.type,
              position: n.position,
              data: n.data,
            })),
            edges: edges.map(e => ({
              id: e.id,
              source: e.source,
              target: e.target,
              sourceHandle: e.sourceHandle,
              targetHandle: e.targetHandle,
              type: e.type,
              data: e.data,
            })),
          }),
        }
      );
      set({ validationErrors: data.validation_errors || [], loading: false });
    } catch (e) {
      set({ error: (e as Error).message, loading: false });
    }
  },

  validateSchematic: async (projectId, token) => {
    set({ loading: true, error: null });
    try {
      const { nodes, edges } = get();
      const data = await fetchApi<any>(
        `/projects/${projectId}/schematic/validate`,
        token,
        {
          method: "POST",
          body: JSON.stringify({
            nodes: nodes.map(n => ({
              id: n.id,
              type: n.type,
              position: n.position,
              data: n.data,
            })),
            edges: edges.map(e => ({
              id: e.id,
              source: e.source,
              target: e.target,
              sourceHandle: e.sourceHandle,
              targetHandle: e.targetHandle,
              type: e.type,
              data: e.data,
            })),
          }),
        }
      );
      set({ validationErrors: data.validation_errors, loading: false });
    } catch (e) {
      set({ error: (e as Error).message, loading: false });
    }
  },

  exportSvg: async (projectId, token) => {
    set({ loading: true, error: null });
    try {
      await fetchApi<any>(
        `/projects/${projectId}/schematic/export-svg`,
        token,
        { method: "POST" }
      );
      set({ loading: false });
    } catch (e) {
      set({ error: (e as Error).message, loading: false });
    }
  },

  updateNodes: (nodes) => set({ nodes }),
  updateEdges: (edges) => set({ edges }),
  reset: () => set({ nodes: [], edges: [], validationErrors: [], loading: false, error: null, hasSchematic: false }),
}));
