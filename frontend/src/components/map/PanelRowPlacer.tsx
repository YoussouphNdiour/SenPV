"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { LayoutGrid, Plus, Minus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMapStore } from "@/store/map";
import { usePanelStore } from "@/store/panels";
import { useEquipmentStore } from "@/store/equipment";
import type { PanelSpecs } from "@/types/equipment";
import type { PanelLayoutGeoJSON, PanelPosition } from "@/types/panel-layout";

interface PanelRowPlacerProps {
  projectId: string;
  token: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mapRef: React.RefObject<any>;
  onLayoutChanged: () => void;
}

/**
 * Generate panel rectangles arranged in rows (top → bottom) inside a zone polygon.
 * All computation is done in screen pixels then projected back to lngLat.
 */
function generatePanelRows(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  map: any,
  zonePolygon: number[][],
  panelWidthM: number,
  panelHeightM: number,
  cols: number,
  rows: number,
  spacingXM: number,
  spacingYM: number,
  orientationDeg: number,
): PanelPosition[] {
  // Compute zone centroid in lngLat
  const cLng = zonePolygon.reduce((s, c) => s + c[0], 0) / zonePolygon.length;
  const cLat = zonePolygon.reduce((s, c) => s + c[1], 0) / zonePolygon.length;

  // Approximate meters-to-degrees at this latitude
  const mPerDegLat = 111320;
  const mPerDegLng = 111320 * Math.cos((cLat * Math.PI) / 180);

  const panelW = panelWidthM / mPerDegLng;   // panel width in degrees lng
  const panelH = panelHeightM / mPerDegLat;   // panel height in degrees lat
  const spX = spacingXM / mPerDegLng;
  const spY = spacingYM / mPerDegLat;

  const cellW = panelW + spX;
  const cellH = panelH + spY;

  // Total grid dimensions
  const gridW = cols * cellW - spX;
  const gridH = rows * cellH - spY;

  // Start from top-left of grid, centered on zone centroid
  const startLng = cLng - gridW / 2;
  const startLat = cLat + gridH / 2; // top = higher lat

  const rotRad = (orientationDeg * Math.PI) / 180;
  const features: PanelPosition[] = [];
  let idx = 0;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      // Center of this panel (before rotation)
      const pLng = startLng + c * cellW + panelW / 2;
      const pLat = startLat - r * cellH - panelH / 2;

      // 4 corners relative to center
      const hw = panelW / 2;
      const hh = panelH / 2;
      const corners: [number, number][] = [
        [-hw, hh],
        [hw, hh],
        [hw, -hh],
        [-hw, -hh],
      ];

      // Rotate around centroid
      const rotatedCorners = corners.map(([dx, dy]) => {
        // Scale dx to make rotation work in lat/lng space
        const dxScaled = dx * mPerDegLng;
        const dyScaled = dy * mPerDegLat;
        const rx = dxScaled * Math.cos(rotRad) - dyScaled * Math.sin(rotRad);
        const ry = dxScaled * Math.sin(rotRad) + dyScaled * Math.cos(rotRad);
        return [
          pLng + rx / mPerDegLng,
          pLat + ry / mPerDegLat,
        ] as [number, number];
      });

      // Close the ring
      const ring = [...rotatedCorners, rotatedCorners[0]];

      features.push({
        type: "Feature",
        properties: { index: idx, rotation_deg: orientationDeg },
        geometry: { type: "Polygon", coordinates: [ring] },
      });
      idx++;
    }
  }

  return features;
}

