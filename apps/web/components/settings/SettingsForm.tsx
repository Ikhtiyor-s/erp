"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/api-error";
import { PageHeader } from "@/components/ui/page-header";
import { Field, input } from "@/components/ui/modal";
import { Card, CardBody, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";

type FieldDef = {
  key: string;
  label: string;
  type?: "text" | "number" | "password" | "textarea" | "boolean" | "select";
  options?: { value: string; label: string }[];
  placeholder?: string;
  help?: string;
};

type Props = {
  title: string;
  description: string;
  settingsKey: string;
  fields: FieldDef[];
};

export function SettingsForm({ title, description, settingsKey, fields }: Props) {
  const t = useTranslations("ui");
  const [data, setData] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get(`/settings/key/${settingsKey}`)
      .then((r) => setData(r.data?.value || {}))
      .finally(() => setLoading(false));
  }, [settingsKey]);

  async function save() {
    setSaving(true);
    try {
      await api.put(`/settings/key/${settingsKey}`, { value: data });
      toast.success(t("ui__сохранено_54a59b19"));
    } catch (e: any) {
      toast.error(getErrorMessage(e, "Xato"));
    } finally { setSaving(false); }
  }

  if (loading) return <div className="text-center text-ink-400 py-10">{t("ui__загрузка_43e40d49")}</div>;

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader title={title} description={description} />

      <Card padding="none">
        <CardBody className="space-y-4">
          {fields.map((f) => (
            <Field key={f.key} label={f.label}>
              {f.type === "textarea" ? (
                <textarea className={input} rows={4} placeholder={f.placeholder}
                  value={data[f.key] || ""}
                  onChange={(e) => setData({ ...data, [f.key]: e.target.value })} />
              ) : f.type === "boolean" ? (
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={!!data[f.key]}
                    onChange={(e) => setData({ ...data, [f.key]: e.target.checked })} />
                  <span>{f.help || "Yoqish"}</span>
                </label>
              ) : f.type === "select" ? (
                <select className={input} value={data[f.key] || ""}
                  onChange={(e) => setData({ ...data, [f.key]: e.target.value })}>
                  <option value="">{t("ui__не_выбрано_19bcc8f4")}</option>
                  {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              ) : (
                <input
                  type={f.type || "text"}
                  className={input}
                  placeholder={f.placeholder}
                  value={data[f.key] ?? ""}
                  onChange={(e) => setData({ ...data, [f.key]: f.type === "number" ? Number(e.target.value) : e.target.value })}
                />
              )}
              {f.help && f.type !== "boolean" && (
                <p className="text-xs text-ink-500">{f.help}</p>
              )}
            </Field>
          ))}
        </CardBody>

        <CardFooter className="flex justify-end">
          <Button onClick={save} loading={saving}>
            {saving ? "Saqlanmoqda..." : "Saqlash"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
