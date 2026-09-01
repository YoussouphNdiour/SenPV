"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import { Loader2, Zap, Sun, Gauge, BarChart3 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProductionChart } from "@/components/charts/ProductionChart";
import { BillingSection } from "@/components/senelec/BillingSection";
import { FinancialSection } from "@/components/financial/FinancialSection";
import { useSimulationStore } from "@/store/simulation";
import { usePanelStore } from "@/store/panels";
import { useSenelecStore } from "@/store/senelec";

interface SimulationTabProps {
  projectId: string;
  token: string;
}

export function SimulationTab({ projectId, token }: SimulationTabProps) {
  const t = useTranslations("simulation");
  const params = useParams();
  const locale = (params?.locale as string) ?? "fr";

  const { current, optimization, loading, optimizing, error, runSimulation, fetchHistory, optimize } =
    useSimulationStore();
  const layouts = usePanelStore((s) => s.layouts);
  const hasPanels = layouts.some((l) => l.num_panels > 0);
  const senelecSavings = useSenelecStore((s) => s.savings);

  useEffect(() => {
    fetchHistory(projectId, token);
  }, [projectId, token, fetchHistory]);

  return (
    <div className="space-y-6">
      {/* Action buttons */}
      <div className="flex gap-3">
        <Button
          onClick={() => runSimulation(projectId, token)}
          disabled={!hasPanels || loading}
        >
          {loading ? (
            <>
              <Loader2 className="size-4 mr-2 animate-spin" />
              {t("running")}
            </>
          ) : (
            <>
              <Zap className="size-4 mr-2" />
              {t("run")}
            </>
          )}
        </Button>
        <Button
          variant="outline"
          onClick={() => optimize(projectId, token)}
          disabled={!hasPanels || optimizing}
        >
          {optimizing ? (
            <Loader2 className="size-4 mr-2 animate-spin" />
          ) : (
            <Sun className="size-4 mr-2" />
          )}
          {t("optimizeTilt")}
        </Button>
      </div>

      {!hasPanels && (
        <p className="text-sm text-muted-foreground">{t("noPanels")}</p>
      )}

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {/* Optimization result */}
      {optimization && (
        <Card>
          <CardContent className="py-4">
            <p className="text-sm">
              {t("optimalTilt", { tilt: optimization.optimal_tilt })}
            </p>
            <p className="text-sm">
              {t("optimalAzimuth", { azimuth: optimization.optimal_azimuth })}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {current && (
        <>
          <h2 className="text-lg font-semibold">{t("results")}</h2>

          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {t("annualProduction")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Zap className="size-5 text-amber-500" />
                  <span className="text-2xl font-bold">
                    {current.annual_kwh.toLocaleString(locale)}
                  </span>
                  <span className="text-sm text-muted-foreground">kWh</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {t("peakPower")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Sun className="size-5 text-orange-500" />
                  <span className="text-2xl font-bold">
                    {current.peak_power_kwc ?? "—"}
                  </span>
                  <span className="text-sm text-muted-foreground">kWc</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {t("specificYield")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <BarChart3 className="size-5 text-yellow-500" />
                  <span className="text-2xl font-bold">
                    {current.specific_yield ?? "—"}
                  </span>
                  <span className="text-sm text-muted-foreground">kWh/kWc</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {t("performanceRatio")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Gauge className="size-5 text-green-500" />
                  <span className="text-2xl font-bold">
                    {current.performance_ratio
                      ? `${(Number(current.performance_ratio) * 100).toFixed(1)}%`
                      : "—"}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Chart */}
          <Card>
            <CardContent className="pt-6">
              <ProductionChart data={current.monthly_production} locale={locale} />
            </CardContent>
          </Card>
        </>
      )}

      {/* SENELEC Billing */}
      <BillingSection
        annualProductionKwh={current?.annual_kwh ?? null}
      />

      {/* Financial Analysis */}
      <FinancialSection
        projectId={projectId}
        token={token}
        annualSavingsFcfa={senelecSavings?.annual_savings_fcfa ?? null}
        hasSimulation={!!current}
      />
    </div>
  );
}
