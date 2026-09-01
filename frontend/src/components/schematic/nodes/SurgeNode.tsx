"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";

export function SurgeNode({ data }: NodeProps) {
  return (
    <div className="rounded border-2 border-yellow-500 bg-yellow-50 px-3 py-2 text-center text-xs shadow-sm">
      <svg width="28" height="40" viewBox="0 0 28 40" className="mx-auto mb-1">
        {/* Zigzag surge arrester symbol */}
        <line x1="14" y1="2" x2="14" y2="8" stroke="#eab308" strokeWidth="2" />
        <polyline
          points="14,8 8,14 20,20 8,26 14,30"
          fill="none"
          stroke="#eab308"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        {/* Ground lines */}
        <line x1="14" y1="30" x2="14" y2="34" stroke="#eab308" strokeWidth="2" />
        <line x1="8" y1="34" x2="20" y2="34" stroke="#eab308" strokeWidth="2" />
        <line x1="10" y1="37" x2="18" y2="37" stroke="#eab308" strokeWidth="1.5" />
        <line x1="12" y1="39" x2="16" y2="39" stroke="#eab308" strokeWidth="1" />
      </svg>
      <div className="font-semibold text-yellow-800">{data.label as string ?? "Type 2"}</div>
      <Handle type="target" position={Position.Left} className="!bg-yellow-500" />
      <Handle type="source" position={Position.Right} className="!bg-yellow-500" />
      <Handle type="source" position={Position.Bottom} id="ground" className="!bg-green-600" />
    </div>
  );
}
