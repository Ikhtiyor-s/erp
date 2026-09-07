"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/api-error";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Modal, Field, input } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";

type Reason = {
  id: number;
  name: string;
  code?: string;
  return_type: "valid" | "invalid";
  description?: string;
  is_active: boolean;
  created_by_name?: string;
};

const typeLabel = (t: string) =>
  t === "valid" ? "Haqiqiy" : "Haqiqiy emas";

export default function ReturnReasonPage() {
  const t = useTranslations("ui");
  const [rows, setRows] = useState<Reason[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState("");
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<Reason | null>(null);
  const [deactivateLoading, setDeactivateLoading] = useState(false);

  const empty = {
    name: "",
    code: "",
    return_type: "valid",
    description: "",
  };
  const [form, setForm] = useState<any>(empty);

  async function load() {
    setLoading(true);
    try {
      const url = filterType
        ? `/sale/return-reasons?return_type=${filterType}&only_active=false`
        : "/sale/return-reasons?only_active=false";
      setRows((await api.get<Reason[]>(url)).data);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, [filterType]);

  async function save() {
    if (!form.name) {
      toast.error(t("ui__заполните_название_cb9fd103"));
      return;
    }
    try {
      const payload = {
        name: form.name,
        code: form.code || null,
        return_type: form.return_type,
        description: form.description || null,
      };
      if (editId) await api.put(`/sale/return-reasons/${editId}`, payload);
      else await api.post("/sale/return-reasons", payload);
      toast.success(t("ui__сохранено_54a59b19"));
      setOpen(false);
      setForm(empty);
      setEditId(null);
      load();
    } catch (e: any) {
      toast.error(getErrorMessage(e, "Xato"));
    }
  }
  async function handleDeactivate() {
    if (!deactivateTarget) return;
    setDeactivateLoading(true);
    try {
      await api.delete(`/sale/return-reasons/${deactivateTarget.id}`);
      toast.success(t("ui__деактивировано_bf64c95d"));
      setDeactivateTarget(null);
      load();
    } catch (e: any) {
      toast.error(getErrorMessage(e, "Xato"));
    } finally {
      setDeactivateLoading(false);
    }
  }

  const cols: Column<Reason>[] = [
    { key: "name", header: t("ui__название_602680ed") },
    {
      key: "code",
      header: t("ui__код_3f34a617"),
      width: "120px",
      render: (r) =>
        r.code ? (
          <code className="text-xs bg-ink-100 dark:bg-ink-800 px-1.5 py-0.5 rounded">
            {r.code}
          </code>
        ) : (
          "���"
        ),
    },
    {
      key: "created_by_name",
      header: t("ui__создано_кем_594548b1"),
      width: "180px",
      render: (r) => r.created_by_name || "���",
    },
    {
      key: "return_type",
      header: t("ui__тип_возврата_80dd2b37"),
      align: "center",
      width: "180px",
      render: (r) => (
        <Badge tone={r.return_type === "valid" ? "success" : "danger"}>
          {typeLabel(r.return_type)}
        </Badge>
      ),
    },
    {
      key: "description",
      header: t("ui__описание_38ca0af8"),
      render: (r) => r.description || "���",
    },
    {
      key: "is_active",
      header: t("ui__активность_010b2231"),
      align: "center",
      width: "120px",
      render: (r) => (
        <Badge tone={r.is_active ? "success" : "neutral"}>
          {r.is_active ? t("ui__активный_782343ea") : t("ui__не_активен_8e4c9b49")}
        </Badge>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("ui__причины_возврата_b9ece5e2")}
        description={t("ui__справочник_причин_возврата_с_т_277c7a1f")}
        onCreate={() => {
          setForm(empty);
          setEditId(null);
          setOpen(true);
        }}
      />

      <div className="flex items-center gap-3">
        <label className="text-sm text-ink-600 dark:text-ink-300">{t("ui__тип_возврата_a16cb638")}</label>
        <select
          className={`${input} max-w-xs`}
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
        >
          <option value="">{t("ui__все_a07b234e")}</option>
          <option value="valid">{t("ui__действительный_adb84d7c")}</option>
          <option value="invalid">{t("ui__недействительный_cb867986")}</option>
        </select>
      </div>

      <DataTable
        columns={cols}
        rows={rows}
        loading={loading}
        onEdit={(r) => {
          setForm({
            name: r.name,
            code: r.code || "",
            return_type: r.return_type || "valid",
            description: r.description || "",
          });
          setEditId(r.id);
          setOpen(true);
        }}
        onDelete={(r) => setDeactivateTarget(r)}
      />

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        size="md"
        title={editId ? "Sababni tahrirlash" : "Yangi qaytarish sababi"}
      >
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("ui__название_602680ed")} required>
              <input
                className={input}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </Field>
            <Field label={t("ui__код_3f34a617")}>
              <input
                className={input}
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
              />
            </Field>
          </div>
          <Field label={t("ui__тип_возврата_80dd2b37")} required>
            <select
              className={input}
              value={form.return_type}
              onChange={(e) =>
                setForm({ ...form, return_type: e.target.value })
              }
            >
              <option value="valid">{t("ui__действительный_adb84d7c")}</option>
              <option value="invalid">{t("ui__недействительный_cb867986")}</option>
            </select>
          </Field>
          <Field label={t("ui__описание_38ca0af8")}>
            <textarea
              className={input}
              rows={3}
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
            />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {t("ui__отмена_987b33c6")}
            </Button>
            <Button type="button" onClick={save}>
              {t("ui__сохранить_74ea58b6")}
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deactivateTarget}
        onClose={() => setDeactivateTarget(null)}
        onConfirm={handleDeactivate}
        title="Sababni nofaol qilish"
        message={`«${deactivateTarget?.name ?? ""}» nofaol qilinsinmi?`}
        confirmLabel="Nofaol qilish"
        cancelLabel={t("ui__отмена_987b33c6")}
        variant="warning"
        loading={deactivateLoading}
      />
    </div>
  );
}
