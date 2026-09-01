"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import {
  Loader2,
  Calculator,
  Clock,
  TrendingUp,
  Percent,
  DollarSign,
  Zap,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CashflowChart } from "@/components/charts/CashflowChart";
import { useFinancialStore } from "@/store/financial";

interface FinancialSectionProps {
  projectId: string;
  token: string;
  annualSavingsFcfa: number | null;
  hasSimulation: boolean;
}

function formatFcfa(amount: number, locale: string): string {
  return `${amount.toLocaleString(locale === "en" ? "en-US" : "fr-FR")} FCFA`;
}

export function FinancialSection({
  projectId,
  token,
  annualSavingsFcfa,
  hasSimulation,
}: FinancialSectionProps) {
  const t = useTranslations("financial");
  const params = useParams();
  const locale = (params?.locale as string) ?? "fr";

  const { result, loading, error, calculate, fetchLatest } =
    useFinancialStore();

  // Form state
  const [totalCost, setTotalCost] = useState(5000000);
  const [maintenance, setMaintenance] = useState(0);
  const [degradation, setDegradation] = useState(0.5);
  const [inflation, setInflation] = useState(2.0);
  const [discountRate, setDiscountRate] = useState(8.0);

  useEffect(() => {
    fetchLatest(projectId, token);
  }, [projectId, token, fetchLatest]);

  const handleCalculate = () => {
    if (!annualSavingsFcfa || annualSavingsFcfa <= 0) return;
    calculate(projectId, token, {
      total_cost_fcfa: totalCost,
      annual_savings_fcfa: annualSavingsFcfa,
      maintenance_annual_fcfa: maintenance,
      degradation_rate_pct: degradation,
      discount_rate_pct: discountRate,
      inflation_rate_pct: inflation,
    });
  };

  const canCalculate = hasSimulation && annualSavingsFcfa && annualSavingsFcfa > 0;

  return (
    <div className="space-y-6">
      {/* Input form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Calculator className="size-5 text-emerald-500" />
            {t("title")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!hasSimulation && (
            <p className="text-sm text-muted-foreground">{t("noSimulation")}</p>
          )}
          {hasSimulation && !canCalculate && (
            <p className="text-sm text-muted-foreground">{t("noSavings")}</p>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="total-cost">{t("totalCost")} (FCFA)</Label>
              <Input
                id="total-cost"
                type="number"
                min={0}
                step={100000}
                value={totalCost || ""}
                onChange={(e) => setTotalCost(parseInt(e.target.value) || 0)}
                placeholder={t("totalCostPlaceholder")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="maintenance">{t("maintenanceCost")} (FCFA{t("perYear")})</Label>
              <Input
                id="maintenance"
                type="number"
                min={0}
                step={10000}
                value={maintenance || ""}
                onChange={(e) => setMaintenance(parseInt(e.target.value) || 0)}
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="degradation">{t("degradation")} (%)</Label>
              <Input
                id="degradation"
                type="number"
                min={0}
                max={5}
                step={0.1}
                value={degradation}
                onChange={(e) => setDegradation(parseFloat(e.target.value) || 0)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="inflation">{t("inflationRate")} (%)</Label>
              <Input
                id="inflation"
                type="number"
                min={0}
                max={20}
                step={0.5}
                value={inflation}
                onChange={(e) => setInflation(parseFloat(e.target.value) || 0)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="discount">{t("discountRate")} (%)</Label>
              <Input
                id="discount"
                type="number"
                min={0}
                max={30}
                step={0.5}
                value={discountRate}
                onChange={(e) => setDiscountRate(parseFloat(e.target.value) || 0)}
              />
            </div>
          </div>

          {/* Annual savings display */}
          {annualSavingsFcfa && annualSavingsFcfa > 0 && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground pt-2">
              <Zap className="size-4 text-amber-500" />
              {t("annualSavings")}: <span className="font-semibold text-foreground">{formatFcfa(annualSavingsFcfa, locale)}</span>
            </div>
          )}

          <Button
            onClick={handleCalculate}
            disabled={!canCalculate || loading}
            className="w-full md:w-auto"
          >
            {loading ? (
              <>
                <Loader2 className="size-4 mr-2 animate-spin" />
                {t("calculating")}
              </>
            ) : (
              <>
                <Calculator className="size-4 mr-2" />
                {t("calculate")}
              </>
            )}
          </Button>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </CardContent>
      </Card>

      {/* Results */}
      {result && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-amber-700 dark:text-amber-300">
                  {t("payback")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Clock className="size-5 text-amber-600" />
                  <span className="text-3xl font-bold text-amber-700 dark:text-amber-300">
                    {result.payback_years !== null
                      ? t("years", { n: result.payback_years })
                      : t("notApplicable")}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {t("npv")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <DollarSign className="size-5 text-green-500" />
                  <span className="text-xl font-bold">
                    {formatFcfa(result.npv_fcfa, locale)}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {t("irr")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <TrendingUp className="size-5 text-blue-500" />
                  <span className="text-xl font-bold">
                    {result.irr_pct !== null
                      ? `${result.irr_pct}%`
                      : t("notApplicable")}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {t("roi")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Percent className="size-5 text-purple-500" />
                  <span className="text-xl font-bold">
                    {result.roi_pct}%
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* LCOE */}
          <Card>
            <CardContent className="py-4 flex items-center gap-3">
              <Zap className="size-5 text-amber-500" />
              <div>
                <p className="text-sm text-muted-foreground">{t("lcoe")}</p>
                <p className="text-lg font-bold">
                  {result.lcoe_fcfa_per_kwh} FCFA/kWh
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Cashflow chart */}
          <Card>
            <CardContent className="pt-6">
              <CashflowChart
                data={result.cashflow_25y}
                paybackYear={result.payback_years}
                locale={locale}
              />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
