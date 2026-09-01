"use client";

import { useEffect, useRef, useMemo } from "react";
import { usePanelStore } from "@/store/panels";

interface PanelGridProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mapRef: React.RefObject<any>;
  mapReady: boolean;
}

const PANEL_COLOR = "#1e3a5f";
const PANEL_HOVER_COLOR = "#4a90d9";
const PANEL_SELECTED_COLOR = "#60a5fa";

export function PanelGrid({ mapRef, mapReady }: PanelGridProps) {
  const { layouts, selectedPanelIndex } = usePanelStore();
  const sourceAdded = useRef(false);

  // Collect all panel features from all layouts
  const allFeatures = useMemo(() => {
    const features: Array<{
      type: "Feature";
      properties: { index: number; layoutId: string; rotation_deg: number };
      geometry: { type: "Polygon"; coordinates: number[][][] };
    }> = [];

    for (const layout of layouts) {
      if (!layout.layout_geojson?.features) continue;
      for (const feature of layout.layout_geojson.features) {
        features.push({
          type: "Feature",
          properties: {
            index: feature.properties.index,
            layoutId: layout.id,
            rotation_deg: feature.properties.rotation_deg,
          },
          geometry: feature.geometry,
        });
      }
    }
    return features;
  }, [layouts]);

  // Add source and layers on first render
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    if (!map.getSource("panels")) {
      map.addSource("panels", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });

      map.addLayer({
        id: "panels-fill",
        type: "fill",
        source: "panels",
        paint: {
          "fill-color": [
            "case",
            ["boolean", ["feature-state", "selected"], false],
            PANEL_SELECTED_COLOR,
            ["boolean", ["feature-state", "hover"], false],
            PANEL_HOVER_COLOR,
            PANEL_COLOR,
          ],
          "fill-opacity": 0.85,
        },
      });

      map.addLayer({
        id: "panels-stroke",
        type: "line",
        source: "panels",
        paint: {
          "line-color": "#ffffff",
          "line-width": 0.5,
          "line-opacity": 0.6,
        },
      });

      sourceAdded.current = true;
    }

    return () => {
      // Cleanup on unmount
      if (map.getLayer("panels-stroke")) map.removeLayer("panels-stroke");
      if (map.getLayer("panels-fill")) map.removeLayer("panels-fill");
      if (map.getSource("panels")) map.removeSource("panels");
      sourceAdded.current = false;
    };
  }, [mapRef, mapReady]);

  // Update data when features change
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const source = map.getSource("panels");
    if (!source) return;

    // Assign unique IDs for feature-state
    const featuresWithId = allFeatures.map((f, i) => ({
      ...f,
      id: i,
    }));

    source.setData({ type: "FeatureCollection", features: featuresWithId });
  }, [allFeatures, mapRef, mapReady]);

  // Handle hover state
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    let hoveredId: number | null = null;

    const onMouseMove = (e: { features?: Array<{ id: number }> }) => {
      if (!e.features?.length) return;

      if (hoveredId !== null) {
        map.setFeatureState(
          { source: "panels", id: hoveredId },
          { hover: false }
        );
      }
      hoveredId = e.features[0].id;
      map.setFeatureState(
        { source: "panels", id: hoveredId },
        { hover: true }
      );
      map.getCanvas().style.cursor = "pointer";
    };

    const onMouseLeave = () => {
      if (hoveredId !== null) {
        map.setFeatureState(
          { source: "panels", id: hoveredId },
          { hover: false }
        );
        hoveredId = null;
      }
      map.getCanvas().style.cursor = "";
    };

    map.on("mousemove", "panels-fill", onMouseMove);
    map.on("mouseleave", "panels-fill", onMouseLeave);

    return () => {
      map.off("mousemove", "panels-fill", onMouseMove);
      map.off("mouseleave", "panels-fill", onMouseLeave);
    };
  }, [mapRef, mapReady]);

  return null; // Rendering is done via MapLibre layers
}
