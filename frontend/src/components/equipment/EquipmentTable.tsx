"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Equipment, PanelSpecs, InverterSpecs } from "@/types/equipment";

type SortField = "manufacturer" | "model" | "power";
type SortDir = "asc" | "desc";

interface EquipmentTableProps {
  items: Equipment[];
  type: "panel" | "inverter";
  currentUserId?: string;
  userRole?: string;
  onEdit: (item: Equipment) => void;
  onDelete: (item: Equipment) => void;
}

export function EquipmentTable({
  items,
  type,
  currentUserId,
  userRole,
  onEdit,
  onDelete,
}: EquipmentTableProps) {
  const t = useTranslations("equipment");
  const tc = useTranslations("common");
  const [sortField, setSortField] = useState<SortField>("manufacturer");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const sortedItems = [...items].sort((a, b) => {
    const dir = sortDir === "asc" ? 1 : -1;
    if (sortField === "power") {
      const aVal =
        type === "panel"
          ? (a.specs as PanelSpecs).pmax_w
          : (a.specs as InverterSpecs).rated_ac_power_kw;
      const bVal =
        type === "panel"
          ? (b.specs as PanelSpecs).pmax_w
          : (b.specs as InverterSpecs).rated_ac_power_kw;
      return (aVal - bVal) * dir;
    }
    return a[sortField].localeCompare(b[sortField]) * dir;
  });

  const canModify = (item: Equipment) => {
    if (userRole === "admin") return true;
    if (item.is_global) return false;
    return item.owner_id === currentUserId;
  };

  const sortIndicator = (field: SortField) => {
    if (sortField !== field) return "";
    return sortDir === "asc" ? " ↑" : " ↓";
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead
            className="cursor-pointer select-none"
            onClick={() => handleSort("manufacturer")}
          >
            {t("manufacturer")}
            {sortIndicator("manufacturer")}
          </TableHead>
          <TableHead
            className="cursor-pointer select-none"
            onClick={() => handleSort("model")}
          >
            {t("model")}
            {sortIndicator("model")}
          </TableHead>
          <TableHead
            className="cursor-pointer select-none"
            onClick={() => handleSort("power")}
          >
            {type === "panel" ? t("pmax") : t("ratedAcPower")}
            {sortIndicator("power")}
          </TableHead>
          <TableHead>
            {type === "panel" ? t("efficiency") : t("maxEfficiency")}
          </TableHead>
          <TableHead>{/* Global/Personal badge */}</TableHead>
          {(userRole === "installer" || userRole === "admin") && (
            <TableHead>{tc("actions")}</TableHead>
          )}
        </TableRow>
      </TableHeader>
      <TableBody>
        {sortedItems.length === 0 ? (
          <TableRow>
            <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
              {t("noEquipment")}
            </TableCell>
          </TableRow>
        ) : (
          sortedItems.map((item) => (
            <TableRow key={item.id}>
              <TableCell className="font-medium">{item.manufacturer}</TableCell>
              <TableCell>{item.model}</TableCell>
              <TableCell>
                {type === "panel"
                  ? `${(item.specs as PanelSpecs).pmax_w} W`
                  : `${(item.specs as InverterSpecs).rated_ac_power_kw} kW`}
              </TableCell>
              <TableCell>
                {type === "panel"
                  ? `${(item.specs as PanelSpecs).efficiency_pct}%`
                  : `${(item.specs as InverterSpecs).max_efficiency_pct}%`}
              </TableCell>
              <TableCell>
                <Badge variant={item.is_global ? "secondary" : "outline"}>
                  {item.is_global ? t("global") : t("personal")}
                </Badge>
              </TableCell>
              {(userRole === "installer" || userRole === "admin") && (
                <TableCell>
                  {canModify(item) && (
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => onEdit(item)}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => onDelete(item)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  )}
                </TableCell>
              )}
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}
