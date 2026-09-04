"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { LayoutGrid, Plus, Minus, Zap } from "lucide-react";

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

type PanelOrientation = "horizontal" | "vertical";

interface PanelRowPlacerProps {
  projectId: string;
  token: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mapRef: React.RefObject<any>;
  onLayoutChanged: () => void;
}

/**
 * Generate panel rectangles arranged as rangées (tables) stacked top→bottom.
 *
 * Each rangée is a grid of (colsPerRangée × rowsPerRangée) panels.
 * Rangées are separated by `gapBetweenRangées`.
 *
 * Orientation controls whether each panel is placed landscape (H) or portrait (V).
 */
function generateRangées(
  zonePolygon: number[][],
  panelLengthM: number,
  panelWidthM: number,
  orientation: PanelOrientation,
  totalPanels: number,
  numRangées: number,
  colsPerRangée: number,
  spacingXM: number,
  spacingYM: number,
  gapRangéeM: number,
  orientationDeg: number,
): PanelPosition[] {
  // Panel footprint depends on orientation
  const panelW = orientation === "horizontal" ? panelLengthM : panelWidthM;
  const panelH = orientation === "horizontal" ? panelWidthM : panelLengthM;

  // Zone centroid
  const cLng = zonePolygon.reduce((s, c) => s + c[0], 0) / zonePolygon.length;
  const cLat = zonePolygon.reduce((s, c) => s + c[1], 0) / zonePolygon.length;

  // Meters → degrees at this latitude
  const mPerDegLat = 111320;
  const mPerDegLng = 111320 * Math.cos((cLat * Math.PI) / 180);

  const pw = panelW / mPerDegLng;
  const ph = panelH / mPerDegLat;
  const spX = spacingXM / mPerDegLng;
  const spY = spacingYM / mPerDegLat;
  const gapR = gapRangéeM / mPerDegLat;

  const cellW = pw + spX;
  const cellH = ph + spY;

  // Distribute panels across rangées
  const panelsPerRangée = Math.ceil(totalPanels / numRangées);
  const rangées: { cols: number; rows: number; count: number }[] = [];
  let remaining = totalPanels;

  for (let r = 0; r < numRangées; r++) {
    const count = Math.min(remaining, panelsPerRangée);
    if (count <= 0) break;
    const cols = Math.min(colsPerRangée, count);
    const rows = Math.ceil(count / cols);
    rangées.push({ cols, rows, count });
    remaining -= count;
  }

  // Compute total height to center vertically
  let totalH = 0;
  for (let r = 0; r < rangées.length; r++) {
    totalH += rangées[r].rows * cellH - spY;
    if (r < rangées.length - 1) totalH += gapR;
  }

  // Total width = widest rangée
  const maxCols = Math.max(...rangées.map((r) => r.cols));
  const totalW = maxCols * cellW - spX;

  // Starting position (top-left, centered on centroid)
  const startLng = cLng - totalW / 2;
  let currentLat = cLat + totalH / 2;

  const rotRad = (orientationDeg * Math.PI) / 180;
  const features: PanelPosition[] = [];
  let idx = 0;
  let panelsPlaced = 0;

  for (const rangée of rangées) {
    for (let row = 0; row < rangée.rows; row++) {
      for (let col = 0; col < rangée.cols; col++) {
        if (panelsPlaced >= totalPanels) break;

        const pLng = startLng + col * cellW + pw / 2;
        const pLat = currentLat - row * cellH - ph / 2;

        // 4 corners relative to center
        const hw = pw / 2;
        const hh = ph / 2;
        const corners: [number, number][] = [
          [-hw, hh],
          [hw, hh],
          [hw, -hh],
          [-hw, -hh],
        ];

        // Rotate around zone centroid
        const rotatedCorners = corners.map(([dx, dy]) => {
          const dxM = dx * mPerDegLng;
          const dyM = dy * mPerDegLat;
          const rx = dxM * Math.cos(rotRad) - dyM * Math.sin(rotRad);
          const ry = dxM * Math.sin(rotRad) + dyM * Math.cos(rotRad);
          return [
            pLng + rx / mPerDegLng,
            pLat + ry / mPerDegLat,
          ] as [number, number];
        });

        const ring = [...rotatedCorners, rotatedCorners[0]];
        features.push({
          type: "Feature",
          properties: { index: idx, rotation_deg: orientationDeg },
          geometry: { type: "Polygon", coordinates: [ring] },
        });
        idx++;
        panelsPlaced++;
      }
      if (panelsPlaced >= totalPanels) break;
    }

    // Move down for next rangée
    currentLat -= rangée.rows * cellH - spY + gapR;
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

  const [totalPanels, setTotalPanels] = useState(15);
  const [numRangées, setNumRangées] = useState(3);
  const [colsPerRangée, setColsPerRangée] = useState(5);
  const [orientation, setOrientation] = useState<PanelOrientation>("horizontal");
  const [spacingX, setSpacingX] = useState(0.02);
  const [spacingY, setSpacingY] = useState(0.02);
  const [gapRangée, setGapRangée] = useState(0.5);
  const [selectedPanelId, setSelectedPanelId] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingCalp, setLoadingCalp] = useState(false);

  const selectedZone = zones.find((z) => z.id === selectedZoneId);
  const selectedPanel = equipmentPanels.find((p) => p.id === selectedPanelId);
  const panelSpecs = selectedPanel?.specs as PanelSpecs | undefined;

  // Auto-select first panel
  useEffect(() => {
    if (!selectedPanelId && equipmentPanels.length > 0) {
      setSelectedPanelId(equipmentPanels[0].id);
    }
  }, [equipmentPanels, selectedPanelId]);

  const totalKwc = panelSpecs ? (totalPanels * panelSpecs.pmax_w) / 1000 : 0;

  // Computed layout preview
  const panelsPerRangée = Math.ceil(totalPanels / numRangées);
  const rowsPerRangée = Math.ceil(panelsPerRangée / colsPerRangée);

  // --- Manual placement ---
  const handlePlace = async () => {
    if (!selectedZone || !selectedPanel || !panelSpecs) return;

    const polygon = selectedZone.polygon?.coordinates?.[0];
    if (!polygon) return;

    setLoading(true);
    try {
      const panelL = panelSpecs.dimensions_mm.length / 1000;
      const panelW = panelSpecs.dimensions_mm.width / 1000;
      const orientDeg = selectedZone.orientation_deg ?? 0;

      const features = generateRangées(
        polygon as number[][],
        panelL,
        panelW,
        orientation,
        totalPanels,
        numRangées,
        colsPerRangée,
        spacingX,
        spacingY,
        gapRangée,
        orientDeg,
      );

      const layoutGeoJSON: PanelLayoutGeoJSON = {
        type: "FeatureCollection",
        features,
      };

      const existingLayout = layouts.find(
        (l) => l.roof_zone_id === selectedZone.id
      );

      if (existingLayout) {
        await updateLayout(projectId, existingLayout.id, {
          layout_geojson: layoutGeoJSON,
          num_panels: features.length,
        } as Partial<typeof existingLayout>, token);
      } else {
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

  // --- Auto calpinage ---
  const handleCalpinage = async () => {
    if (!selectedZone || !selectedPanel) return;

    setLoadingCalp(true);
    try {
      const existingLayout = layouts.find(
        (l) => l.roof_zone_id === selectedZone.id
      );

      if (existingLayout) {
        // Delete and recreate to re-trigger calpinage
        await usePanelStore.getState().deleteLayout(projectId, existingLayout.id, token);
      }

      await createLayout(
        projectId,
        {
          roof_zone_id: selectedZone.id,
          panel_model_id: selectedPanel.id,
          spacing_x: spacingX,
          spacing_y: spacingY,
        },
        token
      );

      onLayoutChanged();
    } catch (err) {
      console.error("Calpinage failed:", err);
    } finally {
      setLoadingCalp(false);
    }
  };

  if (!selectedZoneId || !selectedZone) {
    return (
      <div className="text-sm text-muted-foreground text-center py-4">
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
          <SelectTrigger className="h-9">
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

      {/* Orientation toggle */}
      <div className="space-y-2">
        <Label>{t("orientation")}</Label>
        <div className="flex gap-1">
          <Button
            variant={orientation === "horizontal" ? "default" : "outline"}
            size="sm"
            className="flex-1 h-8 text-xs"
            onClick={() => setOrientation("horizontal")}
          >
            {t("horizontal")}
          </Button>
          <Button
            variant={orientation === "vertical" ? "default" : "outline"}
            size="sm"
            className="flex-1 h-8 text-xs"
            onClick={() => setOrientation("vertical")}
          >
            {t("vertical")}
          </Button>
        </div>
      </div>

      {/* Total panels */}
      <div className="space-y-2">
        <Label>{t("totalPanels")}</Label>
        <Input
          type="number"
          min={1}
          max={500}
          value={totalPanels}
          onChange={(e) => setTotalPanels(Math.max(1, Number(e.target.value)))}
          className="h-9"
        />
      </div>

      {/* Number of rangées + cols per rangée */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label className="text-xs">{t("numRangées")}</Label>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={() => setNumRangées(Math.max(1, numRangées - 1))}
            >
              <Minus className="size-3" />
            </Button>
            <span className="w-7 text-center text-sm font-medium">{numRangées}</span>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={() => setNumRangées(Math.min(20, numRangées + 1))}
            >
              <Plus className="size-3" />
            </Button>
          </div>
        </div>
        <div className="space-y-2">
          <Label className="text-xs">{t("colsPerRangée")}</Label>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={() => setColsPerRangée(Math.max(1, colsPerRangée - 1))}
            >
              <Minus className="size-3" />
            </Button>
            <span className="w-7 text-center text-sm font-medium">{colsPerRangée}</span>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={() => setColsPerRangée(Math.min(30, colsPerRangée + 1))}
            >
              <Plus className="size-3" />
            </Button>
          </div>
        </div>
      </div>

      {/* Spacing */}
      <div className="grid grid-cols-3 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">{t("spacingX")}</Label>
          <Input
            type="number"
            min={0}
            max={2}
            step={0.01}
            value={spacingX}
            onChange={(e) => setSpacingX(Number(e.target.value))}
            className="h-8 text-xs"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t("spacingY")}</Label>
          <Input
            type="number"
            min={0}
            max={2}
            step={0.01}
            value={spacingY}
            onChange={(e) => setSpacingY(Number(e.target.value))}
            className="h-8 text-xs"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t("gapRangée")}</Label>
          <Input
            type="number"
            min={0}
            max={5}
            step={0.1}
            value={gapRangée}
            onChange={(e) => setGapRangée(Number(e.target.value))}
            className="h-8 text-xs"
          />
        </div>
      </div>

      {/* Preview summary */}
      {panelSpecs && (
        <div className="bg-muted/50 rounded-lg p-3 space-y-1 text-xs">
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t("totalPanels")}</span>
            <span className="font-medium">{totalPanels}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t("gridSize")}</span>
            <span className="font-medium">
              {numRangées} × ({colsPerRangée}×{rowsPerRangée})
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t("power")}</span>
            <span className="font-medium text-primary">{totalKwc.toFixed(1)} kWc</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t("dimensions")}</span>
            <span>
              {orientation === "horizontal"
                ? `${panelSpecs.dimensions_mm.length}×${panelSpecs.dimensions_mm.width}`
                : `${panelSpecs.dimensions_mm.width}×${panelSpecs.dimensions_mm.length}`
              } mm
            </span>
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="space-y-2">
        <Button
          className="w-full"
          onClick={handlePlace}
          disabled={loading || loadingCalp || !selectedPanelId || !selectedZone}
        >
          <LayoutGrid className="size-4 mr-2" />
          {loading ? "..." : t("placeRows")}
        </Button>

        <Button
          variant="outline"
          className="w-full"
          onClick={handleCalpinage}
          disabled={loading || loadingCalp || !selectedPanelId || !selectedZone}
        >
          <Zap className="size-4 mr-2" />
          {loadingCalp ? "..." : t("runCalpinage")}
        </Button>
      </div>
    </div>
  );
}
