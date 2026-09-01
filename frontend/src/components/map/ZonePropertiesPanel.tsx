"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMapStore } from "@/store/map";
import type { RoofType } from "@/types/roof-zone";

const ROOF_TYPES: { value: RoofType; labelKey: string }[] = [
  { value: "flat", labelKey: "flat" },
  { value: "gable", labelKey: "gable" },
  { value: "hip", labelKey: "hip" },
  { value: "shed", labelKey: "shed" },
];

interface ZonePropertiesPanelProps {
  projectId: string;
}

export function ZonePropertiesPanel({ projectId }: ZonePropertiesPanelProps) {
  const t = useTranslations("map");
  const tv = useTranslations("viewer3d");
  const tc = useTranslations("common");
  const { data: session } = useSession();
  const token = (session as { accessToken?: string } | null)?.accessToken;

  const { selectedZoneId, zones, updateZone, setSelectedZone } = useMapStore();
  const zone = zones.find((z) => z.id === selectedZoneId);

  const [orientation, setOrientation] = useState("");
  const [tilt, setTilt] = useState("");
  const [roofType, setRoofType] = useState<RoofType | "">("");

  useEffect(() => {
    if (zone) {
      setOrientation(zone.orientation_deg?.toString() || "");
      setTilt(zone.tilt_deg?.toString() || "");
      setRoofType(zone.roof_type || "");
    }
  }, [zone]);

  if (!zone) return null;

  const handleSave = () => {
    if (!token) return;
    updateZone(
      projectId,
      zone.id,
      {
        orientation_deg: orientation ? parseFloat(orientation) : undefined,
        tilt_deg: tilt ? parseFloat(tilt) : undefined,
        roof_type: roofType || undefined,
      },
      token
    );
  };

  return (
    <div className="absolute top-3 right-3 w-72 bg-background/95 backdrop-blur border rounded-lg shadow-lg p-4 z-10">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-sm">
          Zone {zone.zone_index + 1}
        </h3>
        <Button
          variant="ghost"
          size="icon"
          className="size-6"
          onClick={() => setSelectedZone(null)}
        >
          <X className="size-4" />
        </Button>
      </div>

      <div className="space-y-3">
        {/* Area */}
        <div>
          <Label className="text-xs text-muted-foreground">{t("area")}</Label>
          <p className="font-medium">
            {zone.area_m2 ? `${Number(zone.area_m2).toFixed(1)} m²` : "—"}
          </p>
        </div>

        {/* Orientation */}
        <div>
          <Label htmlFor="orientation" className="text-xs">
            {t("orientation")}
          </Label>
          <div className="flex items-center gap-1">
            <Input
              id="orientation"
              type="number"
              min={0}
              max={360}
              value={orientation}
              onChange={(e) => setOrientation(e.target.value)}
              onBlur={handleSave}
              className="h-8"
            />
            <span className="text-sm text-muted-foreground">°</span>
          </div>
        </div>

        {/* Tilt */}
        <div>
          <Label htmlFor="tilt" className="text-xs">
            {t("tilt")}
          </Label>
          <div className="flex items-center gap-1">
            <Input
              id="tilt"
              type="number"
              min={0}
              max={90}
              value={tilt}
              onChange={(e) => setTilt(e.target.value)}
              onBlur={handleSave}
              className="h-8"
            />
            <span className="text-sm text-muted-foreground">°</span>
          </div>
        </div>

        {/* Roof type */}
        <div>
          <Label className="text-xs">{t("roofType")}</Label>
          <Select
            value={roofType}
            onValueChange={(val) => {
              setRoofType(val as RoofType);
              if (token) {
                updateZone(
                  projectId,
                  zone.id,
                  { roof_type: val as RoofType },
                  token
                );
              }
            }}
          >
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROOF_TYPES.map(({ value, labelKey }) => (
                <SelectItem key={value} value={value}>
                  {tv(labelKey)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
