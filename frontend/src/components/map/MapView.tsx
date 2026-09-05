"use client";

import { useRef, useEffect, useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import { useSession } from "next-auth/react";

import { LayoutGrid } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useMapStore, type MapMode } from "@/store/map";
import { usePanelStore } from "@/store/panels";
import { useEquipmentStore } from "@/store/equipment";
import type { GeoJSONPolygon } from "@/types/roof-zone";
import { GeoSearch } from "./GeoSearch";
import { DrawingTools } from "./DrawingTools";
import { ZonePropertiesPanel } from "./ZonePropertiesPanel";
import { PanelToolbar } from "@/components/panels/PanelToolbar";
import { PanelBadge } from "@/components/panels/PanelBadge";
import { PanelRowPlacer } from "./PanelRowPlacer";

const ZONE_COLORS = [
  "rgba(59, 130, 246, 0.35)",
  "rgba(16, 185, 129, 0.35)",
  "rgba(245, 158, 11, 0.35)",
  "rgba(239, 68, 68, 0.35)",
  "rgba(139, 92, 246, 0.35)",
  "rgba(236, 72, 153, 0.35)",
];
const ZONE_STROKE_COLORS = [
  "rgb(59, 130, 246)",
  "rgb(16, 185, 129)",
  "rgb(245, 158, 11)",
  "rgb(239, 68, 68)",
  "rgb(139, 92, 246)",
  "rgb(236, 72, 153)",
];

