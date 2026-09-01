"use client";
import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, type EdgeProps } from "@xyflow/react";

export function CableEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  style,
}: EdgeProps) {
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX, sourceY, targetX, targetY,
    sourcePosition, targetPosition,
  });

  const cableType = (data?.cable_type as string) || "dc";
  const sectionMm2 = data?.section_mm2 as number;

  // Colors: red for DC, blue for AC, green for ground
  const colorMap: Record<string, string> = {
    dc: "#dc2626",
    ac: "#2563eb",
    ground: "#16a34a",
  };
  const color = colorMap[cableType] || "#6b7280";

  // Style: solid for DC, dashed for AC
  const strokeDasharray = cableType === "ac" ? "8 4" : cableType === "ground" ? "4 4" : undefined;

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          ...style,
          stroke: color,
          strokeWidth: 2,
          strokeDasharray,
        }}
      />
      {sectionMm2 && (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan rounded bg-white px-1 py-0.5 text-[10px] font-medium shadow-sm"
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              color,
              pointerEvents: "all",
            }}
          >
            {sectionMm2}mm²
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

export const edgeTypes = {
  cable: CableEdge,
};
