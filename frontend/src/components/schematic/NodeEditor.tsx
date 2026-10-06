"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { X, Trash2 } from "lucide-react";
import type { Node } from "@xyflow/react";
import type { SchematicNodeData } from "@/types/schematic";

interface NodeEditorProps {
  node: Node<SchematicNodeData> | null;
  onUpdate: (nodeId: string, data: SchematicNodeData) => void;
  onDelete: (nodeId: string) => void;
  onClose: () => void;
}

/** Editable fields per node type */
const FIELDS_BY_TYPE: Record<string, { key: string; i18nKey: string; type: "text" | "number" }[]> = {
  panel: [
    { key: "label", i18nKey: "editLabel", type: "text" },
    { key: "pmax_w", i18nKey: "editPower", type: "number" },
    { key: "voc_v", i18nKey: "editVoltage", type: "number" },
    { key: "isc_a", i18nKey: "editRating", type: "number" },
  ],
  string: [
    { key: "label", i18nKey: "editLabel", type: "text" },
    { key: "num_panels", i18nKey: "editPanelCount", type: "number" },
  ],
  inverter: [
    { key: "label", i18nKey: "editLabel", type: "text" },
    { key: "rated_ac_power_kw", i18nKey: "editPower", type: "number" },
    { key: "num_mppt", i18nKey: "editMppt", type: "number" },
  ],
  dc_breaker: [
    { key: "label", i18nKey: "editLabel", type: "text" },
    { key: "rating_a", i18nKey: "editRating", type: "number" },
    { key: "poles", i18nKey: "editPoles", type: "number" },
  ],
  ac_breaker: [
    { key: "label", i18nKey: "editLabel", type: "text" },
    { key: "rating_a", i18nKey: "editRating", type: "number" },
    { key: "poles", i18nKey: "editPoles", type: "number" },
  ],
  dc_surge: [
    { key: "label", i18nKey: "editLabel", type: "text" },
    { key: "surge_type", i18nKey: "editSurgeType", type: "text" },
    { key: "max_voltage_v", i18nKey: "editVoltage", type: "number" },
  ],
  ac_surge: [
    { key: "label", i18nKey: "editLabel", type: "text" },
    { key: "surge_type", i18nKey: "editSurgeType", type: "text" },
    { key: "max_voltage_v", i18nKey: "editVoltage", type: "number" },
  ],
  dc_box: [
    { key: "label", i18nKey: "editLabel", type: "text" },
    { key: "num_strings", i18nKey: "editPanelCount", type: "number" },
  ],
  ac_box: [
    { key: "label", i18nKey: "editLabel", type: "text" },
    { key: "rated_current_a", i18nKey: "editRating", type: "number" },
  ],
  meter: [
    { key: "label", i18nKey: "editLabel", type: "text" },
    { key: "meter_type", i18nKey: "editMeterType", type: "text" },
  ],
  grid: [
    { key: "label", i18nKey: "editLabel", type: "text" },
    { key: "voltage_v", i18nKey: "editVoltage", type: "number" },
  ],
  ground: [
    { key: "label", i18nKey: "editLabel", type: "text" },
    { key: "resistance_ohm", i18nKey: "editResistance", type: "number" },
  ],
};

export function NodeEditor({ node, onUpdate, onDelete, onClose }: NodeEditorProps) {
  const t = useTranslations("schematic");
  const [formData, setFormData] = useState<Record<string, unknown>>({});

  useEffect(() => {
    if (node) {
      setFormData({ ...node.data });
    }
  }, [node]);

  if (!node) {
    return (
      <div className="w-64 border-l bg-white p-4">
        <h3 className="text-sm font-semibold text-gray-500">{t("nodeEditor")}</h3>
        <p className="mt-4 text-xs text-gray-400">{t("clickNodeToEdit")}</p>
      </div>
    );
  }

  const nodeType = node.type || (node.data.node_type as string) || "";
  const fields = FIELDS_BY_TYPE[nodeType] || [{ key: "label", i18nKey: "editLabel", type: "text" as const }];

  const handleChange = (key: string, value: string, fieldType: "text" | "number") => {
    setFormData((prev) => ({
      ...prev,
      [key]: fieldType === "number" ? (value === "" ? 0 : Number(value)) : value,
    }));
  };

  const handleApply = () => {
    onUpdate(node.id, formData as SchematicNodeData);
  };

  const NODE_TYPE_LABELS: Record<string, string> = {
    panel: t("panel"),
    string: t("string"),
    inverter: t("inverter"),
    dc_breaker: t("breaker") + " DC",
    ac_breaker: t("breaker") + " AC",
    dc_surge: t("surge") + " DC",
    ac_surge: t("surge") + " AC",
    dc_box: t("dcBox"),
    ac_box: t("acBox"),
    meter: t("meter"),
    grid: t("grid"),
    ground: t("ground"),
  };

  return (
    <div className="w-64 border-l bg-white">
      <div className="flex items-center justify-between border-b px-4 py-2">
        <h3 className="text-sm font-semibold text-gray-700">{t("nodeEditor")}</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
          <X className="size-4" />
        </button>
      </div>

      <div className="p-4">
        <div className="mb-3 rounded bg-gray-50 px-3 py-2 text-xs font-medium text-gray-600">
          {NODE_TYPE_LABELS[nodeType] || nodeType}
        </div>

        <div className="space-y-3">
          {fields.map((field) => (
            <div key={field.key}>
              <label className="mb-1 block text-xs font-medium text-gray-500">
                {t(field.i18nKey)}
              </label>
              <input
                type={field.type}
                value={String(formData[field.key] ?? "")}
                onChange={(e) => handleChange(field.key, e.target.value, field.type)}
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-xs focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          ))}
        </div>

        <div className="mt-4 flex gap-2">
          <button
            onClick={handleApply}
            className="flex-1 rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
          >
            {t("applyChanges")}
          </button>
          <button
            onClick={() => onDelete(node.id)}
            className="rounded border border-red-300 px-2 py-1.5 text-xs text-red-600 hover:bg-red-50"
            title={t("deleteNode")}
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
