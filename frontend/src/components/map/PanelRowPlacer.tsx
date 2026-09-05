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
import { generateRangées, type PanelOrientation } from "@/lib/panel-layout";
import type { PanelSpecs } from "@/types/equipment";
import type { PanelLayoutGeoJSON } from "@/types/panel-layout";

interface PanelRowPlacerProps {
  projectId: string;
  token: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mapRef: React.RefObject<any>;
  onLayoutChanged: () => void;
}

export function PanelRowPlacer({
  projectId,
  token,
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

  useEffect(() => {
    if (!selectedPanelId && equipmentPanels.length > 0) {
      setSelectedPanelId(equipmentPanels[0].id);
    }
  }, [equipmentPanels, selectedPanelId]);

  const totalKwc = panelSpecs ? (totalPanels * panelSpecs.pmax_w) / 1000 : 0;
  const panelsPerRangée = Math.ceil(totalPanels / numRangées);
  const rowsPerRangée = Math.ceil(panelsPerRangée / colsPerRangée);

  const handlePlace = async () => {
    if (!selectedZone || !selectedPanel || !panelSpecs) return;

    const polygon = selectedZone.polygon?.coordinates?.[0];
    if (!polygon) return;

    setLoading(true);
    try {
      const features = generateRangées({
        zonePolygon: polygon as number[][],
        panelLengthM: panelSpecs.dimensions_mm.length / 1000,
        panelWidthM: panelSpecs.dimensions_mm.width / 1000,
        orientation,
        totalPanels,
        numRangées,
        colsPerRangée,
        spacingXM: spacingX,
        spacingYM: spacingY,
        gapRangéeM: gapRangée,
        orientationDeg: selectedZone.orientation_deg ?? 0,
      });

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

  const handleCalpinage = async () => {
    if (!selectedZone || !selectedPanel) return;

    setLoadingCalp(true);
    try {
      const existingLayout = layouts.find(
        (l) => l.roof_zone_id === selectedZone.id
      );
      if (existingLayout) {
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
    <div className="space-y-3">
      {/* Panel model */}
      <div className="space-y-1">
        <Label className="text-xs">{t("panelModel")}</Label>
        <Select value={selectedPanelId} onValueChange={(v) => v && setSelectedPanelId(v)}>
          <SelectTrigger className="h-8 text-xs">
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
      <div className="space-y-1">
        <Label className="text-xs">{t("orientation")}</Label>
        <div className="flex gap-1">
          <Button
            variant={orientation === "horizontal" ? "default" : "outline"}
            size="sm"
            className="flex-1 h-7 text-xs"
            onClick={() => setOrientation("horizontal")}
          >
            {t("horizontal")}
          </Button>
          <Button
            variant={orientation === "vertical" ? "default" : "outline"}
            size="sm"
            className="flex-1 h-7 text-xs"
            onClick={() => setOrientation("vertical")}
          >
            {t("vertical")}
          </Button>
        </div>
      </div>

      {/* Total panels */}
      <div className="space-y-1">
        <Label className="text-xs">{t("totalPanels")}</Label>
        <Input
          type="number"
          min={1}
          max={500}
          value={totalPanels}
          onChange={(e) => setTotalPanels(Math.max(1, Number(e.target.value)))}
          className="h-8 text-xs"
        />
      </div>

      {/* Rangées + cols per rangée */}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">{t("numRangées")}</Label>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-7 w-7"
              onClick={() => setNumRangées(Math.max(1, numRangées - 1))}>
              <Minus className="size-3" />
            </Button>
            <span className="w-6 text-center text-xs font-medium">{numRangées}</span>
            <Button variant="outline" size="icon" className="h-7 w-7"
              onClick={() => setNumRangées(Math.min(20, numRangées + 1))}>
              <Plus className="size-3" />
            </Button>
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t("colsPerRangée")}</Label>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-7 w-7"
              onClick={() => setColsPerRangée(Math.max(1, colsPerRangée - 1))}>
              <Minus className="size-3" />
            </Button>
            <span className="w-6 text-center text-xs font-medium">{colsPerRangée}</span>
            <Button variant="outline" size="icon" className="h-7 w-7"
              onClick={() => setColsPerRangée(Math.min(30, colsPerRangée + 1))}>
              <Plus className="size-3" />
            </Button>
          </div>
        </div>
      </div>

      {/* Spacing - 3 in a row */}
      <div className="grid grid-cols-3 gap-1">
        <div className="space-y-1">
          <Label className="text-[10px] leading-tight">{t("spacingX")}</Label>
          <Input type="number" min={0} max={2} step={0.01} value={spacingX}
            onChange={(e) => setSpacingX(Number(e.target.value))} className="h-7 text-xs px-1" />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] leading-tight">{t("spacingY")}</Label>
          <Input type="number" min={0} max={2} step={0.01} value={spacingY}
            onChange={(e) => setSpacingY(Number(e.target.value))} className="h-7 text-xs px-1" />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] leading-tight">{t("gapRangée")}</Label>
          <Input type="number" min={0} max={5} step={0.1} value={gapRangée}
            onChange={(e) => setGapRangée(Number(e.target.value))} className="h-7 text-xs px-1" />
        </div>
      </div>

      {/* Preview summary */}
      {panelSpecs && (
        <div className="bg-muted/50 rounded p-2 space-y-0.5 text-[11px]">
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
        </div>
      )}

      {/* Buttons */}
      <div className="space-y-1.5">
        <Button className="w-full h-8 text-xs" onClick={handlePlace}
          disabled={loading || loadingCalp || !selectedPanelId || !selectedZone}>
          <LayoutGrid className="size-3.5 mr-1.5" />
          {loading ? "..." : t("placeRows")}
        </Button>
        <Button variant="outline" className="w-full h-8 text-xs" onClick={handleCalpinage}
          disabled={loading || loadingCalp || !selectedPanelId || !selectedZone}>
          <Zap className="size-3.5 mr-1.5" />
          {loadingCalp ? "..." : t("runCalpinage")}
        </Button>
      </div>
    </div>
  );
}
