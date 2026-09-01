"use client";

import { useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useProjectStore } from "@/store/project";
import { useClientStore } from "@/store/client";
import { useRouter } from "@/i18n/routing";

// Default coordinates: Dakar
const DEFAULT_LAT = 14.6928;
const DEFAULT_LNG = -17.4467;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
}

export function CreateProjectDialog({ open, onOpenChange, onCreated }: Props) {
  const t = useTranslations("project");
  const tc = useTranslations("common");
  const { data: session } = useSession();
  const router = useRouter();

  const { createProject } = useProjectStore();
  const { clients, fetchClients } = useClientStore();

  const token = (session as { accessToken?: string } | null)?.accessToken;
  const userRole = (session?.user as { role?: string } | undefined)?.role;
  const isInstaller = userRole === "installer" || userRole === "admin";

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [lat, setLat] = useState(DEFAULT_LAT);
  const [lng, setLng] = useState(DEFAULT_LNG);
  const [clientId, setClientId] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);

  // Fetch clients for installer
  useEffect(() => {
    if (open && isInstaller && token) {
      fetchClients(token);
    }
  }, [open, isInstaller, token, fetchClients]);

  // Initialize map
  const initMap = useCallback(async () => {
    if (!mapContainerRef.current || mapRef.current) return;

    const maplibregl = (await import("maplibre-gl")).default;
    await import("maplibre-gl/dist/maplibre-gl.css");

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: `https://api.maptiler.com/maps/streets/style.json?key=get_your_own_OpIi9ZULNHzrESv6T2vL`,
      center: [lng, lat],
      zoom: 12,
    });

    const marker = new maplibregl.Marker({ draggable: true })
      .setLngLat([lng, lat])
      .addTo(map);

    marker.on("dragend", () => {
      const pos = marker.getLngLat();
      setLat(Math.round(pos.lat * 10000) / 10000);
      setLng(Math.round(pos.lng * 10000) / 10000);
    });

    map.on("click", (e) => {
      marker.setLngLat(e.lngLat);
      setLat(Math.round(e.lngLat.lat * 10000) / 10000);
      setLng(Math.round(e.lngLat.lng * 10000) / 10000);
    });

    mapRef.current = map;
    markerRef.current = marker;
  }, [lat, lng]);

  useEffect(() => {
    if (open) {
      // Small delay to let dialog render
      const timeout = setTimeout(initMap, 100);
      return () => clearTimeout(timeout);
    } else {
      // Cleanup map on close
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerRef.current = null;
      }
    }
  }, [open, initMap]);

  const handleSubmit = async () => {
    if (!name.trim() || !token) return;
    setSubmitting(true);
    try {
      const project = await createProject(
        {
          name: name.trim(),
          address: address.trim() || undefined,
          lat,
          lon: lng,
          client_id: clientId || undefined,
          notes: notes.trim() || undefined,
        },
        token
      );
      onOpenChange(false);
      resetForm();
      onCreated?.();
      router.push(`/projects/${project.id}`);
    } catch {
      // Error handled by store
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setName("");
    setAddress("");
    setLat(DEFAULT_LAT);
    setLng(DEFAULT_LNG);
    setClientId("");
    setNotes("");
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) resetForm();
        onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("createProject")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="project-name">{t("name")} *</Label>
            <Input
              id="project-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("name")}
            />
          </div>

          {/* Address */}
          <div className="space-y-2">
            <Label htmlFor="project-address">{t("address")}</Label>
            <Input
              id="project-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder={t("address")}
            />
          </div>

          {/* Map */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1">
              <MapPin className="size-4" />
              {t("clickMap")}
            </Label>
            <div
              ref={mapContainerRef}
              className="w-full h-[250px] rounded-md border"
            />
            <div className="flex gap-4 text-sm text-muted-foreground">
              <span>
                {t("latitude")}: {lat}
              </span>
              <span>
                {t("longitude")}: {lng}
              </span>
            </div>
          </div>

          {/* Client (installer only) */}
          {isInstaller && (
            <div className="space-y-2">
              <Label>{t("client")}</Label>
              <Select
                value={clientId}
                onValueChange={(val) =>
                  setClientId(val === "__none__" ? "" : val)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("selectClient")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">{t("noClient")}</SelectItem>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="project-notes">{t("notes")}</Label>
            <textarea
              id="project-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t("notes")}
              className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {tc("cancel")}
          </Button>
          <Button onClick={handleSubmit} disabled={!name.trim() || submitting}>
            {submitting ? tc("loading") : t("createProject")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
