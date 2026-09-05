"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Zap, Trash2, ChevronDown, ChevronUp, Plus, Minus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useEquipmentStore } from "@/store/equipment";
import { useMapStore } from "@/store/map";
import { usePanelStore } from "@/store/panels";
import { generateRangées } from "@/lib/panel-layout";
import type { PanelSpecs } from "@/types/equipment";
import type { PanelLayoutGeoJSON } from "@/types/panel-layout";

interface PanelsTabProps {
  projectId: string;
  token: string;
}

export function PanelsTab({ projectId, token }: PanelsTabProps) {
  const t = useTranslations("panels");
  const tc = useTranslations("common");
  const tMap = useTranslations("map");

  const { panels, inverters, fetchPanels, fetchInverters } =
    useEquipmentStore();
  const { zones } = useMapStore();
  const {
    layouts,
    loading,
    fetchLayouts,
    createLayout,
    deleteLayout,
    setSelectedLayout,
  } = usePanelStore();

  const [selectedZoneId, setSelectedZoneId] = useState("");
  const [selectedPanelId, setSelectedPanelId] = useState("");
  const [selectedInverterId, setSelectedInverterId] = useState("");
  const [spacingX, setSpacingX] = useState(0.02);
  const [spacingY, setSpacingY] = useState(0.02);
  const [gapRangée, setGapRangée] = useState(0.5);

  // Advanced options
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [numRangées, setNumRangées] = useState(3);
  const [colsPerRangée, setColsPerRangée] = useState(5);
  const [orientation, setOrientation] = useState<"horizontal" | "vertical">("horizontal");

  const handleZoneChange = (v: string | null) => setSelectedZoneId(v ?? "");
  const handlePanelChange = (v: string | null) => setSelectedPanelId(v ?? "");
  const handleInverterChange = (v: string | null) =>
    setSelectedInverterId(v ?? "");

  useEffect(() => {
    fetchPanels(token);
    fetchInverters(token);
    fetchLayouts(projectId, token);
  }, [token, projectId, fetchPanels, fetchInverters, fetchLayouts]);

  // Auto-select first zone
  useEffect(() => {
    if (zones.length > 0 && !selectedZoneId) {
      setSelectedZoneId(zones[0].id);
    }
  }, [zones, selectedZoneId]);

  // Auto-select first panel
  useEffect(() => {
    if (panels.length > 0 && !selectedPanelId) {
      setSelectedPanelId(panels[0].id);
    }
  }, [panels, selectedPanelId]);

  const handleRunCalpinage = async () => {
    if (!selectedZoneId || !selectedPanelId) return;

    const layout = await createLayout(
      projectId,
      {
        roof_zone_id: selectedZoneId,
        panel_model_id: selectedPanelId,
        inverter_model_id: selectedInverterId || undefined,
        spacing_x: spacingX,
        spacing_y: spacingY,
      },
      token
    );

    // If advanced options are enabled, override backend layout with frontend-computed rangées
    if (showAdvanced && selectedPanelSpecs) {
      const zone = zones.find((z) => z.id === selectedZoneId);
      const polygon = zone?.polygon?.coordinates?.[0];
      if (polygon) {
        const totalPanels = layout.num_panels > 0 ? layout.num_panels : numRangées * colsPerRangée;
        const features = generateRangées({
          zonePolygon: polygon as number[][],
          panelLengthM: selectedPanelSpecs.dimensions_mm.length / 1000,
          panelWidthM: selectedPanelSpecs.dimensions_mm.width / 1000,
          orientation,
          totalPanels,
          numRangées,
          colsPerRangée,
          spacingXM: spacingX,
          spacingYM: spacingY,
          gapRangéeM: gapRangée,
          orientationDeg: zone?.orientation_deg ?? 0,
        });

        const layoutGeoJSON: PanelLayoutGeoJSON = {
          type: "FeatureCollection",
          features,
        };

        await usePanelStore.getState().updateLayout(projectId, layout.id, {
          layout_geojson: layoutGeoJSON,
          num_panels: features.length,
        }, token);
      }
    }

    setSelectedLayout(layout.id);
  };

  const handleDeleteLayout = async (layoutId: string) => {
    if (!confirm(t("deleteConfirm"))) return;
    await deleteLayout(projectId, layoutId, token);
  };

  const selectedPanel = panels.find((p) => p.id === selectedPanelId);
  const selectedPanelSpecs = selectedPanel?.specs as PanelSpecs | undefined;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Panel selection & calpinage */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("calpinage")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Zone selection */}
          <div className="space-y-2">
            <Label>{t("roofZone")}</Label>
            <Select value={selectedZoneId} onValueChange={handleZoneChange}>
              <SelectTrigger>
                <SelectValue placeholder={t("selectZone")} />
              </SelectTrigger>
              <SelectContent>
                {zones.map((z, i) => (
                  <SelectItem key={z.id} value={z.id}>
                    {tMap("zone")} {i + 1}
                    {z.area_m2 ? ` — ${Number(z.area_m2).toFixed(0)} m²` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Panel model selection */}
          <div className="space-y-2">
            <Label>{t("panelModel")}</Label>
            <Select value={selectedPanelId} onValueChange={handlePanelChange}>
              <SelectTrigger>
                <SelectValue placeholder={t("selectPanel")} />
              </SelectTrigger>
              <SelectContent>
                {panels.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.manufacturer} {p.model} (
                    {(p.specs as PanelSpecs).pmax_w}W)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Inverter model selection (optional) */}
          <div className="space-y-2">
            <Label>
              {t("inverterModel")}{" "}
              <span className="text-muted-foreground text-xs">
                ({t("optional")})
              </span>
            </Label>
            <Select
              value={selectedInverterId}
              onValueChange={handleInverterChange}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("selectInverter")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("noInverter")}</SelectItem>
                {inverters.map((inv) => (
                  <SelectItem key={inv.id} value={inv.id}>
                    {inv.manufacturer} {inv.model}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Spacing */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>{t("spacingX")}</Label>
              <Input
                type="number"
                min={0}
                max={1}
                step={0.01}
                value={spacingX}
                onChange={(e) => setSpacingX(Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("spacingY")}</Label>
              <Input
                type="number"
                min={0}
                max={1}
                step={0.01}
                value={spacingY}
                onChange={(e) => setSpacingY(Number(e.target.value))}
              />
            </div>
          </div>

          {/* Advanced options toggle */}
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors w-full"
          >
            {showAdvanced ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
            {t("advancedOptions")}
          </button>

          {/* Advanced options */}
          {showAdvanced && (
            <div className="space-y-3 border-t pt-3">
              {/* Orientation */}
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

              {/* Rangées + cols per rangée */}
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

              {/* Gap between rangées */}
              <div className="space-y-2">
                <Label className="text-xs">{t("gapRangée")}</Label>
                <Input
                  type="number"
                  min={0}
                  max={5}
                  step={0.1}
                  value={gapRangée}
                  onChange={(e) => setGapRangée(Number(e.target.value))}
                />
              </div>
            </div>
          )}

          {/* Selected panel info */}
          {selectedPanelSpecs && (
            <div className="text-xs text-muted-foreground space-y-1 border-t pt-3">
              <p>
                {t("dimensions")}: {selectedPanelSpecs.dimensions_mm.length} x{" "}
                {selectedPanelSpecs.dimensions_mm.width} mm
              </p>
              <p>
                {t("power")}: {selectedPanelSpecs.pmax_w} W —{" "}
                {selectedPanelSpecs.efficiency_pct}%
              </p>
            </div>
          )}

          <Button
            className="w-full"
            onClick={handleRunCalpinage}
            disabled={loading || !selectedZoneId || !selectedPanelId}
          >
            <Zap className="size-4 mr-2" />
            {loading ? tc("loading") : t("runCalpinage")}
          </Button>
        </CardContent>
      </Card>

      {/* Existing layouts */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("layouts")}</CardTitle>
        </CardHeader>
        <CardContent>
          {layouts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              {t("noLayouts")}
            </p>
          ) : (
            <div className="space-y-3">
              {layouts.map((layout) => {
                const panel = panels.find(
                  (p) => p.id === layout.panel_model_id
                );
                const specs = panel?.specs as PanelSpecs | undefined;
                const kwc = specs
                  ? (layout.num_panels * specs.pmax_w) / 1000
                  : 0;

                return (
                  <div
                    key={layout.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer"
                    onClick={() => setSelectedLayout(layout.id)}
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {panel
                          ? `${panel.manufacturer} ${panel.model}`
                          : t("unknownPanel")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {tMap("panelCount", { count: layout.num_panels })} —{" "}
                        {tMap("peakPower", { kwc: kwc.toFixed(1) })}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {layout.num_strings} {t("strings")},{" "}
                        {layout.panels_per_string} {t("perString")}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteLayout(layout.id);
                      }}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
