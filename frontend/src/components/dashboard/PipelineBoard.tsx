"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/routing";
import { useProjectStore } from "@/store/project";
import type { PipelineData, PipelineProject } from "@/types/dashboard";
import type { ProjectStatus } from "@/types/project";

const columns: { key: ProjectStatus; color: string }[] = [
  { key: "draft", color: "bg-gray-100" },
  { key: "study", color: "bg-blue-100" },
  { key: "quote", color: "bg-amber-100" },
  { key: "signed", color: "bg-emerald-100" },
  { key: "installed", color: "bg-green-100" },
];

interface PipelineBoardProps {
  pipeline: PipelineData;
  onStatusChange?: () => void;
}

export function PipelineBoard({ pipeline, onStatusChange }: PipelineBoardProps) {
  const t = useTranslations("project");
  const { data: session } = useSession();
  const { updateStatus } = useProjectStore();
  const [draggedItem, setDraggedItem] = useState<PipelineProject | null>(null);

  const token = (session as { accessToken?: string } | null)?.accessToken;

  const handleDragStart = (
    e: React.DragEvent,
    project: PipelineProject
  ) => {
    setDraggedItem(project);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", project.id);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = async (e: React.DragEvent, targetStatus: ProjectStatus) => {
    e.preventDefault();
    if (!draggedItem || !token) return;
    if (draggedItem.status === targetStatus) return;

    try {
      await updateStatus(draggedItem.id, targetStatus, token);
      onStatusChange?.();
    } catch {
      // Error handled by store
    }
    setDraggedItem(null);
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
      {columns.map((col) => {
        const items = pipeline[col.key] || [];
        return (
          <div
            key={col.key}
            className="flex flex-col"
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, col.key)}
          >
            <div className={`rounded-t-lg px-3 py-2 ${col.color} flex items-center justify-between`}>
              <span className="text-sm font-medium">
                {t(`status${col.key.charAt(0).toUpperCase() + col.key.slice(1)}`)}
              </span>
              <Badge variant="secondary" className="text-xs">
                {items.length}
              </Badge>
            </div>
            <div className="flex-1 border border-t-0 rounded-b-lg p-2 space-y-2 min-h-[120px] bg-muted/30">
              {items.map((project) => (
                <Card
                  key={project.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, project)}
                  className="cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow"
                >
                  <CardContent className="p-3 space-y-1">
                    <Link
                      href={`/projects/${project.id}`}
                      className="text-sm font-medium hover:underline block truncate"
                    >
                      {project.name}
                    </Link>
                    {project.client_name && (
                      <p className="text-xs text-muted-foreground truncate">
                        {project.client_name}
                      </p>
                    )}
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {project.peak_power_kwc && (
                        <Badge variant="outline" className="text-xs">
                          {project.peak_power_kwc.toFixed(1)} kWc
                        </Badge>
                      )}
                      {project.quote_total_fcfa && (
                        <span>
                          {project.quote_total_fcfa.toLocaleString("fr-FR")} F
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
