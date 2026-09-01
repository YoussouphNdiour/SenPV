"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import type { ProjectStatus } from "@/types/project";

const statusColors: Record<ProjectStatus, string> = {
  draft: "bg-gray-100 text-gray-700 border-gray-300",
  study: "bg-blue-100 text-blue-700 border-blue-300",
  quote: "bg-orange-100 text-orange-700 border-orange-300",
  signed: "bg-green-100 text-green-700 border-green-300",
  installed: "bg-emerald-100 text-emerald-800 border-emerald-400",
};

export function StatusBadge({ status }: { status: ProjectStatus }) {
  const t = useTranslations("project");

  const labelMap: Record<ProjectStatus, string> = {
    draft: t("statusDraft"),
    study: t("statusStudy"),
    quote: t("statusQuote"),
    signed: t("statusSigned"),
    installed: t("statusInstalled"),
  };

  return (
    <Badge
      variant="outline"
      className={statusColors[status] || statusColors.draft}
    >
      {labelMap[status] || status}
    </Badge>
  );
}
