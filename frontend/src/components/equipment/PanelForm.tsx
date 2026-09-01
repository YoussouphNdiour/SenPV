"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import type { Equipment, PanelSpecs } from "@/types/equipment";

interface PanelFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: {
    manufacturer: string;
    model: string;
    specs: PanelSpecs;
    is_global?: boolean;
  }) => void;
  initial?: Equipment;
  isAdmin?: boolean;
}

const defaultSpecs: PanelSpecs = {
  pmax_w: 400,
  voc_v: 45,
  vmp_v: 38,
  isc_a: 11,
  imp_a: 10.5,
  efficiency_pct: 20,
  temp_coeff_pmax_pct_per_c: -0.35,
  temp_coeff_voc_pct_per_c: -0.27,
  temp_coeff_isc_pct_per_c: 0.05,
  noct_c: 45,
  cells: 72,
  cell_type: "mono-PERC",
  dimensions_mm: { length: 2000, width: 1000, height: 35 },
  weight_kg: 22,
  warranty_years: 25,
};

export function PanelForm({ open, onOpenChange, onSave, initial, isAdmin }: PanelFormProps) {
  const t = useTranslations("equipment");
  const tc = useTranslations("common");

  const initSpecs = initial ? (initial.specs as PanelSpecs) : defaultSpecs;
  const [manufacturer, setManufacturer] = useState(initial?.manufacturer ?? "");
  const [model, setModel] = useState(initial?.model ?? "");
  const [isGlobal, setIsGlobal] = useState(initial?.is_global ?? false);
  const [specs, setSpecs] = useState<PanelSpecs>({ ...initSpecs });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const updateSpec = <K extends keyof PanelSpecs>(key: K, value: PanelSpecs[K]) => {
    setSpecs((prev) => ({ ...prev, [key]: value }));
  };

  const updateDim = (key: "length" | "width" | "height", value: number) => {
    setSpecs((prev) => ({
      ...prev,
      dimensions_mm: { ...prev.dimensions_mm, [key]: value },
    }));
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!manufacturer.trim()) errs.manufacturer = "Required";
    if (!model.trim()) errs.model = "Required";
    if (specs.vmp_v >= specs.voc_v) errs.vmp_v = t("errorVmpVoc");
    if (specs.imp_a >= specs.isc_a) errs.imp_a = t("errorImpIsc");
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;
    onSave({ manufacturer, model, specs, is_global: isAdmin ? isGlobal : undefined });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {initial ? t("editPanel") : t("addPanel")}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4">
          {/* General */}
          <h4 className="font-medium text-sm">{t("general")}</h4>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{t("manufacturer")}</Label>
              <Input
                value={manufacturer}
                onChange={(e) => setManufacturer(e.target.value)}
              />
              {errors.manufacturer && (
                <p className="text-xs text-destructive mt-1">{errors.manufacturer}</p>
              )}
            </div>
            <div>
              <Label>{t("model")}</Label>
              <Input value={model} onChange={(e) => setModel(e.target.value)} />
              {errors.model && (
                <p className="text-xs text-destructive mt-1">{errors.model}</p>
              )}
            </div>
            <div>
              <Label>{t("cellType")}</Label>
              <Input
                value={specs.cell_type}
                onChange={(e) => updateSpec("cell_type", e.target.value)}
              />
            </div>
            <div>
              <Label>{t("cells")}</Label>
              <Input
                type="number"
                value={specs.cells}
                onChange={(e) => updateSpec("cells", parseInt(e.target.value) || 0)}
              />
            </div>
          </div>

          <Separator />

          {/* Electrical */}
          <h4 className="font-medium text-sm">{t("electrical")}</h4>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>{t("pmax")} (W)</Label>
              <Input
                type="number"
                value={specs.pmax_w}
                onChange={(e) => updateSpec("pmax_w", parseFloat(e.target.value) || 0)}
              />
            </div>
            <div>
              <Label>{t("voc")} (V)</Label>
              <Input
                type="number"
                value={specs.voc_v}
                onChange={(e) => updateSpec("voc_v", parseFloat(e.target.value) || 0)}
              />
            </div>
            <div>
              <Label>{t("vmp")} (V)</Label>
              <Input
                type="number"
                value={specs.vmp_v}
                onChange={(e) => updateSpec("vmp_v", parseFloat(e.target.value) || 0)}
              />
              {errors.vmp_v && (
                <p className="text-xs text-destructive mt-1">{errors.vmp_v}</p>
              )}
            </div>
            <div>
              <Label>{t("isc")} (A)</Label>
              <Input
                type="number"
                value={specs.isc_a}
                onChange={(e) => updateSpec("isc_a", parseFloat(e.target.value) || 0)}
              />
            </div>
            <div>
              <Label>{t("imp")} (A)</Label>
              <Input
                type="number"
                value={specs.imp_a}
                onChange={(e) => updateSpec("imp_a", parseFloat(e.target.value) || 0)}
              />
              {errors.imp_a && (
                <p className="text-xs text-destructive mt-1">{errors.imp_a}</p>
              )}
            </div>
            <div>
              <Label>{t("efficiency")} (%)</Label>
              <Input
                type="number"
                step="0.1"
                value={specs.efficiency_pct}
                onChange={(e) =>
                  updateSpec("efficiency_pct", parseFloat(e.target.value) || 0)
                }
              />
            </div>
          </div>

          <Separator />

          {/* Temperature */}
          <h4 className="font-medium text-sm">{t("temperature")}</h4>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{t("tempCoeffPmax")}</Label>
              <Input
                type="number"
                step="0.001"
                value={specs.temp_coeff_pmax_pct_per_c}
                onChange={(e) =>
                  updateSpec("temp_coeff_pmax_pct_per_c", parseFloat(e.target.value) || 0)
                }
              />
            </div>
            <div>
              <Label>{t("tempCoeffVoc")}</Label>
              <Input
                type="number"
                step="0.001"
                value={specs.temp_coeff_voc_pct_per_c}
                onChange={(e) =>
                  updateSpec("temp_coeff_voc_pct_per_c", parseFloat(e.target.value) || 0)
                }
              />
            </div>
            <div>
              <Label>{t("tempCoeffIsc")}</Label>
              <Input
                type="number"
                step="0.001"
                value={specs.temp_coeff_isc_pct_per_c}
                onChange={(e) =>
                  updateSpec("temp_coeff_isc_pct_per_c", parseFloat(e.target.value) || 0)
                }
              />
            </div>
            <div>
              <Label>{t("noct")}</Label>
              <Input
                type="number"
                value={specs.noct_c}
                onChange={(e) => updateSpec("noct_c", parseFloat(e.target.value) || 0)}
              />
            </div>
          </div>

          <Separator />

          {/* Physical */}
          <h4 className="font-medium text-sm">{t("physical")}</h4>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{t("length")}</Label>
              <Input
                type="number"
                value={specs.dimensions_mm.length}
                onChange={(e) => updateDim("length", parseInt(e.target.value) || 0)}
              />
            </div>
            <div>
              <Label>{t("width")}</Label>
              <Input
                type="number"
                value={specs.dimensions_mm.width}
                onChange={(e) => updateDim("width", parseInt(e.target.value) || 0)}
              />
            </div>
            <div>
              <Label>{t("height")}</Label>
              <Input
                type="number"
                value={specs.dimensions_mm.height}
                onChange={(e) => updateDim("height", parseInt(e.target.value) || 0)}
              />
            </div>
            <div>
              <Label>{t("weight")} (kg)</Label>
              <Input
                type="number"
                step="0.1"
                value={specs.weight_kg}
                onChange={(e) => updateSpec("weight_kg", parseFloat(e.target.value) || 0)}
              />
            </div>
          </div>

          {/* Warranty */}
          <div className="w-1/2">
            <Label>{t("warranty")}</Label>
            <Input
              type="number"
              value={specs.warranty_years}
              onChange={(e) =>
                updateSpec("warranty_years", parseInt(e.target.value) || 0)
              }
            />
          </div>

          {isAdmin && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isGlobal}
                onChange={(e) => setIsGlobal(e.target.checked)}
              />
              {t("global")}
            </label>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {tc("cancel")}
          </Button>
          <Button onClick={handleSave}>{tc("save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
