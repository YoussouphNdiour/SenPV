"use client";

import { useTranslations } from "next-intl";
import { PenTool, MousePointer, Trash2, Undo2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useMapStore, type MapMode } from "@/store/map";
import { cn } from "@/lib/utils";

const tools: {
  mode: MapMode;
  icon: React.ComponentType<{ className?: string }>;
  labelKey: string;
}[] = [
  { mode: "draw-zone", icon: PenTool, labelKey: "drawRoof" },
  { mode: "edit-zone", icon: MousePointer, labelKey: "selectPanel" },
  { mode: "delete-zone", icon: Trash2, labelKey: "deletePanel" },
];

export function DrawingTools() {
  const t = useTranslations("map");
  const { mapMode, setMapMode, drawingPoints, undoDrawingPoint, clearDrawingPoints } =
    useMapStore();

  const handleToolClick = (mode: MapMode) => {
    if (mapMode === mode) {
      setMapMode("navigate");
      clearDrawingPoints();
    } else {
      setMapMode(mode);
      clearDrawingPoints();
    }
  };

  return (
    <div className="absolute top-3 left-3 flex flex-col gap-1 z-10">
      {tools.map(({ mode, icon: Icon, labelKey }) => (
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

      {/* Undo button - only visible when drawing */}
      {mapMode === "draw-zone" && drawingPoints.length > 0 && (
        <Button
          variant="secondary"
          size="icon"
          className="shadow-lg"
          onClick={undoDrawingPoint}
          title={t("undo")}
        >
          <Undo2 className="size-4" />
        </Button>
      )}
    </div>
  );
}
