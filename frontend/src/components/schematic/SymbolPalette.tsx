"use client";
import { useTranslations } from "next-intl";

const SYMBOLS = [
  { type: "panel", icon: "⬜", labelKey: "panel" },
  { type: "string", icon: "⊟", labelKey: "string" },
  { type: "dc_breaker", icon: "⚡", labelKey: "breaker" },
  { type: "ac_breaker", icon: "⚡", labelKey: "breaker" },
  { type: "dc_surge", icon: "↯", labelKey: "surge" },
  { type: "ac_surge", icon: "↯", labelKey: "surge" },
  { type: "inverter", icon: "⏦", labelKey: "inverter" },
  { type: "dc_box", icon: "▢", labelKey: "dcBox" },
  { type: "ac_box", icon: "▢", labelKey: "acBox" },
  { type: "meter", icon: "◎", labelKey: "meter" },
  { type: "grid", icon: "⏚", labelKey: "grid" },
  { type: "ground", icon: "⏚", labelKey: "ground" },
] as const;

export function SymbolPalette() {
  const t = useTranslations("schematic");

  const onDragStart = (event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData("application/reactflow", nodeType);
    event.dataTransfer.effectAllowed = "move";
  };

  return (
    <div className="flex w-48 flex-col gap-1 border-r bg-gray-50 p-3">
      <h3 className="mb-2 text-xs font-semibold uppercase text-gray-500">
        {t("symbols")}
      </h3>
      {SYMBOLS.map((sym) => (
        <div
          key={sym.type}
          className="flex cursor-grab items-center gap-2 rounded border bg-white px-2 py-1.5 text-xs shadow-sm transition-colors hover:bg-gray-100 active:cursor-grabbing"
          draggable
          onDragStart={(e) => onDragStart(e, sym.type)}
        >
          <span className="text-base">{sym.icon}</span>
          <span>{sym.type.includes("dc") ? "DC " : sym.type.includes("ac") ? "AC " : ""}{t(sym.labelKey)}</span>
        </div>
      ))}
    </div>
  );
}
