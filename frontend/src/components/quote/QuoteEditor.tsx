"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Package, Save, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LineItemTable } from "@/components/quote/LineItemTable";
import { useQuoteStore } from "@/store/quote";
import { useEquipmentStore } from "@/store/equipment";
import type { LineItem, Quote } from "@/types/quote";
import type { Equipment, PanelSpecs, InverterSpecs } from "@/types/equipment";

function formatFCFA(amount: number): string {
  return amount.toLocaleString("fr-FR");
}

interface QuoteEditorProps {
  projectId: string;
  token: string;
  quote?: Quote | null;
  onSaved?: () => void;
}

export function QuoteEditor({
  projectId,
  token,
  quote,
  onSaved,
}: QuoteEditorProps) {
  const t = useTranslations("quote");
  const tc = useTranslations("common");

  const { createQuote, updateQuote, loading } = useQuoteStore();
  const { panels, inverters, fetchPanels, fetchInverters } =
    useEquipmentStore();

  const [lineItems, setLineItems] = useState<LineItem[]>(
    quote?.line_items ?? [],
  );
  const [marginPct, setMarginPct] = useState(
    quote?.margin_pct != null ? Number(quote.margin_pct) : 15,
  );
  const [taxRatePct, setTaxRatePct] = useState(
    quote?.tax_rate_pct != null ? Number(quote.tax_rate_pct) : 18,
  );
  const [paymentTerms, setPaymentTerms] = useState(
    quote?.payment_terms ?? "50% à la commande, 50% à la mise en service",
  );
  const [validityDays, setValidityDays] = useState(quote?.validity_days ?? 30);
  const [catalogOpen, setCatalogOpen] = useState(false);

  useEffect(() => {
    fetchPanels(token);
    fetchInverters(token);
  }, [token, fetchPanels, fetchInverters]);

  // Real-time calculations
  const calculations = useMemo(() => {
    const subtotal = lineItems.reduce(
      (sum, item) => sum + item.quantity * item.unit_price_fcfa,
      0,
    );
    const marginAmount = Math.floor((subtotal * marginPct) / 100);
    const totalHT = subtotal + marginAmount;
    const taxAmount = Math.floor((totalHT * taxRatePct) / 100);
    const totalTTC = totalHT + taxAmount;
    return { subtotal, marginAmount, totalHT, taxAmount, totalTTC };
  }, [lineItems, marginPct, taxRatePct]);

  const handleSave = useCallback(async () => {
    const body = {
      line_items: lineItems,
      margin_pct: marginPct,
      tax_rate_pct: taxRatePct,
      payment_terms: paymentTerms || undefined,
      validity_days: validityDays,
    };

    if (quote) {
      await updateQuote(projectId, quote.id, token, body);
    } else {
      await createQuote(projectId, token, body);
    }
    onSaved?.();
  }, [
    lineItems,
    marginPct,
    taxRatePct,
    paymentTerms,
    validityDays,
    quote,
    projectId,
    token,
    createQuote,
    updateQuote,
    onSaved,
  ]);

  const addFromCatalog = (eq: Equipment) => {
    const specs = eq.specs;
    let price = 0;
    let desc = `${eq.manufacturer} ${eq.model}`;
    if (eq.type === "panel") {
      const ps = specs as PanelSpecs;
      desc += ` (${ps.pmax_w}W)`;
      price = ps.pmax_w * 340; // rough estimate FCFA/W
    } else {
      const is_ = specs as InverterSpecs;
      desc += ` (${is_.rated_ac_power_kw}kW)`;
      price = Math.round(is_.rated_ac_power_kw * 130000); // rough estimate
    }
    setLineItems((prev) => [
      ...prev,
      { description: desc, quantity: 1, unit_price_fcfa: price },
    ]);
    setCatalogOpen(false);
  };

  const allEquipment = [...panels, ...inverters];

  return (
    <div className="space-y-6">
      {/* Line items */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base">{t("lineItems")}</CardTitle>
          <Dialog open={catalogOpen} onOpenChange={setCatalogOpen}>
            <DialogTrigger
              render={<Button variant="outline" size="sm" />}
            >
              <Package className="size-4 mr-1" />
              Catalogue
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Catalogue équipements</DialogTitle>
              </DialogHeader>
              <div className="max-h-80 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Modèle</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allEquipment.map((eq) => (
                      <TableRow key={eq.id}>
                        <TableCell className="capitalize">{eq.type}</TableCell>
                        <TableCell>
                          {eq.manufacturer} {eq.model}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => addFromCatalog(eq)}
                          >
                            {tc("add")}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {allEquipment.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={3}
                          className="text-center text-muted-foreground py-6"
                        >
                          {tc("noResults")}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <LineItemTable items={lineItems} onChange={setLineItems} />
        </CardContent>
      </Card>

      {/* Settings & Totals */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Settings */}
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t("margin")}</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={marginPct}
                  onChange={(e) => setMarginPct(parseFloat(e.target.value) || 0)}
                />
              </div>
              <div>
                <Label>{t("taxRate")}</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={taxRatePct}
                  onChange={(e) =>
                    setTaxRatePct(parseFloat(e.target.value) || 0)
                  }
                />
              </div>
            </div>
            <div>
              <Label>{t("validityDays")}</Label>
              <Input
                type="number"
                min={1}
                value={validityDays}
                onChange={(e) =>
                  setValidityDays(parseInt(e.target.value) || 30)
                }
              />
            </div>
            <div>
              <Label>{t("paymentTerms")}</Label>
              <textarea
                className="flex min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={paymentTerms}
                onChange={(e) => setPaymentTerms(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Totals */}
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("subtotal")}</span>
                <span className="font-medium">
                  {formatFCFA(calculations.subtotal)} FCFA
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {t("margin")} ({marginPct}%)
                </span>
                <span>{formatFCFA(calculations.marginAmount)} FCFA</span>
              </div>
              <div className="flex justify-between border-t pt-2">
                <span className="text-muted-foreground">Total HT</span>
                <span className="font-medium">
                  {formatFCFA(calculations.totalHT)} FCFA
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {t("taxRate")} ({taxRatePct}%)
                </span>
                <span>{formatFCFA(calculations.taxAmount)} FCFA</span>
              </div>
              <div className="flex justify-between border-t-2 border-primary pt-3">
                <span className="font-bold text-primary">{t("totalTtc")}</span>
                <span className="text-lg font-bold text-primary">
                  {formatFCFA(calculations.totalTTC)} FCFA
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <div className="flex gap-3 justify-end">
        <Button onClick={handleSave} disabled={loading || lineItems.length === 0}>
          <Save className="size-4 mr-1" />
          {tc("save")}
        </Button>
      </div>
    </div>
  );
}
