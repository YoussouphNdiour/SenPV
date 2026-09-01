"use client";

import { useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { use } from "react";
import dynamic from "next/dynamic";
import {
  ArrowLeft,
  MapPin,
  LayoutPanelTop,
  Box,
  Activity,
  GitBranch,
  FileText,
  ClipboardList,
  Eye,
  Pencil,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/layout/StatusBadge";
import { MapView } from "@/components/map/MapView";
import { PanelsTab } from "@/components/panels/PanelsTab";
import { SimulationTab } from "@/components/simulation/SimulationTab";
import { QuoteTab } from "@/components/quote/QuoteTab";
import { ReportTab } from "@/components/report/ReportTab";
import { useProjectStore } from "@/store/project";
import { useMapStore } from "@/store/map";
import { usePanelStore } from "@/store/panels";
import { useEquipmentStore } from "@/store/equipment";
import { Link, useRouter } from "@/i18n/routing";
import type { ProjectStatus } from "@/types/project";

const RoofScene = dynamic(
  () =>
    import("@/components/viewer3d/RoofScene").then((mod) => mod.RoofScene),
  { ssr: false }
);

const SchematicEditor = dynamic(
  () => import("@/components/schematic/SchematicEditor"),
  { ssr: false }
);

const allStatuses: ProjectStatus[] = [
  "draft",
  "study",
  "quote",
  "signed",
  "installed",
];

export default function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string; locale: string }>;
}) {
  const { id } = use(params);
  const t = useTranslations("project");
  const tc = useTranslations("common");
  const { data: session } = useSession();
  const router = useRouter();

  const { currentProject, loading, fetchProject, updateStatus, deleteProject } =
    useProjectStore();
  const { zones, fetchZones } = useMapStore();
  const { layouts, fetchLayouts } = usePanelStore();
  const { panels: equipmentList, inverters, fetchPanels, fetchInverters } =
    useEquipmentStore();

  const token = (session as { accessToken?: string } | null)?.accessToken;
  const userRole = (session?.user as { role?: string } | undefined)?.role;
  const isInstaller = userRole === "installer" || userRole === "admin";

  useEffect(() => {
    if (token && id) {
      fetchProject(id, token);
      fetchZones(id, token);
      fetchLayouts(id, token);
      fetchPanels(token);
      fetchInverters(token);
    }
  }, [token, id, fetchProject, fetchZones, fetchLayouts, fetchPanels, fetchInverters]);

  const handleStatusChange = async (newStatus: string) => {
    if (!token || !currentProject) return;
    await updateStatus(currentProject.id, newStatus as ProjectStatus, token);
  };

  const handleDelete = async () => {
    if (!token || !currentProject) return;
    if (!confirm(t("deleteConfirm"))) return;
    await deleteProject(currentProject.id, token);
    router.push("/projects");
  };

  if (loading || !currentProject) {
    return (
      <div className="container mx-auto py-12 text-center text-muted-foreground">
        {tc("loading")}
      </div>
    );
  }

  const project = currentProject;

  return (
    <div className="container mx-auto py-6 px-4 max-w-6xl">
      {/* Back + Header */}
      <div className="mb-6">
        <Link
          href="/projects"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3"
        >
          <ArrowLeft className="size-4" />
          {tc("back")}
        </Link>

        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">{project.name}</h1>
            {project.address && (
              <p className="text-muted-foreground mt-1">{project.address}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Select
              value={project.status}
              onValueChange={handleStatusChange}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue>
                  <StatusBadge status={project.status} />
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {allStatuses.map((s) => (
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
            <Button
              variant="outline"
              size="icon"
              onClick={handleDelete}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="overview" className="gap-1">
            <Eye className="size-4" />
            {t("tabs.overview")}
          </TabsTrigger>
          <TabsTrigger value="map" className="gap-1">
            <MapPin className="size-4" />
            {t("tabs.map")}
          </TabsTrigger>
          <TabsTrigger value="panels" className="gap-1">
            <LayoutPanelTop className="size-4" />
            {t("tabs.panels")}
          </TabsTrigger>
          <TabsTrigger value="3d" className="gap-1">
            <Box className="size-4" />
            {t("tabs.3d")}
          </TabsTrigger>
          <TabsTrigger value="simulation" className="gap-1">
            <Activity className="size-4" />
            {t("tabs.simulation")}
          </TabsTrigger>
          <TabsTrigger value="schematic" className="gap-1">
            <GitBranch className="size-4" />
            {t("tabs.schematic")}
          </TabsTrigger>
          {isInstaller && (
            <TabsTrigger value="quote" className="gap-1">
              <ClipboardList className="size-4" />
              {t("tabs.quote")}
            </TabsTrigger>
          )}
          <TabsTrigger value="report" className="gap-1">
            <FileText className="size-4" />
            {t("tabs.report")}
          </TabsTrigger>
        </TabsList>

        {/* Overview tab */}
        <TabsContent value="overview" className="mt-6">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t("title")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("name")}</span>
                  <span className="font-medium">{project.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("address")}</span>
                  <span>{project.address || "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("status")}</span>
                  <StatusBadge status={project.status} />
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {t("latitude")}
                  </span>
                  <span>{project.lat}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {t("longitude")}
                  </span>
                  <span>{project.lon}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {t("createdAt")}
                  </span>
                  <span>
                    {new Date(project.created_at).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {t("updatedAt")}
                  </span>
                  <span>
                    {new Date(project.updated_at).toLocaleDateString()}
                  </span>
                </div>
              </CardContent>
            </Card>

            {project.client_name && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{t("client")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="font-medium">{project.client_name}</p>
                </CardContent>
              </Card>
            )}

            {project.notes && (
              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle className="text-base">{t("notes")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm whitespace-pre-wrap">{project.notes}</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Map & Roof tab */}
        <TabsContent value="map" className="mt-6">
          <MapView
            projectId={project.id}
            lat={project.lat}
            lon={project.lon}
          />
        </TabsContent>

        <TabsContent value="panels" className="mt-6">
          {token ? (
            <PanelsTab projectId={project.id} token={token} />
          ) : (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                {tc("loading")}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="3d" className="mt-6">
          <RoofScene
            zones={zones}
            layouts={layouts}
            equipment={[...equipmentList, ...inverters]}
          />
        </TabsContent>

        <TabsContent value="simulation" className="mt-6">
          {token ? (
            <SimulationTab projectId={project.id} token={token} />
          ) : (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                {tc("loading")}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="schematic" className="mt-6">
          {token ? (
            <div className="h-[700px] overflow-hidden rounded-lg border">
              <SchematicEditor projectId={project.id} token={token} />
            </div>
          ) : (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                {tc("loading")}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {isInstaller && (
          <TabsContent value="quote" className="mt-6">
            {token ? (
              <QuoteTab projectId={project.id} token={token} />
            ) : (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  {tc("loading")}
                </CardContent>
              </Card>
            )}
          </TabsContent>
        )}

        <TabsContent value="report" className="mt-6">
          {token ? (
            <ReportTab projectId={project.id} token={token} />
          ) : (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                {tc("loading")}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
