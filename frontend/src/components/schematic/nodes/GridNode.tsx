"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";

export function GridNode({ data }: NodeProps) {
  return (
    <div className="rounded border-2 border-gray-800 bg-gray-100 px-4 py-3 text-center text-xs shadow-sm">
      <svg width="40" height="32" viewBox="0 0 40 32" className="mx-auto mb-1">
        {/* Power grid symbol: 3 parallel lines with tower shape */}
        <line x1="8" y1="8" x2="32" y2="8" stroke="#1f2937" strokeWidth="2.5" />
        <line x1="8" y1="16" x2="32" y2="16" stroke="#1f2937" strokeWidth="2.5" />
        <line x1="8" y1="24" x2="32" y2="24" stroke="#1f2937" strokeWidth="2.5" />
        {/* Vertical connectors */}
        <line x1="6" y1="6" x2="6" y2="26" stroke="#1f2937" strokeWidth="2" />
        <line x1="34" y1="6" x2="34" y2="26" stroke="#1f2937" strokeWidth="2" />
      </svg>
      <div className="font-bold text-gray-900">{data.label as string ?? "SENELEC"}</div>
      <Handle type="target" position={Position.Left} className="!bg-gray-800" />
    </div>
  );
}
