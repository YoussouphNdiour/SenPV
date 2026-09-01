"use client";

import { useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EquipmentTable } from "@/components/equipment/EquipmentTable";
import { PanelForm } from "@/components/equipment/PanelForm";
import { InverterForm } from "@/components/equipment/InverterForm";
import { useEquipmentStore } from "@/store/equipment";
import type { Equipment, PanelSpecs, InverterSpecs } from "@/types/equipment";

export default function EquipmentPage() {
  const t = useTranslations("equipment");
  const tc = useTranslations("common");
  const { data: session } = useSession();

  const {
    panels,
    inverters,
    loading,
    fetchPanels,
    fetchInverters,
    addEquipment,
    updateEquipment,
    deleteEquipment,
  } = useEquipmentStore();

  const [search, setSearch] = useState("");
  const [manufacturer, setManufacturer] = useState("");
  const [panelFormOpen, setPanelFormOpen] = useState(false);
  const [inverterFormOpen, setInverterFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Equipment | undefined>();
  const [activeTab, setActiveTab] = useState<string>("panels");

  const token = (session as { accessToken?: string } | null)?.accessToken;
  const userId = (session?.user as { id?: string } | undefined)?.id;
  const userRole = (session?.user as { role?: string } | undefined)?.role;

  const refresh = useCallback(() => {
    fetchPanels(token || undefined, search || undefined, manufacturer || undefined);
    fetchInverters(token || undefined, search || undefined, manufacturer || undefined);
  }, [fetchPanels, fetchInverters, token, search, manufacturer]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const manufacturers = useMemo(() => {
    const all = [...panels, ...inverters].map((e) => e.manufacturer);
    return [...new Set(all)].sort();
  }, [panels, inverters]);

  const handleSavePanel = async (data: {
    manufacturer: string;
    model: string;
    specs: PanelSpecs;
    is_global?: boolean;
  }) => {
    if (!token) return;
    if (editingItem) {
      await updateEquipment(
        editingItem.id,
        { manufacturer: data.manufacturer, model: data.model, specs: data.specs, is_global: data.is_global },
        token
      );
    } else {
      await addEquipment(
        { type: "panel", manufacturer: data.manufacturer, model: data.model, specs: data.specs, is_global: data.is_global },
        token
      );
    }
    setEditingItem(undefined);
    refresh();
  };

  const handleSaveInverter = async (data: {
    manufacturer: string;
    model: string;
    specs: InverterSpecs;
    is_global?: boolean;
  }) => {
    if (!token) return;
    if (editingItem) {
      await updateEquipment(
        editingItem.id,
        { manufacturer: data.manufacturer, model: data.model, specs: data.specs, is_global: data.is_global },
        token
      );
    } else {
      await addEquipment(
        { type: "inverter", manufacturer: data.manufacturer, model: data.model, specs: data.specs, is_global: data.is_global },
        token
      );
    }
    setEditingItem(undefined);
    refresh();
  };

  const handleEdit = (item: Equipment) => {
    setEditingItem(item);
    if (item.type === "panel") {
      setPanelFormOpen(true);
    } else {
      setInverterFormOpen(true);
    }
  };

  const handleDelete = async (item: Equipment) => {
    if (!token) return;
    if (!confirm(t("deleteConfirm"))) return;
    await deleteEquipment(item.id, token);
    refresh();
  };

  const canAdd = userRole === "installer" || userRole === "admin";

  return (
    <div className="container mx-auto py-6 px-4 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4 flex-wrap">
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
          value={manufacturer}
          onValueChange={(val) => setManufacturer(val === "__all__" ? "" : (val ?? ""))}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder={t("allManufacturers")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">{t("allManufacturers")}</SelectItem>
            {manufacturers.map((m) => (
              <SelectItem key={m} value={m}>
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="panels" value={activeTab} onValueChange={setActiveTab}>
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="panels">{t("panels")}</TabsTrigger>
            <TabsTrigger value="inverters">{t("inverters")}</TabsTrigger>
          </TabsList>
          {canAdd && (
            <Button
              size="sm"
              onClick={() => {
                setEditingItem(undefined);
                if (activeTab === "panels") {
                  setPanelFormOpen(true);
                } else {
                  setInverterFormOpen(true);
                }
              }}
            >
              <Plus className="size-4 mr-1" />
              {activeTab === "panels" ? t("addPanel") : t("addInverter")}
            </Button>
          )}
        </div>

        <div className="mt-4">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              {tc("loading")}
            </div>
          ) : (
            <>
              <TabsContent value="panels">
                <EquipmentTable
                  items={panels}
                  type="panel"
                  currentUserId={userId}
                  userRole={userRole}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              </TabsContent>
              <TabsContent value="inverters">
                <EquipmentTable
                  items={inverters}
                  type="inverter"
                  currentUserId={userId}
                  userRole={userRole}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              </TabsContent>
            </>
          )}
        </div>
      </Tabs>

      <PanelForm
        open={panelFormOpen}
        onOpenChange={(open) => {
          setPanelFormOpen(open);
          if (!open) setEditingItem(undefined);
        }}
        onSave={handleSavePanel}
        initial={editingItem?.type === "panel" ? editingItem : undefined}
        isAdmin={userRole === "admin"}
      />

      <InverterForm
        open={inverterFormOpen}
        onOpenChange={(open) => {
          setInverterFormOpen(open);
          if (!open) setEditingItem(undefined);
        }}
        onSave={handleSaveInverter}
        initial={editingItem?.type === "inverter" ? editingItem : undefined}
        isAdmin={userRole === "admin"}
      />
    </div>
  );
}
