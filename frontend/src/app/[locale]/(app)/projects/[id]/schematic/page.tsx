"use client";

import { useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import { useEffect } from "react";
import { use } from "react";
import dynamic from "next/dynamic";
import { ArrowLeft } from "lucide-react";

import { useProjectStore } from "@/store/project";
import { Link } from "@/i18n/routing";

const SchematicEditor = dynamic(
  () => import("@/components/schematic/SchematicEditor"),
  { ssr: false }
);

export default function SchematicPage({
  params,
}: {
  params: Promise<{ id: string; locale: string }>;
}) {
  const { id } = use(params);
  const t = useTranslations("schematic");
  const tc = useTranslations("common");
  const { data: session } = useSession();

  const { currentProject, fetchProject } = useProjectStore();

  const token = (session as { accessToken?: string } | null)?.accessToken;

  useEffect(() => {
    if (token && id) {
      fetchProject(id, token);
    }
  }, [token, id, fetchProject]);

  if (!currentProject) {
    return (
      <div className="container mx-auto py-12 text-center text-muted-foreground">
        {tc("loading")}
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col">
      <div className="border-b bg-white px-4 py-3">
        <Link
          href={`/projects/${id}`}
          className="mb-1 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          {tc("back")}
        </Link>
        <h1 className="text-lg font-bold">
          {currentProject.name} — {t("title")}
        </h1>
      </div>

      <div className="flex-1">
        {token ? (
          <SchematicEditor projectId={id} token={token} />
        ) : (
          <div className="py-12 text-center text-muted-foreground">
            {tc("loading")}
          </div>
        )}
      </div>
    </div>
  );
}
