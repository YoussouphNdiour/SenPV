"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";

export function InverterNode({ data }: NodeProps) {
  return (
    <div className="rounded-lg border-2 border-amber-500 bg-amber-50 px-4 py-3 text-center text-xs shadow-sm min-w-[100px]">
      <svg width="48" height="36" viewBox="0 0 48 36" className="mx-auto mb-1">
        <rect x="2" y="2" width="44" height="32" rx="3" fill="none" stroke="#f59e0b" strokeWidth="2" />
        {/* DC side (left) */}
        <text x="12" y="22" textAnchor="middle" fontSize="14" fontWeight="bold" fill="#d97706">
          =
        </text>
        {/* Separator */}
        <line x1="24" y1="4" x2="24" y2="32" stroke="#f59e0b" strokeWidth="1" strokeDasharray="3,2" />
        {/* AC side (right) */}
        <text x="36" y="22" textAnchor="middle" fontSize="14" fontWeight="bold" fill="#d97706">
          ~
        </text>
      </svg>
      <div className="font-semibold text-amber-800">{data.label as string}</div>
      <Handle type="target" position={Position.Left} className="!bg-amber-500" />
      <Handle type="source" position={Position.Right} className="!bg-amber-500" />
      <Handle type="source" position={Position.Bottom} id="ground" className="!bg-green-600" />
    </div>
  );
}
