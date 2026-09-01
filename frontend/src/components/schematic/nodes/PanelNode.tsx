"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";

export function PanelNode({ data }: NodeProps) {
  return (
    <div className="rounded border-2 border-blue-600 bg-blue-50 px-3 py-2 text-center text-xs shadow-sm">
      <svg width="32" height="32" viewBox="0 0 32 32" className="mx-auto mb-1">
        <rect x="2" y="2" width="28" height="28" fill="none" stroke="#2563eb" strokeWidth="2" />
        <line x1="2" y1="11" x2="30" y2="11" stroke="#2563eb" strokeWidth="1" />
        <line x1="2" y1="21" x2="30" y2="21" stroke="#2563eb" strokeWidth="1" />
        <line x1="11" y1="2" x2="11" y2="30" stroke="#2563eb" strokeWidth="1" />
        <line x1="21" y1="2" x2="21" y2="30" stroke="#2563eb" strokeWidth="1" />
      </svg>
      <div className="font-semibold text-blue-800">{data.label as string}</div>
      <Handle type="source" position={Position.Right} className="!bg-blue-600" />
    </div>
  );
}
