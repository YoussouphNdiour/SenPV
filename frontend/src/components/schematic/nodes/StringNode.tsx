"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";

export function StringNode({ data }: NodeProps) {
  const count = (data.panel_count as number) ?? "n";

  return (
    <div className="rounded border-2 border-indigo-600 bg-indigo-50 px-3 py-2 text-center text-xs shadow-sm">
      <svg width="36" height="28" viewBox="0 0 36 28" className="mx-auto mb-1">
        <rect x="2" y="2" width="32" height="24" rx="2" fill="none" stroke="#4f46e5" strokeWidth="2" />
        <text x="18" y="18" textAnchor="middle" fontSize="12" fontWeight="bold" fill="#4f46e5">
          {String(count)}S
        </text>
      </svg>
      <div className="font-semibold text-indigo-800">{data.label as string}</div>
      <Handle type="target" position={Position.Left} className="!bg-indigo-600" />
      <Handle type="source" position={Position.Right} className="!bg-indigo-600" />
    </div>
  );
}
