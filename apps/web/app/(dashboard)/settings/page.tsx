"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Building, Save } from "lucide-react";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/api-error";
import { PageHeader } from "@/components/ui/page-header";
import { Field, input } from "@/components/ui/modal";
import { Card, CardBody, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";

type Org = { id: string; name: string; code: string; tin?: string; address?: string; phone?: string; logo_url?: string };

export default function SettingsOrgPage() {
  const t = useTranslations("ui");
  const [form, setForm] = useState<Partial<Org>>({});
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get<Org>("/settings/organization").then((r) => {
      setForm(r.data); setCode(r.data?.code || "");
    }).finally(() => setLoading(false));
  }, []);

  async function save() {
    setSaving(true);
    try {
      await api.put("/settings/organization", {
        name: form.name, tin: form.tin || null,
        address: form.address || null, phone: form.phone || null,
        logo_url: form.logo_url || null,
      });
      toast.success(t("ui__сохранено_54a59b19"));
    } catch (e: any) {
      toast.error(getErrorMessage(e, "Xato"));
    } finally { setSaving(false); }
  }

  if (loading) return <div className="text-center py-20 text-ink-400">{t("ui__загрузка_43e40d49")}</div>;

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader title={t("ui__организация_5e591067")} description={t("ui__реквизиты_вашей_компании_48db49b8")} />

      <Card padding="none">
        <CardBody className="space-y-4">
          <div className="flex items-center gap-3 pb-4 border-b border-ink-200/60 dark:border-ink-800/60">
            <div className="p-2 bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-400 rounded-md">
              <Building size={24} />
            </div>
            <div>
              <div className="text-xs text-ink-500 dark:text-ink-400 uppercase">{t("ui__код_организации_c7401ce9")}</div>
              <div className="font-mono font-semibold text-ink-900 dark:text-ink-100">{code}</div>
            </div>
          </div>

          <Field label={t("ui__название_602680ed")} required>
            <input className={input} value={form.name || ""}
              onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("ui__инн_5b0ec543")}>
              <input className={input} value={form.tin || ""}
                onChange={(e) => setForm({ ...form, tin: e.target.value })} />
            </Field>
            <Field label={t("ui__телефон_2928e19c")}>
              <input className={input} value={form.phone || ""}
                onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </Field>
          </div>
          <Field label={t("ui__адрес_80148fa5")}>
            <input className={input} value={form.address || ""}
              onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </Field>
          <Field label={t("ui__url_логотипа_de744f6c")}>
            <input className={input} placeholder="https://..." value={form.logo_url || ""}
              onChange={(e) => setForm({ ...form, logo_url: e.target.value })} />
          </Field>
        </CardBody>

        <CardFooter className="flex justify-end">
          <Button onClick={save} loading={saving} icon={Save}>
            {saving ? "Saqlanmoqda..." : "Saqlash"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
