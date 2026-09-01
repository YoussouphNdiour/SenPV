"use client";

import { useTranslations } from "next-intl";
import { Download, Send, Check, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from "@/components/ui/table";
import { useQuoteStore } from "@/store/quote";
import type { Quote } from "@/types/quote";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function formatFCFA(amount: number): string {
  return amount.toLocaleString("fr-FR");
}

const statusConfig: Record<
  string,
  { variant: "default" | "secondary" | "destructive" | "outline"; label: string }
> = {
  draft: { variant: "secondary", label: "statusDraft" },
  sent: { variant: "default", label: "statusSent" },
  accepted: { variant: "outline", label: "statusAccepted" },
  rejected: { variant: "destructive", label: "statusRejected" },
};

interface QuotePreviewProps {
  quote: Quote;
  projectId: string;
  token: string;
}

export function QuotePreview({ quote, projectId, token }: QuotePreviewProps) {
  const t = useTranslations("quote");
  const { updateStatus } = useQuoteStore();

  const subtotal = quote.subtotal_fcfa;
  const marginPct = Number(quote.margin_pct ?? 0);
  const marginAmount = Math.floor((subtotal * marginPct) / 100);
  const totalHT = subtotal + marginAmount;
  const taxRatePct = Number(quote.tax_rate_pct);

  const config = statusConfig[quote.status] ?? statusConfig.draft;

  const handleDownloadPdf = () => {
    const url = `${API_URL}/projects/${projectId}/quotes/${quote.id}/pdf`;
    const a = document.createElement("a");
    a.href = url;
    a.download = `devis-${quote.reference || quote.id}.pdf`;
    // Add auth header via fetch + blob
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.blob())
      .then((blob) => {
        const blobUrl = URL.createObjectURL(blob);
        a.href = blobUrl;
        a.click();
        URL.revokeObjectURL(blobUrl);
      });
  };

  const handleStatusChange = (status: string) => {
    updateStatus(projectId, quote.id, token, status);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-3">
          <CardTitle className="text-base">
            {quote.reference || t("title")}
          </CardTitle>
          <Badge
            variant={config.variant}
            className={
              quote.status === "accepted"
                ? "bg-green-100 text-green-800 border-green-300"
                : ""
            }
          >
            {t(config.label as "statusDraft" | "statusSent" | "statusAccepted" | "statusRejected")}
          </Badge>
        </div>
        <div className="flex gap-2">
          {quote.status === "draft" && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleStatusChange("sent")}
            >
              <Send className="size-4 mr-1" />
              {t("statusSent")}
            </Button>
          )}
          {quote.status === "sent" && (
            <>
              <Button
                size="sm"
                variant="outline"
                className="text-green-700"
                onClick={() => handleStatusChange("accepted")}
              >
                <Check className="size-4 mr-1" />
                {t("statusAccepted")}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-destructive"
                onClick={() => handleStatusChange("rejected")}
              >
                <X className="size-4 mr-1" />
                {t("statusRejected")}
              </Button>
            </>
          )}
          <Button size="sm" onClick={handleDownloadPdf}>
            <Download className="size-4 mr-1" />
            {t("downloadPdf")}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Line items preview */}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8">#</TableHead>
              <TableHead>{t("description")}</TableHead>
              <TableHead className="text-right">{t("quantity")}</TableHead>
              <TableHead className="text-right">{t("unitPrice")}</TableHead>
              <TableHead className="text-right">{t("total")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(quote.line_items as Array<{ description: string; quantity: number; unit_price_fcfa: number }>).map((item, i) => (
              <TableRow key={i}>
                <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                <TableCell>{item.description}</TableCell>
                <TableCell className="text-right">{item.quantity}</TableCell>
                <TableCell className="text-right">
                  {formatFCFA(item.unit_price_fcfa)} FCFA
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatFCFA(item.quantity * item.unit_price_fcfa)} FCFA
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={4} className="text-right">
                {t("subtotal")}
              </TableCell>
              <TableCell className="text-right font-medium">
                {formatFCFA(subtotal)} FCFA
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>

        {/* Totals summary */}
        <div className="mt-4 ml-auto max-w-xs space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{t("subtotal")}</span>
            <span>{formatFCFA(subtotal)} FCFA</span>
          </div>
          {marginPct > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                {t("margin")} ({marginPct}%)
              </span>
              <span>{formatFCFA(marginAmount)} FCFA</span>
            </div>
          )}
          {marginPct > 0 && (
            <div className="flex justify-between text-sm border-t pt-1">
              <span className="text-muted-foreground">Total HT</span>
              <span>{formatFCFA(totalHT)} FCFA</span>
            </div>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">
              {t("taxAmount")} ({taxRatePct}%)
            </span>
            <span>{formatFCFA(quote.tax_amount_fcfa)} FCFA</span>
          </div>
          <div className="flex justify-between border-t-2 border-primary pt-2">
            <span className="font-bold text-primary">{t("totalTtc")}</span>
            <span className="text-lg font-bold text-primary">
              {formatFCFA(quote.total_fcfa)} FCFA
            </span>
          </div>
        </div>

        {/* Payment terms */}
        {quote.payment_terms && (
          <div className="mt-4 p-3 bg-muted/50 rounded-md text-sm">
            <div className="font-medium mb-1">{t("paymentTerms")}</div>
            <div className="text-muted-foreground whitespace-pre-line">
              {quote.payment_terms}
            </div>
          </div>
        )}

        {/* Meta */}
        <div className="mt-4 flex gap-6 text-xs text-muted-foreground">
          <span>
            {t("validityDays")}: {quote.validity_days}j
          </span>
          <span>
            {new Date(quote.created_at).toLocaleDateString("fr-FR")}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
