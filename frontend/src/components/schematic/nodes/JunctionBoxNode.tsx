"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";

export function JunctionBoxNode({ data }: NodeProps) {
  return (
    <div className="rounded border-2 border-dashed border-gray-400 bg-gray-50 px-4 py-3 text-center text-xs shadow-sm min-w-[80px]">
      <svg width="40" height="28" viewBox="0 0 40 28" className="mx-auto mb-1">
        <rect
          x="2"
          y="2"
          width="36"
          height="24"
          rx="2"
          fill="none"
          stroke="#9ca3af"
          strokeWidth="2"
          strokeDasharray="4,3"
        />
        <circle cx="12" cy="14" r="2" fill="#9ca3af" />
        <circle cx="20" cy="14" r="2" fill="#9ca3af" />
        <circle cx="28" cy="14" r="2" fill="#9ca3af" />
      </svg>
      <div className="font-semibold text-gray-700">{data.label as string}</div>
      <Handle type="target" position={Position.Left} className="!bg-gray-500" />
      <Handle type="source" position={Position.Right} className="!bg-gray-500" />
    </div>
  );
}
