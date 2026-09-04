"use client";

import { useRef, useEffect, useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import { useSession } from "next-auth/react";

import { useMapStore, type MapMode } from "@/store/map";
import { usePanelStore } from "@/store/panels";
import { useEquipmentStore } from "@/store/equipment";
import type { GeoJSONPolygon } from "@/types/roof-zone";
import { GeoSearch } from "./GeoSearch";
import { DrawingTools } from "./DrawingTools";
import { ZonePropertiesPanel } from "./ZonePropertiesPanel";
import { PanelGrid } from "@/components/panels/PanelGrid";
import { PanelToolbar } from "@/components/panels/PanelToolbar";
import { PanelBadge } from "@/components/panels/PanelBadge";

const ZONE_COLORS = [
  "rgba(59, 130, 246, 0.3)",
  "rgba(16, 185, 129, 0.3)",
  "rgba(245, 158, 11, 0.3)",
  "rgba(239, 68, 68, 0.3)",
  "rgba(139, 92, 246, 0.3)",
  "rgba(236, 72, 153, 0.3)",
];
const ZONE_STROKE_COLORS = [
  "rgb(59, 130, 246)",
  "rgb(16, 185, 129)",
  "rgb(245, 158, 11)",
  "rgb(239, 68, 68)",
  "rgb(139, 92, 246)",
  "rgb(236, 72, 153)",
];

interface MapViewProps {
  projectId: string;
  lat: number;
  lon: number;
}

export function MapView({ projectId, lat, lon }: MapViewProps) {
  const t = useTranslations("map");
  const { data: session } = useSession();
  const token = (session as { accessToken?: string } | null)?.accessToken;

  const mapContainer = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  const previewLineRef = useRef<[number, number] | null>(null);
  const [mapReady, setMapReady] = useState(false);

  const {
    mapMode,
    zones,
    drawingPoints,
    selectedZoneId,
    setSelectedZone,
    addDrawingPoint,
    clearDrawingPoints,
    fetchZones,
    addZone,
    removeZone,
    setMapMode,
  } = useMapStore();

  const {
    layouts,
    selectedLayoutId,
    fetchLayouts,
    addPanel,
    removePanel,
    setSelectedPanelIndex,
  } = usePanelStore();

  const { panels: equipmentPanels, fetchPanels } = useEquipmentStore();

  // Fetch zones, layouts, and equipment on mount
  useEffect(() => {
    if (token && projectId) {
      fetchZones(projectId, token).catch(() => {});
      fetchLayouts(projectId, token).catch(() => {});
      fetchPanels(token).catch(() => {});
    }
  }, [token, projectId, fetchZones, fetchLayouts, fetchPanels]);

  // Initialize map with dynamic import
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    let cancelled = false;

    (async () => {
      const maplibregl = await import("maplibre-gl");
      await import("maplibre-gl/dist/maplibre-gl.css");

      if (cancelled || !mapContainer.current) return;

      const map = new maplibregl.Map({
        container: mapContainer.current,
        style: {
          version: 8,
          sources: {
            "google-satellite": {
              type: "raster",
              tiles: [
                "https://mt0.google.com/vt/lyrs=s&x={x}&y={y}&z={z}",
                "https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}",
                "https://mt2.google.com/vt/lyrs=s&x={x}&y={y}&z={z}",
                "https://mt3.google.com/vt/lyrs=s&x={x}&y={y}&z={z}",
              ],
              tileSize: 256,
              attribution: "&copy; Google",
              maxzoom: 22,
            },
          },
          layers: [
            {
              id: "google-satellite",
              type: "raster",
              source: "google-satellite",
              minzoom: 0,
              maxzoom: 22,
            },
          ],
        },
        center: [lon, lat],
        zoom: 19,
        maxZoom: 22,
        clickTolerance: 10,
      });

      map.addControl(new maplibregl.NavigationControl(), "bottom-right");
      map.addControl(new maplibregl.FullscreenControl(), "bottom-right");
      map.addControl(
        new maplibregl.GeolocateControl({
          positionOptions: { enableHighAccuracy: true },
          trackUserLocation: false,
        }),
        "bottom-right"
      );

      map.on("load", () => {
        // Source for existing zones
        map.addSource("zones", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });
        map.addLayer({
          id: "zones-fill",
          type: "fill",
          source: "zones",
          paint: {
            "fill-color": ["get", "fillColor"],
            "fill-opacity": 0.3,
          },
        });
        map.addLayer({
          id: "zones-stroke",
          type: "line",
          source: "zones",
          paint: {
            "line-color": ["get", "strokeColor"],
            "line-width": 2,
          },
        });

        // Source for drawing preview
        map.addSource("drawing", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });
        map.addLayer({
          id: "drawing-fill",
          type: "fill",
          source: "drawing",
          paint: {
            "fill-color": "rgba(59, 130, 246, 0.2)",
            "fill-opacity": 1,
          },
        });
        map.addLayer({
          id: "drawing-line",
          type: "line",
          source: "drawing",
          paint: {
            "line-color": "rgb(59, 130, 246)",
            "line-width": 2,
            "line-dasharray": [2, 2],
          },
        });

        // Drawing points
        map.addSource("drawing-points", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });
        map.addLayer({
          id: "drawing-points",
          type: "circle",
          source: "drawing-points",
          paint: {
            "circle-radius": 5,
            "circle-color": "rgb(59, 130, 246)",
            "circle-stroke-color": "#fff",
            "circle-stroke-width": 2,
          },
        });

        setMapReady(true);
      });

      // Click handler
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      map.on("click", (e: any) => {
        const mode = useMapStore.getState().mapMode;
        const point: [number, number] = [e.lngLat.lng, e.lngLat.lat];
        console.log("[SenPV] map click — mode:", mode, "point:", point);

        if (mode === "draw-zone") {
          useMapStore.getState().addDrawingPoint(point);
          const pts = useMapStore.getState().drawingPoints;
          console.log("[SenPV] drawing points:", pts);

          // Update map sources directly (bypass React cycle)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const ptsSrc = map.getSource("drawing-points") as any;
          if (ptsSrc) {
            ptsSrc.setData({
              type: "FeatureCollection",
              features: pts.map((p: [number, number]) => ({
                type: "Feature",
                properties: {},
                geometry: { type: "Point", coordinates: p },
              })),
            });
          }
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const drawSrc = map.getSource("drawing") as any;
          if (drawSrc && pts.length >= 2) {
            drawSrc.setData({
              type: "FeatureCollection",
              features: [{
                type: "Feature",
                properties: {},
                geometry: {
                  type: "Polygon",
                  coordinates: [[...pts, pts[0]]],
                },
              }],
            });
          } else if (drawSrc && pts.length === 1) {
            drawSrc.setData({
              type: "FeatureCollection",
              features: [{
                type: "Feature",
                properties: {},
                geometry: {
                  type: "LineString",
                  coordinates: [pts[0], point],
                },
              }],
            });
          }
        } else if (mode === "delete-zone" && map.getLayer("zones-fill")) {
          const features = map.queryRenderedFeatures(e.point, {
            layers: ["zones-fill"],
          });
          if (features.length > 0) {
            const zoneId = features[0].properties?.id;
            if (zoneId) {
              document.dispatchEvent(
                new CustomEvent("senpv:delete-zone", { detail: { zoneId } })
              );
            }
          }
        } else if (mode === "add-panel") {
          document.dispatchEvent(
            new CustomEvent("senpv:add-panel", {
              detail: { lat: e.lngLat.lat, lon: e.lngLat.lng },
            })
          );
        } else if (mode === "delete-panel" && map.getLayer("panels-fill")) {
          const panelFeatures = map.queryRenderedFeatures(e.point, {
            layers: ["panels-fill"],
          });
          if (panelFeatures.length > 0) {
            const props = panelFeatures[0].properties;
            document.dispatchEvent(
              new CustomEvent("senpv:delete-panel", {
                detail: {
                  layoutId: props?.layoutId,
                  panelIndex: props?.index,
                },
              })
            );
          }
        } else if (mode === "select-panel" && map.getLayer("panels-fill")) {
          const panelFeatures = map.queryRenderedFeatures(e.point, {
            layers: ["panels-fill"],
          });
          if (panelFeatures.length > 0) {
            const props = panelFeatures[0].properties;
            usePanelStore
              .getState()
              .setSelectedPanelIndex(props?.index ?? null);
          } else {
            usePanelStore.getState().setSelectedPanelIndex(null);
          }
        } else if (mode === "navigate" || mode === "edit-zone") {
          if (map.getLayer("zones-fill")) {
            const features = map.queryRenderedFeatures(e.point, {
              layers: ["zones-fill"],
            });
            if (features.length > 0) {
              useMapStore.getState().setSelectedZone(features[0].properties?.id || null);
            } else {
              useMapStore.getState().setSelectedZone(null);
            }
          }
        }
      });

      // Double-click handler
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      map.on("dblclick", (e: any) => {
        const mode = useMapStore.getState().mapMode;
        const points = useMapStore.getState().drawingPoints;

        if (mode === "draw-zone" && points.length >= 3) {
          e.preventDefault();
          const polygon: GeoJSONPolygon = {
            type: "Polygon",
            coordinates: [[...points, points[0]]],
          };
          document.dispatchEvent(
            new CustomEvent("senpv:finish-zone", { detail: { polygon } })
          );
        }
      });

      // Mouse move handler
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      map.on("mousemove", (e: any) => {
        const mode = useMapStore.getState().mapMode;
        if (mode === "draw-zone") {
          map.getCanvas().style.cursor = "crosshair";
          previewLineRef.current = [e.lngLat.lng, e.lngLat.lat];
          const points = useMapStore.getState().drawingPoints;
          if (points.length > 0) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const drawingSource: any = map.getSource("drawing");
            if (!drawingSource) return;

            const coords = [...points, previewLineRef.current];
            if (points.length >= 2) {
              drawingSource.setData({
                type: "FeatureCollection",
                features: [
                  {
                    type: "Feature",
                    properties: {},
                    geometry: {
                      type: "Polygon",
                      coordinates: [[...coords, coords[0]]],
                    },
                  },
                ],
              });
            } else {
              drawingSource.setData({
                type: "FeatureCollection",
                features: [
                  {
                    type: "Feature",
                    properties: {},
                    geometry: {
                      type: "LineString",
                      coordinates: coords,
                    },
                  },
                ],
              });
            }
          }
        } else if (mode === "delete-zone" && map.getLayer("zones-fill")) {
          const features = map.queryRenderedFeatures(e.point, {
            layers: ["zones-fill"],
          });
          map.getCanvas().style.cursor = features.length > 0 ? "pointer" : "";
        } else if (mode === "add-panel") {
          map.getCanvas().style.cursor = "crosshair";
        } else if ((mode === "delete-panel" || mode === "select-panel") && map.getLayer("panels-fill")) {
          const panelFeatures = map.queryRenderedFeatures(e.point, {
            layers: ["panels-fill"],
          });
          map.getCanvas().style.cursor =
            panelFeatures.length > 0 ? "pointer" : "";
        } else {
          map.getCanvas().style.cursor = "";
        }
      });

      mapRef.current = map;
    })();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      setMapReady(false);
    };
  }, [lat, lon]);

  // Handle custom events for zone operations (to access current token)
  useEffect(() => {
    const handleDeleteZone = (e: Event) => {
      const { zoneId } = (e as CustomEvent).detail;
      if (token && zoneId) {
        removeZone(projectId, zoneId, token);
      }
    };

    const handleFinishZone = (e: Event) => {
      const { polygon } = (e as CustomEvent).detail;
      if (token && polygon) {
        addZone(projectId, { polygon }, token)
          .then((zone) => {
            clearDrawingPoints();
            setSelectedZone(zone.id);
            setMapMode("navigate");
          })
          .catch((err) => {
            console.error("Failed to save zone:", err);
            clearDrawingPoints();
            setMapMode("navigate");
          });
      }
    };

    const handleAddPanel = (e: Event) => {
      const { lat: pLat, lon: pLon } = (e as CustomEvent).detail;
      const layoutId = usePanelStore.getState().selectedLayoutId;
      if (token && layoutId) {
        addPanel(projectId, layoutId, { lat: pLat, lon: pLon }, token);
      }
    };

    const handleDeletePanel = (e: Event) => {
      const { layoutId, panelIndex } = (e as CustomEvent).detail;
      if (token && layoutId != null && panelIndex != null) {
        removePanel(projectId, layoutId, panelIndex, token);
      }
    };

    document.addEventListener("senpv:delete-zone", handleDeleteZone);
    document.addEventListener("senpv:finish-zone", handleFinishZone);
    document.addEventListener("senpv:add-panel", handleAddPanel);
    document.addEventListener("senpv:delete-panel", handleDeletePanel);
    return () => {
      document.removeEventListener("senpv:delete-zone", handleDeleteZone);
      document.removeEventListener("senpv:finish-zone", handleFinishZone);
      document.removeEventListener("senpv:add-panel", handleAddPanel);
      document.removeEventListener("senpv:delete-panel", handleDeletePanel);
    };
  }, [
    token,
    projectId,
    addZone,
    removeZone,
    addPanel,
    removePanel,
    clearDrawingPoints,
    setSelectedZone,
    setMapMode,
  ]);

  // Update zones on map
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const source = map.getSource("zones");
    if (!source) return;

    const features = zones
      .filter((z) => z.polygon)
      .map((z: { id: string; polygon: GeoJSONPolygon | null }, i: number) => ({
        type: "Feature" as const,
        properties: {
          id: z.id,
          fillColor: ZONE_COLORS[i % ZONE_COLORS.length],
          strokeColor: ZONE_STROKE_COLORS[i % ZONE_STROKE_COLORS.length],
        },
        geometry: z.polygon!,
      }));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (source as any).setData({ type: "FeatureCollection", features });
  }, [zones, mapReady]);

  // Update drawing preview
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const drawingSource = map.getSource("drawing");
    const pointsSource = map.getSource("drawing-points");
    if (!drawingSource || !pointsSource) {
      console.log("[SenPV] drawing sources missing — drawing:", !!drawingSource, "points:", !!pointsSource);
      return;
    }

    console.log("[SenPV] updating drawing preview — points:", drawingPoints.length);


    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (pointsSource as any).setData({
      type: "FeatureCollection",
      features: drawingPoints.map((p: [number, number]) => ({
        type: "Feature" as const,
        properties: {},
        geometry: { type: "Point" as const, coordinates: p },
      })),
    });

    if (drawingPoints.length >= 2) {
      (drawingSource as any).setData({
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            properties: {},
            geometry: {
              type: "Polygon",
              coordinates: [[...drawingPoints, drawingPoints[0]]],
            },
          },
        ],
      });
    } else if (drawingPoints.length === 1 && previewLineRef.current) {
      (drawingSource as any).setData({
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            properties: {},
            geometry: {
              type: "LineString",
              coordinates: [drawingPoints[0], previewLineRef.current],
            },
          },
        ],
      });
    } else {
      (drawingSource as any).setData({ type: "FeatureCollection", features: [] });
    }
  }, [drawingPoints, mapReady]);

  // Disable double-click zoom in draw mode
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (mapMode === "draw-zone") {
      map.doubleClickZoom.disable();
    } else {
      map.doubleClickZoom.enable();
    }
  }, [mapMode]);

  const handleSearchResult = useCallback((lng: number, latVal: number) => {
    const map = mapRef.current;
    if (!map) return;
    map.flyTo({ center: [lng, latVal], zoom: 19 });
  }, []);

  const hintMap: Record<MapMode, string> = {
    navigate: "",
    "draw-zone": t("hintDrawZone"),
    "edit-zone": "",
    "delete-zone": t("hintDeleteZone"),
    "add-panel": t("hintAddPanel"),
    "select-panel": t("hintSelectPanel"),
    "delete-panel": t("hintDeletePanel"),
  };
  const hint = hintMap[mapMode];

  return (
    <div className="relative w-full h-[calc(100vh-280px)] min-h-[500px] rounded-lg overflow-hidden border">
      <div ref={mapContainer} className="w-full h-full" />

      <GeoSearch onSelect={handleSearchResult} />
      <DrawingTools />
      {token && (
        <PanelToolbar projectId={projectId} token={token} />
      )}

      <PanelGrid mapRef={mapRef} mapReady={mapReady} />
      <PanelBadge panels={equipmentPanels} />

      {hint && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-background/90 backdrop-blur text-sm px-4 py-2 rounded-lg shadow border">
          {hint}
        </div>
      )}

      {selectedZoneId && <ZonePropertiesPanel projectId={projectId} />}
    </div>
  );
}
