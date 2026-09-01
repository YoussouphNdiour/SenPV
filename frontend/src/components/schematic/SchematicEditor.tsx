"use client";
import { useCallback, useEffect, useRef } from "react";
import {
  ReactFlow,
  Background,
  MiniMap,
  Controls,
  useNodesState,
  useEdgesState,
  addEdge,
  type Connection,
  type Node,
  ReactFlowProvider,
  BackgroundVariant,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useTranslations } from "next-intl";
import { CheckCircle, Download, RefreshCw, Save } from "lucide-react";
import { useSchematicStore } from "@/store/schematic";
import { nodeTypes } from "./nodes";
import { edgeTypes } from "./edges";
import { SymbolPalette } from "./SymbolPalette";
import { ValidationPanel } from "./ValidationPanel";

interface SchematicEditorProps {
  projectId: string;
  token: string;
}

function SchematicEditorInner({ projectId, token }: SchematicEditorProps) {
  const t = useTranslations("schematic");
  const store = useSchematicStore();
  const reactFlowWrapper = useRef<HTMLDivElement>(null);

  const [nodes, setNodes, onNodesChange] = useNodesState(store.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(store.edges);

  // Sync store -> local state
  useEffect(() => {
    setNodes(store.nodes);
    setEdges(store.edges);
  }, [store.nodes, store.edges, setNodes, setEdges]);

  // Sync local state -> store (debounced on change)
  useEffect(() => {
    store.updateNodes(nodes);
  }, [nodes]);

  useEffect(() => {
    store.updateEdges(edges);
  }, [edges]);

  // Load schematic on mount
  useEffect(() => {
    store.loadSchematic(projectId, token);
  }, [projectId, token]);

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) =>
        addEdge(
          { ...connection, type: "cable", data: { cable_type: "dc", section_mm2: 4 } },
          eds,
        ) as typeof eds
      );
    },
    [setEdges]
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const type = event.dataTransfer.getData("application/reactflow");
      if (!type || !reactFlowWrapper.current) return;

      const bounds = reactFlowWrapper.current.getBoundingClientRect();
      const position = {
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
      };

      const newNode = {
        id: `${type}_${Date.now()}`,
        type,
        position,
        data: { node_type: type, label: type } as Record<string, unknown>,
      } as Node;

      setNodes((nds) => [...nds, newNode] as typeof nds);
    },
    [setNodes]
  );

  return (
    <div className="flex h-full w-full">
      {/* Left: Symbol Palette */}
      <SymbolPalette />

      {/* Center: Canvas + Toolbar */}
      <div className="flex flex-1 flex-col">
        {/* Toolbar */}
        <div className="flex items-center gap-2 border-b bg-white px-4 py-2">
          <button
            onClick={() => store.generateSchematic(projectId, token)}
            disabled={store.loading}
            className="flex items-center gap-1.5 rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
          >
            <RefreshCw className={`size-3.5 ${store.loading ? "animate-spin" : ""}`} />
            {t("generate")}
          </button>
          <button
            onClick={() => store.validateSchematic(projectId, token)}
            disabled={store.loading}
            className="flex items-center gap-1.5 rounded border bg-white px-3 py-1.5 text-xs font-medium transition-colors hover:bg-gray-50 disabled:opacity-50"
          >
            <CheckCircle className="size-3.5" />
            {t("validate")}
          </button>
          <button
            onClick={() => store.saveSchematic(projectId, token)}
            disabled={store.loading}
            className="flex items-center gap-1.5 rounded border bg-white px-3 py-1.5 text-xs font-medium transition-colors hover:bg-gray-50 disabled:opacity-50"
          >
            <Save className="size-3.5" />
            {t("save") || "Save"}
          </button>
          <button
            onClick={() => store.exportSvg(projectId, token)}
            disabled={store.loading}
            className="flex items-center gap-1.5 rounded border bg-white px-3 py-1.5 text-xs font-medium transition-colors hover:bg-gray-50 disabled:opacity-50"
          >
            <Download className="size-3.5" />
            {t("exportSvg")}
          </button>
          {store.error && (
            <span className="ml-auto text-xs text-red-500">{store.error}</span>
          )}
        </div>

        {/* React Flow Canvas */}
        <div ref={reactFlowWrapper} className="flex-1">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onDragOver={onDragOver}
            onDrop={onDrop}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            fitView
            className="bg-gray-100"
          >
            <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
            <MiniMap
              className="!bottom-4 !right-4"
              nodeStrokeWidth={3}
              zoomable
              pannable
            />
            <Controls className="!bottom-4 !left-4" />
          </ReactFlow>
        </div>
      </div>

      {/* Right: Validation Panel */}
      <ValidationPanel errors={store.validationErrors} />
    </div>
  );
}

export default function SchematicEditor(props: SchematicEditorProps) {
  return (
    <ReactFlowProvider>
      <SchematicEditorInner {...props} />
    </ReactFlowProvider>
  );
}