const PANEL_COLOR = "rgba(30, 58, 95, 0.85)";
const PANEL_STROKE = "rgba(255, 255, 255, 0.6)";

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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  const previewPointRef = useRef<[number, number] | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [showRowPlacer, setShowRowPlacer] = useState(false);

  const {
    mapMode,
    zones,
    drawingPoints,
    selectedZoneId,
    setSelectedZone,
    clearDrawingPoints,
    fetchZones,
    addZone,
    removeZone,
    setMapMode,
  } = useMapStore();

  const {
    layouts,
    fetchLayouts,
    addPanel,
    removePanel,
  } = usePanelStore();

  const { panels: equipmentPanels, fetchPanels } = useEquipmentStore();

  // Fetch data on mount
  useEffect(() => {
    if (token && projectId) {
      fetchZones(projectId, token).catch(() => {});
      fetchLayouts(projectId, token).catch(() => {});
      fetchPanels(token).catch(() => {});
    }
  }, [token, projectId, fetchZones, fetchLayouts, fetchPanels]);

  // ─── Canvas overlay drawing function ───────────────────────────────
  const drawOverlay = useCallback(() => {
    const map = mapRef.current;
    const canvas = canvasRef.current;
    if (!map || !canvas) return;

    const container = canvas.parentElement;
    if (!container) return;

    // Match canvas size to container
    const w = container.clientWidth;
    const h = container.clientHeight;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    // Helper: lngLat → pixel
    const toPixel = (lngLat: [number, number]): [number, number] => {
      const p = map.project(lngLat);
      return [p.x, p.y];
    };

    // ─── Draw existing zones ──────────────────────────────
    const currentZones = useMapStore.getState().zones;
    currentZones.forEach((zone, i) => {
      if (!zone.polygon?.coordinates?.[0]) return;
      const ring = zone.polygon.coordinates[0];
      if (ring.length < 3) return;

      const pixels = ring.map((c) => toPixel(c as [number, number]));

      // Fill
      ctx.beginPath();
      ctx.moveTo(pixels[0][0], pixels[0][1]);
      for (let j = 1; j < pixels.length; j++) {
        ctx.lineTo(pixels[j][0], pixels[j][1]);
      }
      ctx.closePath();
      ctx.fillStyle = ZONE_COLORS[i % ZONE_COLORS.length];
      ctx.fill();

      // Stroke
      ctx.strokeStyle = ZONE_STROKE_COLORS[i % ZONE_STROKE_COLORS.length];
      ctx.lineWidth = 2;
      ctx.stroke();

      // Label
      if (pixels.length > 2) {
        const cx = pixels.reduce((s, p) => s + p[0], 0) / pixels.length;
        const cy = pixels.reduce((s, p) => s + p[1], 0) / pixels.length;
        ctx.fillStyle = "#fff";
        ctx.font = "bold 12px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(`Zone ${i + 1}`, cx, cy);
      }
    });

    // ─── Draw panel layouts ───────────────────────────────
    const currentLayouts = usePanelStore.getState().layouts;
    for (const layout of currentLayouts) {
      if (!layout.layout_geojson?.features) continue;
      for (const feature of layout.layout_geojson.features) {
        const coords = feature.geometry?.coordinates?.[0];
        if (!coords || coords.length < 3) continue;

        const pixels = coords.map((c: number[]) => toPixel(c as [number, number]));

        ctx.beginPath();
        ctx.moveTo(pixels[0][0], pixels[0][1]);
        for (let j = 1; j < pixels.length; j++) {
          ctx.lineTo(pixels[j][0], pixels[j][1]);
        }
        ctx.closePath();
        ctx.fillStyle = PANEL_COLOR;
        ctx.fill();
        ctx.strokeStyle = PANEL_STROKE;
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }
    }

    // ─── Draw current drawing (preview) ───────────────────
    const pts = useMapStore.getState().drawingPoints;
    const preview = previewPointRef.current;
    const currentMode = useMapStore.getState().mapMode;

    if (pts.length > 0 && currentMode === "draw-rect" && preview) {
      // Rectangle preview: first point + mouse cursor = opposite corners
      const p1 = pts[0];
      const p2 = preview;
      const rectPts: [number, number][] = [
        [p1[0], p1[1]],
        [p2[0], p1[1]],
        [p2[0], p2[1]],
        [p1[0], p2[1]],
      ];
      const pixels = rectPts.map(toPixel);

      ctx.beginPath();
      ctx.moveTo(pixels[0][0], pixels[0][1]);
      for (let j = 1; j < pixels.length; j++) {
        ctx.lineTo(pixels[j][0], pixels[j][1]);
      }
      ctx.closePath();
      ctx.fillStyle = "rgba(59, 130, 246, 0.15)";
      ctx.fill();
      ctx.strokeStyle = "rgb(59, 130, 246)";
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw corner point
      const px = toPixel(p1);
      ctx.beginPath();
      ctx.arc(px[0], px[1], 6, 0, Math.PI * 2);
      ctx.fillStyle = "rgb(59, 130, 246)";
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;
      ctx.stroke();
    } else if (pts.length > 0) {
      const allPts = [...pts];
      if (preview) allPts.push(preview);

      const pixels = allPts.map(toPixel);

      // Line or polygon preview
      ctx.beginPath();
      ctx.moveTo(pixels[0][0], pixels[0][1]);
      for (let j = 1; j < pixels.length; j++) {
        ctx.lineTo(pixels[j][0], pixels[j][1]);
      }
      if (pts.length >= 3) {
        ctx.closePath();
        ctx.fillStyle = "rgba(59, 130, 246, 0.15)";
        ctx.fill();
      }
      ctx.strokeStyle = "rgb(59, 130, 246)";
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw points
      for (let j = 0; j < pts.length; j++) {
        const px = toPixel(pts[j]);
        ctx.beginPath();
        ctx.arc(px[0], px[1], 6, 0, Math.PI * 2);
        ctx.fillStyle = "rgb(59, 130, 246)";
        ctx.fill();
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }
  }, []);

  // ─── Initialize map ─────────────────────────────────────────────────
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    let cancelled = false;

    (async () => {
      const maplibregl = await import("maplibre-gl");
      await import("maplibre-gl/dist/maplibre-gl.css");

      if (cancelled || !mapContainer.current) return;

      const ML = maplibregl.default || maplibregl;

      const map = new ML.Map({
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

      map.addControl(new ML.NavigationControl(), "bottom-right");
      map.addControl(new ML.FullscreenControl(), "bottom-right");
      map.addControl(
        new ML.GeolocateControl({
          positionOptions: { enableHighAccuracy: true },
          trackUserLocation: false,
        }),
        "bottom-right"
      );

      // Redraw overlay on every map movement
      map.on("move", drawOverlay);
      map.on("zoom", drawOverlay);
      map.on("resize", drawOverlay);

      map.on("load", () => {
        setMapReady(true);
        drawOverlay();
      });

      // Click handler
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      map.on("click", (e: any) => {
        const mode = useMapStore.getState().mapMode;
        const point: [number, number] = [e.lngLat.lng, e.lngLat.lat];

        if (mode === "draw-zone") {
          useMapStore.getState().addDrawingPoint(point);
          drawOverlay();
        } else if (mode === "draw-rect") {
          const pts = useMapStore.getState().drawingPoints;
          if (pts.length === 0) {
            // First click: set first corner
            useMapStore.getState().addDrawingPoint(point);
            drawOverlay();
          } else {
            // Second click: create rectangle polygon (south-oriented = axis-aligned)
            const p1 = pts[0];
            const p2 = point;
            const polygon: GeoJSONPolygon = {
              type: "Polygon",
              coordinates: [[
                [p1[0], p1[1]],
                [p2[0], p1[1]],
                [p2[0], p2[1]],
                [p1[0], p2[1]],
                [p1[0], p1[1]], // close ring
              ]],
            };
            document.dispatchEvent(
              new CustomEvent("senpv:finish-zone", {
                detail: { polygon, orientation_deg: 180 },
              })
            );
          }
        } else if (mode === "delete-zone") {
          // Find which zone was clicked by checking point-in-polygon
          const currentZones = useMapStore.getState().zones;
          for (let i = currentZones.length - 1; i >= 0; i--) {
            const zone = currentZones[i];
            if (zone.polygon?.coordinates?.[0]) {
              if (pointInPolygon(point, zone.polygon.coordinates[0] as [number, number][])) {
                document.dispatchEvent(
                  new CustomEvent("senpv:delete-zone", { detail: { zoneId: zone.id } })
                );
                break;
              }
            }
          }
        } else if (mode === "add-panel") {
          document.dispatchEvent(
            new CustomEvent("senpv:add-panel", {
              detail: { lat: e.lngLat.lat, lon: e.lngLat.lng },
            })
          );
        } else if (mode === "navigate" || mode === "edit-zone") {
          const currentZones = useMapStore.getState().zones;
          let found = false;
          for (let i = currentZones.length - 1; i >= 0; i--) {
            const zone = currentZones[i];
            if (zone.polygon?.coordinates?.[0]) {
              if (pointInPolygon(point, zone.polygon.coordinates[0] as [number, number][])) {
                useMapStore.getState().setSelectedZone(zone.id);
                found = true;
                break;
              }
            }
          }
          if (!found) {
            useMapStore.getState().setSelectedZone(null);
          }
        }
      });

      // Double-click to finish zone
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

      // Mouse move for drawing preview
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      map.on("mousemove", (e: any) => {
        const mode = useMapStore.getState().mapMode;
        if (mode === "draw-zone" || mode === "draw-rect") {
          map.getCanvas().style.cursor = "crosshair";
          previewPointRef.current = [e.lngLat.lng, e.lngLat.lat];
          drawOverlay();
        } else if (mode === "delete-zone" || mode === "delete-panel") {
          map.getCanvas().style.cursor = "pointer";
        } else if (mode === "add-panel") {
          map.getCanvas().style.cursor = "crosshair";
        } else {
          map.getCanvas().style.cursor = "";
          previewPointRef.current = null;
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
  }, [lat, lon, drawOverlay]);

  // Handle custom events (need access to current token)
  useEffect(() => {
    const handleDeleteZone = (e: Event) => {
      const { zoneId } = (e as CustomEvent).detail;
      if (token && zoneId) {
        removeZone(projectId, zoneId, token).then(() => drawOverlay());
      }
    };

    const handleFinishZone = (e: Event) => {
      const { polygon, orientation_deg } = (e as CustomEvent).detail;
      if (token && polygon) {
        addZone(projectId, {
          polygon,
          ...(orientation_deg !== undefined && { orientation_deg }),
        }, token)
          .then((zone) => {
            clearDrawingPoints();
            setSelectedZone(zone.id);
            setMapMode("navigate");
            previewPointRef.current = null;
            drawOverlay();
          })
          .catch((err) => {
            console.error("Failed to save zone:", err);
            clearDrawingPoints();
            setMapMode("navigate");
            drawOverlay();
          });
      }
    };

    const handleAddPanel = (e: Event) => {
      const { lat: pLat, lon: pLon } = (e as CustomEvent).detail;
      const layoutId = usePanelStore.getState().selectedLayoutId;
      if (token && layoutId) {
        addPanel(projectId, layoutId, { lat: pLat, lon: pLon }, token).then(() => drawOverlay());
      }
    };

    const handleDeletePanel = (e: Event) => {
      const { layoutId, panelIndex } = (e as CustomEvent).detail;
      if (token && layoutId != null && panelIndex != null) {
        removePanel(projectId, layoutId, panelIndex, token).then(() => drawOverlay());
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
    token, projectId, addZone, removeZone, addPanel, removePanel,
    clearDrawingPoints, setSelectedZone, setMapMode, drawOverlay,
  ]);

  // Redraw when zones, layouts, or drawing changes
  useEffect(() => {
    drawOverlay();
  }, [zones, drawingPoints, layouts, mapReady, drawOverlay]);

  // Disable double-click zoom in draw mode
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (mapMode === "draw-zone" || mapMode === "draw-rect") {
      map.doubleClickZoom.disable();
    } else {
      map.doubleClickZoom.enable();
    }
  }, [mapMode]);

  const handleLayoutChanged = useCallback(() => {
    if (token && projectId) {
      usePanelStore.getState().fetchLayouts(projectId, token).then(() => drawOverlay());
    }
  }, [token, projectId, drawOverlay]);

  const handleSearchResult = useCallback((lng: number, latVal: number) => {
    const map = mapRef.current;
    if (!map) return;
    map.flyTo({ center: [lng, latVal], zoom: 19 });
  }, []);

  const hintMap: Record<MapMode, string> = {
    navigate: "",
    "draw-zone": t("hintDrawZone"),
    "draw-rect": t("hintDrawRect"),
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
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{ zIndex: 1 }}
      />

      <GeoSearch onSelect={handleSearchResult} />
      <DrawingTools />
      {token && (
        <PanelToolbar projectId={projectId} token={token} />
      )}

      <PanelBadge panels={equipmentPanels} />

      {/* Panel Row Placer toggle button */}
      <div className="absolute top-4 right-4 z-20 flex flex-col items-end gap-2">
        <Button
          variant={showRowPlacer ? "default" : "outline"}
          size="sm"
          onClick={() => setShowRowPlacer(!showRowPlacer)}
          className="bg-background/90 backdrop-blur shadow"
        >
          <LayoutGrid className="size-4 mr-2" />
          {t("panelRows")}
        </Button>
      </div>

      {/* Panel Row Placer panel */}
      {showRowPlacer && token && (
        <div className="absolute top-14 right-4 bottom-4 z-20 w-72 bg-background/95 backdrop-blur rounded-lg shadow-lg border flex flex-col">
          <div className="p-3 overflow-y-auto flex-1">
            <PanelRowPlacer
              projectId={projectId}
              token={token}
              mapRef={mapRef}
              onLayoutChanged={handleLayoutChanged}
            />
          </div>
        </div>
      )}

      {hint && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-background/90 backdrop-blur text-sm px-4 py-2 rounded-lg shadow border z-10">
          {hint}
        </div>
      )}

      {selectedZoneId && (
        <ZonePropertiesPanel projectId={projectId} positionLeft={showRowPlacer} />
      )}
    </div>
  );
}

// Point-in-polygon test (ray casting)
function pointInPolygon(point: [number, number], polygon: [number, number][]): boolean {
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}
