"use client";

import { useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";
import { Plus, Search, LayoutGrid, List } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/layout/StatusBadge";
import { useProjectStore } from "@/store/project";
import { Link } from "@/i18n/routing";
import type { ProjectStatus } from "@/types/project";
import { CreateProjectDialog } from "@/components/project/CreateProjectDialog";

const statuses: ProjectStatus[] = [
  "draft",
  "study",
  "quote",
  "signed",
  "installed",
];

export default function ProjectsPage() {
  const t = useTranslations("project");
  const tc = useTranslations("common");
  const { data: session } = useSession();

  const { projects, loading, fetchProjects } = useProjectStore();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [createOpen, setCreateOpen] = useState(false);

  const token = (session as { accessToken?: string } | null)?.accessToken;
  const userRole = (session?.user as { role?: string } | undefined)?.role;

  const refresh = useCallback(() => {
    if (!token) return;
    fetchProjects(token, {
      status: statusFilter || undefined,
      search: search || undefined,
    });
  }, [fetchProjects, token, statusFilter, search]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString();
  };

  return (
    <div className="container mx-auto py-6 px-4 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">{t("titlePlural")}</h1>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="size-4 mr-1" />
          {t("newProject")}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4 flex-wrap items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder={tc("search") + "..."}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(val) =>
            setStatusFilter(val === "__all__" ? "" : (val ?? ""))
          }
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder={t("allStatuses")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">{t("allStatuses")}</SelectItem>
            {statuses.map((s) => (
              <SelectItem key={s} value={s}>
                {t(
                  `status${s.charAt(0).toUpperCase() + s.slice(1)}` as
                    | "statusDraft"
                    | "statusStudy"
                    | "statusQuote"
                    | "statusSigned"
                    | "statusInstalled"
                )}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex border rounded-md">
          <Button
            variant={viewMode === "list" ? "secondary" : "ghost"}
            size="icon"
            onClick={() => setViewMode("list")}
          >
            <List className="size-4" />
          </Button>
          <Button
            variant={viewMode === "grid" ? "secondary" : "ghost"}
            size="icon"
            onClick={() => setViewMode("grid")}
          >
            <LayoutGrid className="size-4" />
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">
          {tc("loading")}
        </div>
      ) : projects.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          {t("noProjects")}
        </div>
      ) : viewMode === "list" ? (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("name")}</TableHead>
                <TableHead>{t("address")}</TableHead>
                <TableHead>{t("status")}</TableHead>
                {(userRole === "installer" || userRole === "admin") && (
                  <TableHead>{t("client")}</TableHead>
                )}
                <TableHead className="text-right">{t("panels")}</TableHead>
                <TableHead>{t("createdAt")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projects.map((project) => (
                <TableRow key={project.id}>
                  <TableCell>
                    <Link
                      href={`/projects/${project.id}`}
                      className="font-medium hover:underline"
                    >
                      {project.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {project.address || "—"}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={project.status} />
                  </TableCell>
                  {(userRole === "installer" || userRole === "admin") && (
                    <TableCell className="text-muted-foreground">
                      {project.client_name || "—"}
                    </TableCell>
                  )}
                  <TableCell className="text-right">
                    {project.panel_count || 0}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(project.created_at)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <Link key={project.id} href={`/projects/${project.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-semibold truncate">{project.name}</h3>
                    <StatusBadge status={project.status} />
                  </div>
                  <p className="text-sm text-muted-foreground mb-1">
                    {project.address || "—"}
                  </p>
                  {project.client_name && (
                    <p className="text-sm text-muted-foreground">
                      {t("client")}: {project.client_name}
                    </p>
                  )}
                  <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
                    <span>
                      {project.panel_count || 0} {t("panels")}
                    </span>
                    <span>{formatDate(project.created_at)}</span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <CreateProjectDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={refresh}
      />
    </div>
  );
}
