"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

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
import type { Client, CreateClient } from "@/types/client";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: CreateClient) => Promise<void>;
  initial?: Client;
}

export function ClientFormDialog({ open, onOpenChange, onSave, initial }: Props) {
  const t = useTranslations("client");
  const tc = useTranslations("common");

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [monthlyKwh, setMonthlyKwh] = useState("");
  const [senelecTariff, setSenelecTariff] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (initial) {
      setName(initial.name);
      setAddress(initial.address || "");
      setPhone(initial.phone || "");
      setEmail(initial.email || "");
      setMonthlyKwh(initial.monthly_kwh?.toString() || "");
      setSenelecTariff(initial.senelec_tariff_tier || "");
      setNotes(initial.notes || "");
    } else {
      resetForm();
    }
  }, [initial, open]);

  const resetForm = () => {
    setName("");
    setAddress("");
    setPhone("");
    setEmail("");
    setMonthlyKwh("");
    setSenelecTariff("");
    setNotes("");
  };

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      await onSave({
        name: name.trim(),
        address: address.trim() || undefined,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        monthly_kwh: monthlyKwh ? parseFloat(monthlyKwh) : undefined,
        senelec_tariff_tier: senelecTariff.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      onOpenChange(false);
      resetForm();
    } catch {
      // Error handled by caller
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) resetForm();
        onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {initial ? t("editClient") : t("addClient")}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="client-name">{t("name")} *</Label>
            <Input
              id="client-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="client-address">{t("address")}</Label>
            <Input
              id="client-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="client-phone">{t("phone")}</Label>
              <Input
                id="client-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="client-email">{t("email")}</Label>
              <Input
                id="client-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="client-kwh">{t("monthlyKwh")}</Label>
              <Input
                id="client-kwh"
                type="number"
                value={monthlyKwh}
                onChange={(e) => setMonthlyKwh(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="client-tariff">{t("senelecTariff")}</Label>
              <Input
                id="client-tariff"
                value={senelecTariff}
                onChange={(e) => setSenelecTariff(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="client-notes">{t("notes")}</Label>
            <textarea
              id="client-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full min-h-[60px] rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {tc("cancel")}
          </Button>
          <Button onClick={handleSubmit} disabled={!name.trim() || submitting}>
            {submitting ? tc("loading") : tc("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
