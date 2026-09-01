"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";

export function GroundNode({ data }: NodeProps) {
  return (
    <div className="px-2 py-1 text-center text-xs">
      <svg width="28" height="32" viewBox="0 0 28 32" className="mx-auto">
        {/* Vertical line */}
        <line x1="14" y1="2" x2="14" y2="12" stroke="#16a34a" strokeWidth="2" />
        {/* Ground symbol: 3 horizontal lines decreasing in width */}
        <line x1="4" y1="12" x2="24" y2="12" stroke="#16a34a" strokeWidth="2.5" />
        <line x1="7" y1="18" x2="21" y2="18" stroke="#16a34a" strokeWidth="2" />
        <line x1="10" y1="24" x2="18" y2="24" stroke="#16a34a" strokeWidth="1.5" />
      </svg>
      <div className="font-semibold text-green-800">{data.label as string ?? "Terre"}</div>
      <Handle type="target" position={Position.Top} className="!bg-green-600" />
    </div>
  );
}
