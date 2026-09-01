"use client";

import { useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import { useEffect } from "react";
import { use } from "react";
import dynamic from "next/dynamic";
import { ArrowLeft } from "lucide-react";

import { useProjectStore } from "@/store/project";
import { useMapStore } from "@/store/map";
import { usePanelStore } from "@/store/panels";
import { useEquipmentStore } from "@/store/equipment";
import { Link } from "@/i18n/routing";

const RoofScene = dynamic(
  () =>
    import("@/components/viewer3d/RoofScene").then((mod) => mod.RoofScene),
  { ssr: false }
);

export default function Viewer3DPage({
  params,
}: {
  params: Promise<{ id: string; locale: string }>;
}) {
  const { id } = use(params);
  const t = useTranslations("viewer3d");
  const tc = useTranslations("common");
  const { data: session } = useSession();

  const { currentProject, fetchProject } = useProjectStore();
  const { zones, fetchZones } = useMapStore();
  const { layouts, fetchLayouts } = usePanelStore();
  const { panels: equipmentList, inverters, fetchPanels, fetchInverters } =
    useEquipmentStore();

  const token = (session as { accessToken?: string } | null)?.accessToken;

  useEffect(() => {
    if (token && id) {
      fetchProject(id, token);
      fetchZones(id, token);
      fetchLayouts(id, token);
      fetchPanels(token);
      fetchInverters(token);
    }
  }, [token, id, fetchProject, fetchZones, fetchLayouts, fetchPanels, fetchInverters]);

  if (!currentProject) {
    return (
      <div className="container mx-auto py-12 text-center text-muted-foreground">
        {tc("loading")}
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 px-4 max-w-6xl">
      <div className="mb-4">
        <Link
          href={`/projects/${id}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-2"
        >
          <ArrowLeft className="size-4" />
          {tc("back")}
        </Link>
        <h1 className="text-xl font-bold">
          {currentProject.name} — {t("title")}
        </h1>
      </div>

      <RoofScene
        zones={zones}
        layouts={layouts}
        equipment={[...equipmentList, ...inverters]}
      />
    </div>
  );
}
