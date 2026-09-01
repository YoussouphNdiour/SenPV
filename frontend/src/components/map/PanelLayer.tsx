"use client";

import { useMemo } from "react";
import { PolygonLayer } from "@deck.gl/layers";

interface PanelData {
  id: string;
  polygon: [number, number][];
  selected: boolean;
}

interface PanelLayerProps {
  panels: PanelData[];
  selectedPanelId?: string | null;
}

export function usePanelLayer({ panels, selectedPanelId }: PanelLayerProps) {
  const layer = useMemo(() => {
    return new PolygonLayer<PanelData>({
      id: "panel-layer",
      data: panels,
      getPolygon: (d) => d.polygon,
      getFillColor: (d) =>
        d.id === selectedPanelId
          ? [96, 165, 250, 200] // blue-400 selected
          : [30, 64, 175, 200], // blue-800 default
      getLineColor: [255, 255, 255, 180],
      getLineWidth: 1,
      lineWidthMinPixels: 1,
      pickable: true,
      extruded: false,
    });
  }, [panels, selectedPanelId]);

  return layer;
}