export function PanelRowPlacer({
  projectId,
  token,
  mapRef,
  onLayoutChanged,
}: PanelRowPlacerProps) {
  const t = useTranslations("panels");
  const tMap = useTranslations("map");
  const { zones, selectedZoneId } = useMapStore();
  const { layouts, createLayout, updateLayout } = usePanelStore();
  const { panels: equipmentPanels } = useEquipmentStore();

  const [rows, setRows] = useState(3);
  const [cols, setCols] = useState(5);
  const [spacingX, setSpacingX] = useState(0.02);
  const [spacingY, setSpacingY] = useState(0.05);
  const [selectedPanelId, setSelectedPanelId] = useState("");
  const [loading, setLoading] = useState(false);

  const selectedZone = zones.find((z) => z.id === selectedZoneId);
  const selectedPanel = equipmentPanels.find((p) => p.id === selectedPanelId);
  const panelSpecs = selectedPanel?.specs as PanelSpecs | undefined;

  // Auto-select first panel
  if (!selectedPanelId && equipmentPanels.length > 0) {
    setSelectedPanelId(equipmentPanels[0].id);
  }

  const totalPanels = rows * cols;
  const totalKwc = panelSpecs ? (totalPanels * panelSpecs.pmax_w) / 1000 : 0;

  const handlePlace = async () => {
    if (!selectedZone || !selectedPanel || !panelSpecs || !mapRef.current) return;

    const polygon = selectedZone.polygon?.coordinates?.[0];
    if (!polygon) return;

    setLoading(true);
    try {
      const panelW = panelSpecs.dimensions_mm.length / 1000;
      const panelH = panelSpecs.dimensions_mm.width / 1000;
      const orientation = selectedZone.orientation_deg ?? 0;

      const features = generatePanelRows(
        mapRef.current,
        polygon as number[][],
        panelW,
        panelH,
        cols,
        rows,
        spacingX,
        spacingY,
        orientation,
      );

      const layoutGeoJSON: PanelLayoutGeoJSON = {
        type: "FeatureCollection",
        features,
      };

      // Check if layout already exists for this zone
      const existingLayout = layouts.find(
        (l) => l.roof_zone_id === selectedZone.id
      );

      if (existingLayout) {
        await updateLayout(projectId, existingLayout.id, {
          layout_geojson: layoutGeoJSON,
          num_panels: features.length,
        } as Partial<typeof existingLayout>, token);
      } else {
        // Create layout first (triggers backend calpinage), then override with our layout
        const newLayout = await createLayout(
          projectId,
          {
            roof_zone_id: selectedZone.id,
            panel_model_id: selectedPanel.id,
            spacing_x: spacingX,
            spacing_y: spacingY,
          },
          token
        );
        // Override with our manual row placement
        await updateLayout(projectId, newLayout.id, {
          layout_geojson: layoutGeoJSON,
          num_panels: features.length,
        } as Partial<typeof newLayout>, token);
      }

      onLayoutChanged();
    } catch (err) {
      console.error("Failed to place panels:", err);
    } finally {
      setLoading(false);
    }
  };

  if (!selectedZoneId || !selectedZone) {
    return (
      <div className="p-4 text-sm text-muted-foreground text-center">
        {tMap("selectZoneFirst")}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Panel model */}
      <div className="space-y-2">
        <Label>{t("panelModel")}</Label>
        <Select value={selectedPanelId} onValueChange={(v) => v && setSelectedPanelId(v)}>
          <SelectTrigger>
            <SelectValue placeholder={t("selectPanel")} />
          </SelectTrigger>
          <SelectContent>
            {equipmentPanels.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.manufacturer} {p.model} ({(p.specs as PanelSpecs).pmax_w}W)
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Rows and Columns */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>{t("numRows")}</Label>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setRows(Math.max(1, rows - 1))}
            >
              <Minus className="size-3" />
            </Button>
            <span className="w-8 text-center font-medium">{rows}</span>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setRows(Math.min(20, rows + 1))}
            >
              <Plus className="size-3" />
            </Button>
          </div>
        </div>
        <div className="space-y-2">
          <Label>{t("numCols")}</Label>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setCols(Math.max(1, cols - 1))}
            >
              <Minus className="size-3" />
            </Button>
            <span className="w-8 text-center font-medium">{cols}</span>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setCols(Math.min(30, cols + 1))}
            >
              <Plus className="size-3" />
            </Button>
          </div>
        </div>
      </div>

      {/* Spacing */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>{t("spacingX")} (m)</Label>
          <Input
            type="number"
            min={0}
            max={2}
            step={0.01}
            value={spacingX}
            onChange={(e) => setSpacingX(Number(e.target.value))}
          />
        </div>
        <div className="space-y-2">
          <Label>{t("spacingY")} (m)</Label>
          <Input
            type="number"
            min={0}
            max={2}
            step={0.01}
            value={spacingY}
            onChange={(e) => setSpacingY(Number(e.target.value))}
          />
        </div>
      </div>

      {/* Preview info */}
      {panelSpecs && (
        <div className="bg-muted/50 rounded-lg p-3 space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{t("gridSize")}</span>
            <span className="font-medium">{rows} x {cols} = {totalPanels} {t("panels_label")}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{t("power")}</span>
            <span className="font-medium text-primary">{totalKwc.toFixed(1)} kWc</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{t("dimensions")}</span>
            <span className="text-xs">
              {panelSpecs.dimensions_mm.length} x {panelSpecs.dimensions_mm.width} mm
            </span>
          </div>
        </div>
      )}

      {/* Place button */}
      <Button
        className="w-full"
        onClick={handlePlace}
        disabled={loading || !selectedPanelId || !selectedZone}
      >
        <LayoutGrid className="size-4 mr-2" />
        {loading ? "..." : t("placeRows")}
      </Button>
    </div>
  );
}
