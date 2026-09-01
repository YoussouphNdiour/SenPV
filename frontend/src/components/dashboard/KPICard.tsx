"use client";

import { Card, CardContent } from "@/components/ui/card";
import type { LucideIcon } from "lucide-react";

interface KPICardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  color?: "blue" | "amber" | "green" | "red" | "purple";
}

const colorMap = {
  blue: "text-blue-600 bg-blue-50",
  amber: "text-amber-600 bg-amber-50",
  green: "text-emerald-600 bg-emerald-50",
  red: "text-red-600 bg-red-50",
  purple: "text-purple-600 bg-purple-50",
};

export function KPICard({ icon: Icon, label, value, color = "blue" }: KPICardProps) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-6">
        <div className={`rounded-lg p-3 ${colorMap[color]}`}>
          <Icon className="size-6" />
        </div>
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground truncate">{label}</p>
          <p className="text-2xl font-bold tracking-tight">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
