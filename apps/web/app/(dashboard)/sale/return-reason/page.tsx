"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/api-error";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Modal, Field, input } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
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

const typeBadge = (t: string) =>
  t === "valid"
    ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-300 dark:border-green-700"
    : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-300 dark:border-red-700";
const typeLabel = (t: string) =>
  t === "valid" ? "Haqiqiy" : "Haqiqiy emas";

export default function ReturnReasonPage() {
  const t = useTranslations("ui");
  const [rows, setRows] = useState<Reason[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState("");
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);

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
  async function del(r: Reason) {
    if (!confirm(`��${r.name}�� nofaol qilinsinmi?`)) return;
    await api.delete(`/sale/return-reasons/${r.id}`);
    toast.success(t("ui__деактивировано_bf64c95d"));
    load();
  }

  const cols: Column<Reason>[] = [
    { key: "name", header: t("ui__название_602680ed") },
    {
      key: "code",
      header: t("ui__код_3f34a617"),
      width: "120px",
      render: (r) =>
        r.code ? (
          <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded">
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
        <span
          className={`inline-block px-2 py-0.5 rounded border text-xs font-semibold ${typeBadge(
            r.return_type
          )}`}
        >
          {typeLabel(r.return_type)}
        </span>
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
      render: (r) =>
        r.is_active ? (
          <span className="text-green-600 text-xs">{t("ui__активный_782343ea")}</span>
        ) : (
          <span className="text-slate-400 text-xs">{t("ui__не_активен_8e4c9b49")}</span>
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
        <label className="text-sm text-slate-600 dark:text-slate-300">{t("ui__тип_возврата_a16cb638")}</label>
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
        onDelete={del}
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
            <button
              onClick={() => setOpen(false)}
              className="px-4 py-2 text-sm rounded-md border hover:bg-slate-50 dark:bg-slate-900/40"
            >
              {t("ui__отмена_987b33c6")}
            </button>
            <button
              onClick={save}
              className="px-4 py-2 text-sm rounded-md bg-brand-600 text-white hover:bg-brand-700"
            >
              {t("ui__сохранить_74ea58b6")}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
