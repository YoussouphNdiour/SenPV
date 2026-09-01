"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { RecentProject } from "@/types/dashboard";

const statusColors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-800",
  study: "bg-blue-100 text-blue-800",
  quote: "bg-amber-100 text-amber-800",
  signed: "bg-emerald-100 text-emerald-800",
  installed: "bg-green-100 text-green-800",
};

interface RecentProjectsTableProps {
  projects: RecentProject[];
  showClient?: boolean;
  showQuote?: boolean;
}

export function RecentProjectsTable({
  projects,
  showClient = false,
  showQuote = false,
}: RecentProjectsTableProps) {
  const t = useTranslations("project");
  const td = useTranslations("dashboard");

  if (projects.length === 0) {
    return (
      <p className="text-muted-foreground text-sm py-8 text-center">
        {td("noProjects")}
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          {showClient && <TableHead>{t("client")}</TableHead>}
          <TableHead>{t("name")}</TableHead>
          <TableHead>{t("power")}</TableHead>
          <TableHead>{t("status")}</TableHead>
          {showQuote && <TableHead>{td("quoteAmount")}</TableHead>}
          <TableHead>{t("createdAt")}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {projects.map((project) => (
          <TableRow key={project.id} className="cursor-pointer hover:bg-muted/50">
            {showClient && (
              <TableCell>{project.client_name || "—"}</TableCell>
            )}
            <TableCell>
              <Link
                href={`/projects/${project.id}`}
                className="font-medium hover:underline"
              >
                {project.name}
              </Link>
            </TableCell>
            <TableCell>
              {project.peak_power_kwc
                ? `${project.peak_power_kwc.toFixed(1)} kWc`
                : "—"}
            </TableCell>
            <TableCell>
              <Badge
                variant="secondary"
                className={statusColors[project.status] || ""}
              >
                {t(`status${project.status.charAt(0).toUpperCase() + project.status.slice(1)}`)}
              </Badge>
            </TableCell>
            {showQuote && (
              <TableCell>
                {project.quote_total_fcfa
                  ? `${project.quote_total_fcfa.toLocaleString("fr-FR")} FCFA`
                  : "—"}
              </TableCell>
            )}
            <TableCell className="text-muted-foreground">
              {project.created_at
                ? new Date(project.created_at).toLocaleDateString("fr-FR")
                : "—"}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
