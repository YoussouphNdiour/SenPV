"use client";
import { useTranslations } from "next-intl";
import { AlertTriangle, XCircle, CheckCircle } from "lucide-react";
import type { ValidationError } from "@/types/schematic";
import { useReactFlow } from "@xyflow/react";

interface ValidationPanelProps {
  errors: ValidationError[];
}

export function ValidationPanel({ errors }: ValidationPanelProps) {
  const t = useTranslations("schematic");
  const { fitView, setCenter } = useReactFlow();

  const criticalCount = errors.filter((e) => e.severity === "critical").length;
  const warningCount = errors.filter((e) => e.severity === "warning").length;

  const handleErrorClick = (error: ValidationError) => {
    if (error.nodes && error.nodes.length > 0) {
      // Highlight and zoom to the first affected node
      // This is a simplified version - just fits view for now
      fitView({ nodes: error.nodes.map((id) => ({ id })), duration: 500 });
    }
  };

  return (
    <div className="flex w-64 flex-col border-l bg-gray-50">
      <div className="border-b p-3">
        <h3 className="text-sm font-semibold">{t("validate")}</h3>
        <div className="mt-1 flex gap-3 text-xs">
          {criticalCount > 0 && (
            <span className="flex items-center gap-1 text-red-600">
              <XCircle className="size-3" /> {criticalCount}
            </span>
          )}
          {warningCount > 0 && (
            <span className="flex items-center gap-1 text-amber-600">
              <AlertTriangle className="size-3" /> {warningCount}
            </span>
          )}
          {errors.length === 0 && (
            <span className="flex items-center gap-1 text-green-600">
              <CheckCircle className="size-3" /> {t("noErrors")}
            </span>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {errors.map((error, i) => (
          <button
            key={i}
            onClick={() => handleErrorClick(error)}
            className="mb-1 flex w-full items-start gap-2 rounded border bg-white p-2 text-left text-xs shadow-sm transition-colors hover:bg-gray-100"
          >
            {error.severity === "critical" ? (
              <XCircle className="mt-0.5 size-3.5 shrink-0 text-red-500" />
            ) : (
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-500" />
            )}
            <span>{error.message}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
