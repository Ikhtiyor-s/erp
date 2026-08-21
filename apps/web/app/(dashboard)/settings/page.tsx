"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Building, Save } from "lucide-react";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/api-error";
import { PageHeader } from "@/components/ui/page-header";
import { Field, input } from "@/components/ui/modal";
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
      toast.success(t("ui__������������������_54a59b19"));
    } catch (e: any) {
      toast.error(getErrorMessage(e, "Xato"));
    } finally { setSaving(false); }
  }

  if (loading) return <div className="text-center py-20 text-slate-400">{t("ui__����������������_43e40d49")}</div>;

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader title={t("ui__����������������������_5e591067")} description={t("ui__������������������_����������_����������������_48db49b8")} />

      <div className="bg-white dark:bg-slate-800 border rounded-lg shadow-sm p-6 space-y-4">
        <div className="flex items-center gap-3 pb-4 border-b">
          <div className="p-2 bg-brand-100 text-brand-700 rounded-md">
            <Building size={24} />
          </div>
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400 uppercase">{t("ui__������_����������������������_c7401ce9")}</div>
            <div className="font-mono font-semibold">{code}</div>
          </div>
        </div>

        <Field label={t("ui__����������������_602680ed")} required>
          <input className={input} value={form.name || ""}
            onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("ui__������_5b0ec543")}>
            <input className={input} value={form.tin || ""}
              onChange={(e) => setForm({ ...form, tin: e.target.value })} />
          </Field>
          <Field label={t("ui__��������������_2928e19c")}>
            <input className={input} value={form.phone || ""}
              onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </Field>
        </div>
        <Field label={t("ui__����������_80148fa5")}>
          <input className={input} value={form.address || ""}
            onChange={(e) => setForm({ ...form, address: e.target.value })} />
        </Field>
        <Field label={t("ui__url_����������������_de744f6c")}>
          <input className={input} placeholder="https://..." value={form.logo_url || ""}
            onChange={(e) => setForm({ ...form, logo_url: e.target.value })} />
        </Field>

        <div className="flex justify-end pt-2 border-t">
          <button onClick={save} disabled={saving}
            className="inline-flex items-center gap-1.5 px-5 py-2 text-sm rounded-md bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50">
            <Save size={14} /> {saving ? "Saqlanmoqda..." : "Saqlash"}
          </button>
        </div>
      </div>
    </div>
  );
}
