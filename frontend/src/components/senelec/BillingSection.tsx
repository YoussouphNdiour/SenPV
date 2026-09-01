"use client";

import { useEffect, useCallback, useRef } from "react";
import { useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import { Loader2, Receipt, TrendingDown, Percent, Zap } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SavingsChart } from "@/components/charts/SavingsChart";
import { useSenelecStore } from "@/store/senelec";

interface BillingSectionProps {
  annualProductionKwh: number | null;
  clientMonthlyKwh?: number | null;
  clientTariffTier?: string | null;
}

const TARIFF_TIERS = [
  { value: "DPP", label: "DPP — Domestique Petite Puissance" },
  { value: "DMP", label: "DMP — Domestique Moyenne Puissance" },
  { value: "DGP", label: "DGP — Domestique Grande Puissance" },
  { value: "PP", label: "PP — Professionnel" },
];

function formatFcfa(amount: number, locale: string): string {
  return `${amount.toLocaleString(locale === "en" ? "en-US" : "fr-FR")} FCFA`;
}

function autoTier(kwh: number): string {
  if (kwh <= 150) return "DPP";
  if (kwh <= 250) return "DMP";
  return "DGP";
}

export function BillingSection({
  annualProductionKwh,
  clientMonthlyKwh,
  clientTariffTier,
}: BillingSectionProps) {
  const t = useTranslations("senelec");
  const params = useParams();
  const locale = (params?.locale as string) ?? "fr";

  const {
    bill,
    savings,
    monthlyKwh,
    tariffTier,
    loading,
    setMonthlyKwh,
    setTariffTier,
    fetchBill,
    fetchSavings,
    fetchTariffs,
  } = useSenelecStore();

  const initialized = useRef(false);

  // Initialize from client data
  useEffect(() => {
    fetchTariffs();
  }, [fetchTariffs]);

  useEffect(() => {
    if (initialized.current) return;
    if (clientMonthlyKwh && clientMonthlyKwh > 0) {
      setMonthlyKwh(clientMonthlyKwh);
      setTariffTier(clientTariffTier ?? autoTier(clientMonthlyKwh));
      initialized.current = true;
    }
  }, [clientMonthlyKwh, clientTariffTier, setMonthlyKwh, setTariffTier]);

  // Debounced bill/savings fetch
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const fetchData = useCallback(() => {
    if (monthlyKwh <= 0) return;
    const tier = tariffTier ?? autoTier(monthlyKwh);
    fetchBill(monthlyKwh, tier);
    if (annualProductionKwh && annualProductionKwh > 0) {
      fetchSavings(monthlyKwh, annualProductionKwh, tier);
    }
  }, [monthlyKwh, tariffTier, annualProductionKwh, fetchBill, fetchSavings]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(fetchData, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [fetchData]);

  const handleKwhChange = (value: string) => {
    const kwh = parseFloat(value) || 0;
    setMonthlyKwh(kwh);
    if (kwh > 0 && !tariffTier) {
      setTariffTier(autoTier(kwh));
    }
  };

  const handleTierChange = (value: string | null) => {
    setTariffTier(value);
  };

  return (
    <div className="space-y-6">
      {/* Consumption input */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Receipt className="size-5 text-blue-500" />
            {t("title")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="monthly-kwh">{t("monthlyKwh")}</Label>
              <Input
                id="monthly-kwh"
                type="number"
                min={0}
                step={10}
                value={monthlyKwh || ""}
                onChange={(e) => handleKwhChange(e.target.value)}
                placeholder="350"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tariff-tier">{t("tariffTier")}</Label>
              <Select
                value={tariffTier ?? autoTier(monthlyKwh || 150)}
                onValueChange={handleTierChange}
              >
                <SelectTrigger id="tariff-tier">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TARIFF_TIERS.map((tier) => (
                    <SelectItem key={tier.value} value={tier.value}>
                      {tier.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {loading && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              {t("calculating")}
            </div>
          )}

          {/* Current bill breakdown */}
          {bill && !loading && (
            <div className="space-y-4 pt-2">
              <h4 className="text-sm font-semibold">{t("currentBill")}</h4>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("tier")}</TableHead>
                    <TableHead className="text-right">{t("kwhConsumed")}</TableHead>
                    <TableHead className="text-right">{t("rate")}</TableHead>
                    <TableHead className="text-right">{t("amount")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bill.breakdown.map((row) => (
                    <TableRow key={row.tier}>
                      <TableCell className="font-medium">{row.tier}</TableCell>
                      <TableCell className="text-right">{row.kwh} kWh</TableCell>
                      <TableCell className="text-right">
                        {row.rate.toFixed(2)} FCFA/kWh
                      </TableCell>
                      <TableCell className="text-right">
                        {formatFcfa(row.amount, locale)}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow>
                    <TableCell colSpan={3} className="font-medium">
                      {t("subtotal")}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatFcfa(bill.subtotal_fcfa, locale)}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell colSpan={3}>{t("redevance")}</TableCell>
                    <TableCell className="text-right">
                      {formatFcfa(bill.redevance_fcfa, locale)}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell colSpan={3}>
                      {t("tva")} ({bill.tva_pct}%)
                    </TableCell>
                    <TableCell className="text-right">
                      {formatFcfa(bill.tva_amount_fcfa, locale)}
                    </TableCell>
                  </TableRow>
                  <TableRow className="font-bold">
                    <TableCell colSpan={3}>{t("totalMonthly")}</TableCell>
                    <TableCell className="text-right">
                      {formatFcfa(bill.total_monthly_fcfa, locale)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>

              <div className="flex gap-4 text-sm">
                <span className="text-muted-foreground">{t("totalAnnual")}:</span>
                <span className="font-semibold">
                  {formatFcfa(bill.total_annual_fcfa, locale)}
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Savings section — only if simulation ran */}
      {savings && !loading && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {t("withoutPv")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-lg font-bold text-red-500">
                  {formatFcfa(savings.bill_without_pv.total_monthly_fcfa, locale)}
                  <span className="text-xs text-muted-foreground font-normal">
                    /{t("month")}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {t("withPv")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-lg font-bold text-green-500">
                  {formatFcfa(savings.bill_with_pv.total_monthly_fcfa, locale)}
                  <span className="text-xs text-muted-foreground font-normal">
                    /{t("month")}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {t("savings")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <TrendingDown className="size-5 text-green-500" />
                  <Badge variant="default" className="bg-green-600 text-base px-3 py-1">
                    {formatFcfa(savings.monthly_savings_fcfa, locale)}/{t("month")}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <Card className="border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-green-700 dark:text-green-300">
                  {t("annualSavings")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-700 dark:text-green-300">
                  {formatFcfa(savings.annual_savings_fcfa, locale)}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Self-consumption & grid reduction */}
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardContent className="pt-6 flex items-center gap-3">
                <Zap className="size-5 text-amber-500" />
                <div>
                  <p className="text-sm text-muted-foreground">
                    {t("selfConsumption")}
                  </p>
                  <p className="text-xl font-bold">
                    {savings.self_consumption_pct}%
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 flex items-center gap-3">
                <Percent className="size-5 text-blue-500" />
                <div>
                  <p className="text-sm text-muted-foreground">
                    {t("gridReduction")}
                  </p>
                  <p className="text-xl font-bold">
                    {savings.grid_reduction_pct}%
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Comparison chart */}
          <Card>
            <CardContent className="pt-6">
              <SavingsChart
                monthlyWithout={savings.bill_without_pv.total_monthly_fcfa}
                monthlyWith={savings.bill_with_pv.total_monthly_fcfa}
                locale={locale}
              />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
