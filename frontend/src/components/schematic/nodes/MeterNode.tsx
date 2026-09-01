"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";

export function MeterNode({ data }: NodeProps) {
  return (
    <div className="rounded-full border-2 border-green-600 bg-green-50 px-4 py-3 text-center text-xs shadow-sm">
      <svg width="36" height="36" viewBox="0 0 36 36" className="mx-auto mb-1">
        <circle cx="18" cy="18" r="15" fill="none" stroke="#16a34a" strokeWidth="2" />
        {/* Bidirectional arrows */}
        <line x1="8" y1="18" x2="28" y2="18" stroke="#16a34a" strokeWidth="2" />
        {/* Left arrow */}
        <polyline points="12,14 8,18 12,22" fill="none" stroke="#16a34a" strokeWidth="2" />
        {/* Right arrow */}
        <polyline points="24,14 28,18 24,22" fill="none" stroke="#16a34a" strokeWidth="2" />
      </svg>
      <div className="font-semibold text-green-800">{data.label as string ?? "Compteur"}</div>
      <Handle type="target" position={Position.Left} className="!bg-green-600" />
      <Handle type="source" position={Position.Right} className="!bg-green-600" />
    </div>
  );
}
