"use client";

import { useTranslations } from "next-intl";
import { Plus, MousePointer, Trash2, Undo2, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useMapStore, type MapMode } from "@/store/map";
import { usePanelStore } from "@/store/panels";
import { cn } from "@/lib/utils";

interface PanelToolbarProps {
  projectId: string;
  token: string;
}

const panelTools: {
  mode: MapMode;
  icon: React.ComponentType<{ className?: string }>;
  labelKey: string;
}[] = [
  { mode: "add-panel", icon: Plus, labelKey: "addPanel" },
  { mode: "select-panel", icon: MousePointer, labelKey: "selectPanel" },
  { mode: "delete-panel", icon: Trash2, labelKey: "deletePanel" },
];

export function PanelToolbar({ projectId, token }: PanelToolbarProps) {
  const t = useTranslations("map");
  const tc = useTranslations("common");
  const { mapMode, setMapMode } = useMapStore();
  const { selectedLayoutId, history, undo, clearAllPanels, layouts } =
    usePanelStore();

  const hasLayout = selectedLayoutId && layouts.some((l) => l.id === selectedLayoutId);
  const currentLayout = layouts.find((l) => l.id === selectedLayoutId);
  const hasPanels = currentLayout && currentLayout.num_panels > 0;

  const handleToolClick = (mode: MapMode) => {
    if (mapMode === mode) {
      setMapMode("navigate");
    } else {
      setMapMode(mode);
    }
  };

  const handleUndo = async () => {
    if (history.length > 0) {
      await undo(projectId, token);
    }
  };

  const handleClearAll = async () => {
    if (!selectedLayoutId || !hasPanels) return;
    if (!confirm(t("clearAllConfirm"))) return;
    await clearAllPanels(projectId, selectedLayoutId, token);
  };

  if (!hasLayout) return null;

  return (
    <div className="absolute top-3 left-16 flex flex-col gap-1 z-10">
      {panelTools.map(({ mode, icon: Icon, labelKey }) => (
        <Button
          key={mode}
          variant={mapMode === mode ? "default" : "secondary"}
          size="icon"
          className={cn(
            "shadow-lg",
            mapMode === mode && "ring-2 ring-primary"
          )}
          onClick={() => handleToolClick(mode)}
          title={t(labelKey)}
        >
          <Icon className="size-4" />
        </Button>
      ))}

      {/* Undo */}
      {history.length > 0 && (
        <Button
          variant="secondary"
          size="icon"
          className="shadow-lg"
          onClick={handleUndo}
          title={t("undo")}
        >
          <Undo2 className="size-4" />
        </Button>
      )}

      {/* Clear all */}
      {hasPanels && (
        <Button
          variant="secondary"
          size="icon"
          className="shadow-lg text-destructive hover:text-destructive"
          onClick={handleClearAll}
          title={t("clearAll")}
        >
          <XCircle className="size-4" />
        </Button>
      )}
    </div>
  );
}
