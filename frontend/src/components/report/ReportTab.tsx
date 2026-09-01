"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import {
  FileText,
  ClipboardList,
  GitBranch,
  Download,
  Trash2,
  Loader2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Report {
  id: string;
  project_id: string;
  type: string;
  file_path: string;
  generated_at: string;
}

interface ReportTabProps {
  projectId: string;
  token: string;
}

const TYPE_LABELS: Record<string, string> = {
  full_report: "fullReport",
  quote_only: "quoteOnly",
  schematic_only: "schematicOnly",
};

export function ReportTab({ projectId, token }: ReportTabProps) {
  const t = useTranslations("report");
  const tc = useTranslations("common");

  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState<string | null>(null);

  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `${API_URL}/projects/${projectId}/reports`,
        { headers }
      );
      if (res.ok) {
        const data = await res.json();
        setReports(data);
      }
    } finally {
      setLoading(false);
    }
  }, [projectId, token]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const generateFullReport = async () => {
    setGenerating("full");
    try {
      const res = await fetch(
        `${API_URL}/projects/${projectId}/report`,
        { method: "POST", headers }
      );
      if (res.ok) {
        await fetchReports();
      }
    } finally {
      setGenerating(null);
    }
  };

  const downloadQuotePdf = async () => {
    setGenerating("quote");
    try {
      const res = await fetch(
        `${API_URL}/projects/${projectId}/report/quote`,
        { method: "POST", headers }
      );
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `devis-${projectId}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } finally {
      setGenerating(null);
    }
  };

  const downloadSchematicPdf = async () => {
    setGenerating("schematic");
    try {
      const res = await fetch(
        `${API_URL}/projects/${projectId}/report/schematic`,
        { method: "POST", headers }
      );
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `schema-${projectId}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } finally {
      setGenerating(null);
    }
  };

  const downloadReport = async (report: Report) => {
    const res = await fetch(
      `${API_URL}/projects/${projectId}/reports/${report.id}/download`,
      { headers }
    );
    if (res.ok) {
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = report.file_path.split("/").pop() || "report.pdf";
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const deleteReport = async (reportId: string) => {
    if (!confirm(t("deleteConfirm"))) return;
    const res = await fetch(
      `${API_URL}/projects/${projectId}/reports/${reportId}`,
      { method: "DELETE", headers }
    );
    if (res.ok) {
      setReports((prev) => prev.filter((r) => r.id !== reportId));
    }
  };

  return (
    <div className="space-y-6">
      {/* Generate section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("generateSection")}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            {t("generateDescription")}
          </p>
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={generateFullReport}
              disabled={generating !== null}
            >
              {generating === "full" ? (
                <Loader2 className="size-4 mr-2 animate-spin" />
              ) : (
                <FileText className="size-4 mr-2" />
              )}
              {generating === "full" ? t("generating") : t("downloadFull")}
            </Button>

            <Button
              variant="outline"
              onClick={downloadQuotePdf}
              disabled={generating !== null}
            >
              {generating === "quote" ? (
                <Loader2 className="size-4 mr-2 animate-spin" />
              ) : (
                <ClipboardList className="size-4 mr-2" />
              )}
              {generating === "quote" ? t("generating") : t("downloadQuote")}
            </Button>

            <Button
              variant="outline"
              onClick={downloadSchematicPdf}
              disabled={generating !== null}
            >
              {generating === "schematic" ? (
                <Loader2 className="size-4 mr-2 animate-spin" />
              ) : (
                <GitBranch className="size-4 mr-2" />
              )}
              {generating === "schematic"
                ? t("generating")
                : t("downloadSchematic")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* History section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("history")}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-8 text-center text-muted-foreground">
              {tc("loading")}
            </div>
          ) : reports.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              {t("noReports")}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("type")}</TableHead>
                  <TableHead>{t("date")}</TableHead>
                  <TableHead className="text-right">
                    {tc("actions")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.map((report) => (
                  <TableRow key={report.id}>
                    <TableCell>
                      {t(TYPE_LABELS[report.type] || report.type)}
                    </TableCell>
                    <TableCell>
                      {new Date(report.generated_at).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => downloadReport(report)}
                        >
                          <Download className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => deleteReport(report.id)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
