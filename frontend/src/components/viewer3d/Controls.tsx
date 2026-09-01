"use client";

import { useTranslations } from "next-intl";
import { useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useViewer3DStore } from "@/store/viewer3d";
import type { RoofType } from "@/types/roof-zone";
import { Camera, RotateCcw } from "lucide-react";

interface ControlsProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
}

const ROOF_TYPES: RoofType[] = ["flat", "gable", "hip", "shed"];

export function Controls({ canvasRef }: ControlsProps) {
  const t = useTranslations("viewer3d");
  const tc = useTranslations("common");

  const {
    showBuilding,
    showPanels,
    showGrid,
    roofType,
    tiltDeg,
    rotationDeg,
    buildingHeight,
    setShowBuilding,
    setShowPanels,
    setShowGrid,
    setRoofType,
    setTiltDeg,
    setRotationDeg,
    setBuildingHeight,
    resetView,
  } = useViewer3DStore();

  const handleScreenshot = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = "senpv-3d.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  }, [canvasRef]);

  return (
    <Card className="absolute top-4 right-4 w-64 z-10 bg-background/95 backdrop-blur-sm">
      <CardContent className="p-4 space-y-4">
        {/* Toggles */}
        <div className="space-y-2">
          <ToggleRow
            label={t("showBuilding")}
            checked={showBuilding}
            onChange={setShowBuilding}
          />
          <ToggleRow
            label={t("showPanels")}
            checked={showPanels}
            onChange={setShowPanels}
          />
          <ToggleRow
            label={t("showGrid")}
            checked={showGrid}
            onChange={setShowGrid}
          />
        </div>

        {/* Roof type */}
        <div className="space-y-1">
          <Label className="text-xs">{t("roofType")}</Label>
          <Select
            value={roofType}
            onValueChange={(v) => setRoofType(v as RoofType)}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROOF_TYPES.map((rt) => (
                <SelectItem key={rt} value={rt}>
                  {t(rt)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Sliders */}
        <SliderRow
          label={t("tilt")}
          value={tiltDeg}
          min={0}
          max={45}
          unit="°"
          onChange={setTiltDeg}
        />
        <SliderRow
          label={t("rotate")}
          value={rotationDeg}
          min={0}
          max={360}
          unit="°"
          onChange={setRotationDeg}
        />
        <SliderRow
          label={t("buildingHeight")}
          value={buildingHeight}
          min={1}
          max={15}
          unit="m"
          step={0.5}
          onChange={setBuildingHeight}
        />

        {/* Buttons */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 text-xs"
            onClick={resetView}
          >
            <RotateCcw className="size-3 mr-1" />
            {t("resetView")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1 text-xs"
            onClick={handleScreenshot}
          >
            <Camera className="size-3 mr-1" />
            {t("screenshot")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between cursor-pointer">
      <span className="text-xs">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-input accent-primary"
      />
    </label>
  );
}

function SliderRow({
  label,
  value,
  min,
  max,
  unit,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  unit: string;
  step?: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between">
        <Label className="text-xs">{label}</Label>
        <span className="text-xs text-muted-foreground">
          {value}
          {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 accent-primary"
      />
    </div>
  );
}
