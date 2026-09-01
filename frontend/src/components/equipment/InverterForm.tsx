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
import type { Equipment, InverterSpecs } from "@/types/equipment";

interface InverterFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: {
    manufacturer: string;
    model: string;
    specs: InverterSpecs;
    is_global?: boolean;
  }) => void;
  initial?: Equipment;
  isAdmin?: boolean;
}

const defaultSpecs: InverterSpecs = {
  max_pv_power_kw: 6.5,
  max_pv_voltage_v: 550,
  startup_voltage_v: 80,
  mppt_voltage_range_v: "80-500",
  rated_pv_voltage_v: 360,
  max_input_current_a: 12.5,
  max_short_circuit_current_a: 18.75,
  num_mppt: 2,
  strings_per_mppt: 1,
  rated_ac_power_kw: 5.0,
  max_ac_apparent_kva: 5.5,
  rated_ac_current_a: 22.7,
  max_ac_current_a: 25.0,
  rated_output_voltage_v: 230,
  rated_output_freq_hz: 50,
  output_freq_range_hz: "45-55",
  power_factor_range: "0.8 leading - 0.8 lagging",
  thdi_pct: 3.0,
  dc_injection_ma: 10,
  max_efficiency_pct: 97.5,
  euro_efficiency_pct: 97.0,
  mppt_efficiency_pct: 99.9,
  dimensions_mm: { width: 350, height: 400, depth: 180 },
  weight_kg: 15.0,
  ip_rating: "IP65",
  warranty_years: 10,
};

