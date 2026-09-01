"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";

export function BreakerNode({ data }: NodeProps) {
  const isDC = data.dc === true || data.cable_type === "dc";
  const borderColor = isDC ? "border-red-500" : "border-blue-500";
  const bgColor = isDC ? "bg-red-50" : "bg-blue-50";
  const textColor = isDC ? "text-red-800" : "text-blue-800";
  const strokeColor = isDC ? "#ef4444" : "#3b82f6";

  return (
    <div className={`rounded border-2 ${borderColor} ${bgColor} px-3 py-2 text-center text-xs shadow-sm`}>
      <svg width="36" height="32" viewBox="0 0 36 32" className="mx-auto mb-1">
        {/* Breaker symbol: line with angled break */}
        <line x1="4" y1="24" x2="14" y2="24" stroke={strokeColor} strokeWidth="2" />
        <line x1="14" y1="24" x2="24" y2="8" stroke={strokeColor} strokeWidth="2" />
        <circle cx="14" cy="24" r="2" fill={strokeColor} />
        <line x1="24" y1="16" x2="32" y2="16" stroke={strokeColor} strokeWidth="2" />
        <circle cx="24" cy="16" r="2" fill={strokeColor} />
      </svg>
      <div className={`font-semibold ${textColor}`}>{data.label as string}</div>
      <Handle type="target" position={Position.Left} className={isDC ? "!bg-red-500" : "!bg-blue-500"} />
      <Handle type="source" position={Position.Right} className={isDC ? "!bg-red-500" : "!bg-blue-500"} />
    </div>
  );
}
