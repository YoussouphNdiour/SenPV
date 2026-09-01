"use client";

import { useTranslations } from "next-intl";
import { usePanelStore } from "@/store/panels";
import type { Equipment, PanelSpecs } from "@/types/equipment";

interface PanelBadgeProps {
  panels: Equipment[];
}

export function PanelBadge({ panels }: PanelBadgeProps) {
  const t = useTranslations("map");
  const { layouts } = usePanelStore();

  const totalPanels = layouts.reduce((sum, l) => sum + l.num_panels, 0);

  if (totalPanels === 0) return null;

  // Calculate total kWc from all layouts
  let totalKwc = 0;
  for (const layout of layouts) {
    const panelModel = panels.find((p) => p.id === layout.panel_model_id);
    if (panelModel) {
      const specs = panelModel.specs as PanelSpecs;
      totalKwc += (layout.num_panels * specs.pmax_w) / 1000;
    }
  }

  return (
    <div className="absolute bottom-4 left-4 z-10 bg-background/90 backdrop-blur px-4 py-2 rounded-lg shadow border flex items-center gap-3">
      <span className="text-sm font-medium">
        {t("panelCount", { count: totalPanels })}
      </span>
      <span className="text-sm text-muted-foreground">—</span>
      <span className="text-sm font-medium text-primary">
        {t("peakPower", { kwc: totalKwc.toFixed(1) })}
      </span>
    </div>
  );
}
