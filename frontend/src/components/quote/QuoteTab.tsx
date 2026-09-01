"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { QuoteEditor } from "@/components/quote/QuoteEditor";
import { QuotePreview } from "@/components/quote/QuotePreview";
import { useQuoteStore } from "@/store/quote";
import type { Quote } from "@/types/quote";

function formatFCFA(amount: number): string {
  return amount.toLocaleString("fr-FR");
}

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  draft: "secondary",
  sent: "default",
  accepted: "outline",
  rejected: "destructive",
};

interface QuoteTabProps {
  projectId: string;
  token: string;
}

export function QuoteTab({ projectId, token }: QuoteTabProps) {
  const t = useTranslations("quote");
  const tc = useTranslations("common");

  const { quotes, fetchQuotes, loading } = useQuoteStore();
  const [view, setView] = useState<"list" | "edit" | "preview">("list");
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);

  useEffect(() => {
    fetchQuotes(projectId, token);
  }, [projectId, token, fetchQuotes]);

  const handleCreate = () => {
    setSelectedQuote(null);
    setView("edit");
  };

  const handleEdit = (quote: Quote) => {
    setSelectedQuote(quote);
    setView("edit");
  };

  const handlePreview = (quote: Quote) => {
    setSelectedQuote(quote);
    setView("preview");
  };

  const handleSaved = () => {
    fetchQuotes(projectId, token);
    setView("list");
  };

  const handleBack = () => {
    setView("list");
    setSelectedQuote(null);
  };

  if (loading && quotes.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          {tc("loading")}
        </CardContent>
      </Card>
    );
  }

  // Edit view
  if (view === "edit") {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={handleBack}>
          {tc("back")}
        </Button>
        <QuoteEditor
          projectId={projectId}
          token={token}
          quote={selectedQuote}
          onSaved={handleSaved}
        />
      </div>
    );
  }

  // Preview view
  if (view === "preview" && selectedQuote) {
    return (
      <div className="space-y-4">
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={handleBack}>
            {tc("back")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleEdit(selectedQuote)}
          >
            {tc("edit")}
          </Button>
        </div>
        <QuotePreview
          quote={selectedQuote}
          projectId={projectId}
          token={token}
        />
      </div>
    );
  }

  // List view
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">{t("title")}</h3>
        <Button size="sm" onClick={handleCreate}>
          <Plus className="size-4 mr-1" />
          {t("create")}
        </Button>
      </div>

      {quotes.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {tc("noResults")}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("reference")}</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">{t("totalTtc")}</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {quotes.map((q) => (
                <TableRow
                  key={q.id}
                  className="cursor-pointer"
                  onClick={() => handlePreview(q)}
                >
                  <TableCell className="font-medium">
                    {q.reference || "—"}
                  </TableCell>
                  <TableCell>
                    {new Date(q.created_at).toLocaleDateString("fr-FR")}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatFCFA(q.total_fcfa)} FCFA
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={statusVariant[q.status] ?? "secondary"}
                      className={
                        q.status === "accepted"
                          ? "bg-green-100 text-green-800 border-green-300"
                          : ""
                      }
                    >
                      {t(
                        `status${q.status.charAt(0).toUpperCase() + q.status.slice(1)}` as
                          | "statusDraft"
                          | "statusSent"
                          | "statusAccepted"
                          | "statusRejected",
                      )}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEdit(q);
                      }}
                    >
                      {tc("edit")}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
