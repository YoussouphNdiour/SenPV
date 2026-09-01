"use client";

import { useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";
import { Plus, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useClientStore } from "@/store/client";
import { ClientFormDialog } from "@/components/project/ClientFormDialog";
import { Link } from "@/i18n/routing";
import type { Client, CreateClient } from "@/types/client";

export default function ClientsPage() {
  const t = useTranslations("client");
  const tc = useTranslations("common");
  const { data: session } = useSession();

  const { clients, loading, fetchClients, createClient, updateClient, deleteClient } =
    useClientStore();

  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | undefined>();

  const token = (session as { accessToken?: string } | null)?.accessToken;

  const refresh = useCallback(() => {
    if (!token) return;
    fetchClients(token, { search: search || undefined });
  }, [fetchClients, token, search]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleSave = async (data: CreateClient) => {
    if (!token) return;
    if (editingClient) {
      await updateClient(editingClient.id, data, token);
    } else {
      await createClient(data, token);
    }
    setEditingClient(undefined);
    refresh();
  };

  const handleEdit = (client: Client) => {
    setEditingClient(client);
    setFormOpen(true);
  };

  const handleDelete = async (client: Client) => {
    if (!token) return;
    if (!confirm(t("deleteConfirm"))) return;
    await deleteClient(client.id, token);
    refresh();
  };

  return (
    <div className="container mx-auto py-6 px-4 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <Button
          onClick={() => {
            setEditingClient(undefined);
            setFormOpen(true);
          }}
        >
          <Plus className="size-4 mr-1" />
          {t("addClient")}
        </Button>
      </div>

      {/* Search */}
      <div className="mb-4">
        <div className="relative max-w-md">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder={tc("search") + "..."}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">
          {tc("loading")}
        </div>
      ) : clients.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          {t("noClients")}
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("name")}</TableHead>
                <TableHead>{t("phone")}</TableHead>
                <TableHead>{t("email")}</TableHead>
                <TableHead className="text-right">{t("monthlyKwh")}</TableHead>
                <TableHead className="text-right">{t("projectCount")}</TableHead>
                <TableHead className="text-right">{tc("actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.map((client) => (
                <TableRow key={client.id}>
                  <TableCell className="font-medium">{client.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {client.phone || "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {client.email || "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    {client.monthly_kwh ?? "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Link
                      href={`/projects?client=${client.id}`}
                      className="hover:underline"
                    >
                      {client.project_count ?? 0}
                    </Link>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(client)}
                      >
                        {tc("edit")}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDelete(client)}
                      >
                        {tc("delete")}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <ClientFormDialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditingClient(undefined);
        }}
        onSave={handleSave}
        initial={editingClient}
      />
    </div>
  );
}