export function InverterForm({
  open,
  onOpenChange,
  onSave,
  initial,
  isAdmin,
}: InverterFormProps) {
  const t = useTranslations("equipment");
  const tc = useTranslations("common");

  const initSpecs = initial ? (initial.specs as InverterSpecs) : defaultSpecs;
  const [manufacturer, setManufacturer] = useState(initial?.manufacturer ?? "");
  const [model, setModel] = useState(initial?.model ?? "");
  const [isGlobal, setIsGlobal] = useState(initial?.is_global ?? false);
  const [specs, setSpecs] = useState<InverterSpecs>({ ...initSpecs });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const updateSpec = <K extends keyof InverterSpecs>(key: K, value: InverterSpecs[K]) => {
    setSpecs((prev) => ({ ...prev, [key]: value }));
  };

  const updateDim = (key: "width" | "height" | "depth", value: number) => {
    setSpecs((prev) => ({
      ...prev,
      dimensions_mm: { ...prev.dimensions_mm, [key]: value },
    }));
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!manufacturer.trim()) errs.manufacturer = "Required";
    if (!model.trim()) errs.model = "Required";
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
            {initial ? t("editInverter") : t("addInverter")}
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
          </div>

          <Separator />

          {/* DC Input */}
          <h4 className="font-medium text-sm">{t("dcInput")}</h4>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>{t("maxPvPower")} (kW)</Label>
              <Input
                type="number"
                step="0.1"
                value={specs.max_pv_power_kw}
                onChange={(e) =>
                  updateSpec("max_pv_power_kw", parseFloat(e.target.value) || 0)
                }
              />
            </div>
            <div>
              <Label>{t("maxPvVoltage")} (V)</Label>
              <Input
                type="number"
                value={specs.max_pv_voltage_v}
                onChange={(e) =>
                  updateSpec("max_pv_voltage_v", parseFloat(e.target.value) || 0)
                }
              />
            </div>
            <div>
              <Label>{t("startupVoltage")} (V)</Label>
              <Input
                type="number"
                value={specs.startup_voltage_v}
                onChange={(e) =>
                  updateSpec("startup_voltage_v", parseFloat(e.target.value) || 0)
                }
              />
            </div>
            <div>
              <Label>{t("mpptRange")} (V)</Label>
              <Input
                value={specs.mppt_voltage_range_v}
                onChange={(e) => updateSpec("mppt_voltage_range_v", e.target.value)}
              />
            </div>
            <div>
              <Label>{t("ratedPvVoltage")} (V)</Label>
              <Input
                type="number"
                value={specs.rated_pv_voltage_v}
                onChange={(e) =>
                  updateSpec("rated_pv_voltage_v", parseFloat(e.target.value) || 0)
                }
              />
            </div>
            <div>
              <Label>{t("maxInputCurrent")} (A)</Label>
              <Input
                type="number"
                step="0.1"
                value={specs.max_input_current_a}
                onChange={(e) =>
                  updateSpec("max_input_current_a", parseFloat(e.target.value) || 0)
                }
              />
            </div>
            <div>
              <Label>{t("maxShortCircuitCurrent")} (A)</Label>
              <Input
                type="number"
                step="0.1"
                value={specs.max_short_circuit_current_a}
                onChange={(e) =>
                  updateSpec("max_short_circuit_current_a", parseFloat(e.target.value) || 0)
                }
              />
            </div>
            <div>
              <Label>{t("numMppt")}</Label>
              <Input
                type="number"
                value={specs.num_mppt}
                onChange={(e) =>
                  updateSpec("num_mppt", parseInt(e.target.value) || 0)
                }
              />
            </div>
            <div>
              <Label>{t("stringsPerMppt")}</Label>
              <Input
                type="number"
                value={specs.strings_per_mppt}
                onChange={(e) =>
                  updateSpec("strings_per_mppt", parseInt(e.target.value) || 0)
                }
              />
            </div>
          </div>

          <Separator />

          {/* AC Output */}
          <h4 className="font-medium text-sm">{t("acOutput")}</h4>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>{t("ratedAcPower")} (kW)</Label>
              <Input
                type="number"
                step="0.1"
                value={specs.rated_ac_power_kw}
                onChange={(e) =>
                  updateSpec("rated_ac_power_kw", parseFloat(e.target.value) || 0)
                }
              />
            </div>
            <div>
              <Label>{t("maxAcApparent")} (kVA)</Label>
              <Input
                type="number"
                step="0.1"
                value={specs.max_ac_apparent_kva}
                onChange={(e) =>
                  updateSpec("max_ac_apparent_kva", parseFloat(e.target.value) || 0)
                }
              />
            </div>
            <div>
              <Label>{t("ratedAcCurrent")} (A)</Label>
              <Input
                type="number"
                step="0.1"
                value={specs.rated_ac_current_a}
                onChange={(e) =>
                  updateSpec("rated_ac_current_a", parseFloat(e.target.value) || 0)
                }
              />
            </div>
            <div>
              <Label>{t("maxAcCurrent")} (A)</Label>
              <Input
                type="number"
                step="0.1"
                value={specs.max_ac_current_a}
                onChange={(e) =>
                  updateSpec("max_ac_current_a", parseFloat(e.target.value) || 0)
                }
              />
            </div>
            <div>
              <Label>{t("ratedVoltage")} (V)</Label>
              <Input
                type="number"
                value={specs.rated_output_voltage_v}
                onChange={(e) =>
                  updateSpec("rated_output_voltage_v", parseFloat(e.target.value) || 0)
                }
              />
            </div>
            <div>
              <Label>{t("ratedFreq")} (Hz)</Label>
              <Input
                type="number"
                value={specs.rated_output_freq_hz}
                onChange={(e) =>
                  updateSpec("rated_output_freq_hz", parseFloat(e.target.value) || 0)
                }
              />
            </div>
            <div>
              <Label>{t("freqRange")} (Hz)</Label>
              <Input
                value={specs.output_freq_range_hz}
                onChange={(e) => updateSpec("output_freq_range_hz", e.target.value)}
              />
            </div>
            <div>
              <Label>{t("powerFactor")}</Label>
              <Input
                value={specs.power_factor_range}
                onChange={(e) => updateSpec("power_factor_range", e.target.value)}
              />
            </div>
            <div>
              <Label>{t("thdi")}</Label>
              <Input
                type="number"
                step="0.1"
                value={specs.thdi_pct}
                onChange={(e) =>
                  updateSpec("thdi_pct", parseFloat(e.target.value) || 0)
                }
              />
            </div>
            <div>
              <Label>{t("dcInjection")}</Label>
              <Input
                type="number"
                value={specs.dc_injection_ma}
                onChange={(e) =>
                  updateSpec("dc_injection_ma", parseFloat(e.target.value) || 0)
                }
              />
            </div>
          </div>

          <Separator />

          {/* Efficiency */}
          <h4 className="font-medium text-sm">{t("efficiencyGroup")}</h4>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>{t("maxEfficiency")} (%)</Label>
              <Input
                type="number"
                step="0.1"
                value={specs.max_efficiency_pct}
                onChange={(e) =>
                  updateSpec("max_efficiency_pct", parseFloat(e.target.value) || 0)
                }
              />
            </div>
            <div>
              <Label>{t("euroEfficiency")} (%)</Label>
              <Input
                type="number"
                step="0.1"
                value={specs.euro_efficiency_pct}
                onChange={(e) =>
                  updateSpec("euro_efficiency_pct", parseFloat(e.target.value) || 0)
                }
              />
            </div>
            <div>
              <Label>{t("mpptEfficiency")} (%)</Label>
              <Input
                type="number"
                step="0.1"
                value={specs.mppt_efficiency_pct}
                onChange={(e) =>
                  updateSpec("mppt_efficiency_pct", parseFloat(e.target.value) || 0)
                }
              />
            </div>
          </div>

          <Separator />

          {/* Physical */}
          <h4 className="font-medium text-sm">{t("physical")}</h4>
          <div className="grid grid-cols-2 gap-3">
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
              <Label>{t("depth")}</Label>
              <Input
                type="number"
                value={specs.dimensions_mm.depth}
                onChange={(e) => updateDim("depth", parseInt(e.target.value) || 0)}
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
            <div>
              <Label>{t("ipRating")}</Label>
              <Input
                value={specs.ip_rating}
                onChange={(e) => updateSpec("ip_rating", e.target.value)}
              />
            </div>
            <div>
              <Label>{t("warranty")}</Label>
              <Input
                type="number"
                value={specs.warranty_years}
                onChange={(e) =>
                  updateSpec("warranty_years", parseInt(e.target.value) || 0)
                }
              />
            </div>
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
