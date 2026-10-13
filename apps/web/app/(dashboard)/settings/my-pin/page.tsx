"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/api-error";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function MyPinPage() {
  const [hasPin, setHasPin] = useState<boolean | null>(null);
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [saving, setSaving] = useState(false);

  function load() {
    api
      .get<{ has_pin: boolean }>("/auth/pin-status")
      .then((r) => setHasPin(r.data.has_pin))
      .catch(() => setHasPin(null));
  }

  useEffect(() => {
    load();
  }, []);

  async function savePin() {
    if (!/^\d{4,6}$/.test(pin)) {
      toast.error("PIN 4-6 xonali raqam bo'lishi kerak");
      return;
    }
    if (pin !== pin2) {
      toast.error("PIN kodlar mos kelmadi");
      return;
    }
    setSaving(true);
    try {
      await api.post("/auth/set-pin", { pin });
      toast.success("PIN o'rnatildi");
      setPin("");
      setPin2("");
      load();
    } catch (e) {
      toast.error(getErrorMessage(e, "Xato"));
    } finally {
      setSaving(false);
    }
  }

  async function clearPin() {
    setSaving(true);
    try {
      await api.delete("/auth/pin");
      toast.success("PIN o'chirildi");
      load();
    } catch (e) {
      toast.error(getErrorMessage(e, "Xato"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Mening PIN kodim"
        description="Tezkor kirish uchun — kassir almashinganda to'liq parol o'rniga 4-6 xonali PIN bilan kirish mumkin"
      />
      <Card className="max-w-md">
        <CardBody className="space-y-3">
          <div className="text-sm text-ink-600 dark:text-ink-300">
            Holat:{" "}
            {hasPin === null ? "—" : hasPin ? (
              <span className="text-success-600 dark:text-success-500 font-medium">o'rnatilgan</span>
            ) : (
              <span className="text-ink-400">o'rnatilmagan</span>
            )}
          </div>
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            placeholder="Yangi PIN (4-6 raqam)"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
            className="w-full border border-ink-300 dark:border-ink-600 bg-white dark:bg-ink-800 text-ink-900 dark:text-ink-100 rounded-md px-3 py-2 text-center text-lg tracking-widest font-mono"
          />
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            placeholder="PIN'ni takrorlang"
            value={pin2}
            onChange={(e) => setPin2(e.target.value.replace(/\D/g, "").slice(0, 6))}
            className="w-full border border-ink-300 dark:border-ink-600 bg-white dark:bg-ink-800 text-ink-900 dark:text-ink-100 rounded-md px-3 py-2 text-center text-lg tracking-widest font-mono"
          />
        </CardBody>
        <CardFooter className="flex justify-end gap-2">
          {hasPin && (
            <Button type="button" variant="outline" onClick={clearPin} loading={saving}>
              PIN'ni o'chirish
            </Button>
          )}
          <Button type="button" onClick={savePin} loading={saving}>
            Saqlash
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
