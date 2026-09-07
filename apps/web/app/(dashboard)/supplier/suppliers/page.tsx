"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Search, Eye } from "lucide-react";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/api-error";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Modal, Field, input } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useTranslations } from "next-intl";

type Supplier = {
  id: string;
  code?: string;
  uuid_label: string;
  name: string;
  phone?: string;
  email?: string;
  tin?: string;
  address?: string;
  org_name?: string;
  balance?: string;
  created_at?: string;
};

const empty = { name: "", code: "", phone: "", email: "", tin: "", address: "" };
const fmt = (v: any) =>
  Number(v || 0).toLocaleString("ru-RU", { maximumFractionDigits: 2 });

export default function SupplierPage() {
  const t = useTranslations("ui");
  const router = useRouter();
  const [rows, setRows] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(empty);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Supplier | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const url = q
        ? `/supplier/suppliers?q=${encodeURIComponent(q)}`
        : "/supplier/suppliers";
      setRows((await api.get<Supplier[]>(url)).data);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function save() {
    try {
      if (editId) await api.put(`/supplier/suppliers/${editId}`, form);
      else await api.post("/supplier/suppliers", form);
      toast.success(t("ui__сохранено_54a59b19"));
      setOpen(false);
      load();
    } catch (e) {
      toast.error(getErrorMessage(e, "Xato"));
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/supplier/suppliers/${deleteTarget.id}`);
      toast.success(t("ui__удалено_0c450c40"));
      setDeleteTarget(null);
      load();
    } catch (e) {
      toast.error(getErrorMessage(e, "Xato"));
    } finally {
      setDeleting(false);
    }
  }

  const columns: Column<Supplier>[] = [
    {
      key: "code",
      header: t("ui__код_3f34a617"),
      width: "100px",
      render: (r) => r.code || "—",
    },
    {
      key: "uuid_label",
      header: t("ui__id_номер_e669322b"),
      width: "120px",
      render: (r) => (
        <code className="text-xs text-ink-600 dark:text-ink-400">
          {r.uuid_label}
        </code>
      ),
    },
    { key: "name", header: t("ui__название_602680ed") },
    {
      key: "phone",
      header: t("ui__телефон_2928e19c"),
      width: "150px",
      render: (r) => r.phone || "—",
    },
    {
      key: "tin",
      header: t("ui__инн_5b0ec543"),
      width: "130px",
      render: (r) => r.tin || "—",
    },
    {
      key: "email",
      header: "Email",
      width: "200px",
      render: (r) => r.email || "—",
    },
    {
      key: "balance",
      header: t("ui__баланс_95dcad97"),
      align: "right",
      width: "150px",
      render: (r) => {
        const v = Number(r.balance || 0);
        const cls =
          v > 0
            ? "text-danger-700 dark:text-danger-500"
            : v < 0
            ? "text-success-700 dark:text-success-500"
            : "text-ink-500 dark:text-ink-400";
        return <span className={`font-mono ${cls}`}>{fmt(v)}</span>;
      },
    },
    {
      key: "created_at",
      header: t("ui__создан_8be108de"),
      width: "140px",
      render: (r) =>
        r.created_at
          ? new Date(r.created_at).toLocaleDateString("ru-RU")
          : "—",
    },
    {
      key: "id" as any,
      header: "",
      align: "center",
      width: "50px",
      render: (r) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            router.push(`/supplier/suppliers/${r.id}`);
          }}
          className="text-brand-600 dark:text-brand-400 hover:text-brand-700"
          title={t("ui__профиль_a46c3723")}
          aria-label={`${r.name} profilini ko'rish`}
        >
          <Eye size={14} aria-hidden="true" />
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("ui__поставщики_60515512")}
        description={t("ui__база_поставщиков_06c98355")}
        onCreate={() => {
          setForm(empty);
          setEditId(null);
          setOpen(true);
        }}
      />

      <Card padding="md">
        <div className="flex gap-3 items-end">
          <div className="relative flex-1 max-w-md">
            <label className="text-xs text-ink-500 dark:text-ink-400 block mb-1">
              {t("ui__поиск_имя_телефон_код_инн_47148610")}
            </label>
            <Search
              size={14}
              className="absolute left-2.5 top-[34px] text-ink-400"
            />
            <input
              className={`${input} pl-8`}
              placeholder={t("ui__поиск_b84a8f87")}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && load()}
            />
          </div>
          <Button variant="primary" onClick={load}>
            {t("ui__фильтр_2f884b41")}
          </Button>
        </div>
      </Card>

      {/* Desktop table */}
      <div className="hidden md:block">
        <DataTable
          columns={columns}
          rows={rows}
          loading={loading}
          onEdit={(r) => {
            setForm({
              name: r.name,
              code: r.code || "",
              phone: r.phone || "",
              email: r.email || "",
              tin: r.tin || "",
              address: r.address || "",
            });
            setEditId(r.id);
            setOpen(true);
          }}
          onDelete={(r) => setDeleteTarget(r)}
        />
      </div>

      {/* Mobile cards */}
      <ul className="md:hidden space-y-3">
        {loading && <li className="text-center text-sm text-ink-400 py-8">{t("ui__загрузка_43e40d49")}</li>}
        {!loading && rows.length === 0 && <li className="text-center text-sm text-ink-400 py-8">{t("ui__нет_данных_dee9a2d8")}</li>}
        {rows.map((r) => (
          <li key={r.id} className="bg-white dark:bg-ink-900 rounded-lg border border-ink-200 dark:border-ink-800 p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-ink-900 dark:text-ink-100 truncate">{r.name}</p>
                {r.phone && <p className="text-sm text-ink-500 dark:text-ink-400">{r.phone}</p>}
                {r.tin && <p className="text-xs text-ink-400 dark:text-ink-500">{t("ui__инн_5b0ec543")}: {r.tin}</p>}
                <p className={`text-xs font-mono mt-0.5 ${Number(r.balance || 0) > 0 ? "text-danger-600 dark:text-danger-500" : Number(r.balance || 0) < 0 ? "text-success-600 dark:text-success-500" : "text-ink-400"}`}>
                  {t("ui__баланс_95dcad97")}: {fmt(r.balance)}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button
                  variant="outline"
                  size="xs"
                  aria-label="Tahrirlash"
                  onClick={() => {
                    setForm({ name: r.name, code: r.code || "", phone: r.phone || "", email: r.email || "", tin: r.tin || "", address: r.address || "" });
                    setEditId(r.id);
                    setOpen(true);
                  }}
                >
                  Tahrir
                </Button>
                <Button
                  variant="danger"
                  size="xs"
                  aria-label="O'chirish"
                  onClick={() => setDeleteTarget(r)}
                >
                  O&apos;chir
                </Button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editId ? "Yetkazib beruvchini tahrirlash" : "Yangi yetkazib beruvchi"}
        size="lg"
      >
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
          <Field label={t("ui__телефон_2928e19c")}>
            <input
              className={input}
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </Field>
          <Field label="Email">
            <input
              type="email"
              className={input}
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </Field>
          <Field label={t("ui__инн_5b0ec543")}>
            <input
              className={input}
              value={form.tin}
              onChange={(e) => setForm({ ...form, tin: e.target.value })}
            />
          </Field>
          <div className="col-span-2">
            <Field label={t("ui__адрес_80148fa5")}>
              <input
                className={input}
                value={form.address}
                onChange={(e) =>
                  setForm({ ...form, address: e.target.value })
                }
              />
            </Field>
          </div>
          <div className="col-span-2 flex justify-end gap-2 pt-2 border-t border-ink-200 dark:border-ink-800">
            <Button variant="outline" onClick={() => setOpen(false)}>
              {t("ui__отмена_987b33c6")}
            </Button>
            <Button variant="primary" onClick={save}>
              {t("ui__сохранить_74ea58b6")}
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="Yetkazib beruvchini o'chirish"
        message={deleteTarget ? `«${deleteTarget.name}» o'chirilsinmi?` : ""}
        variant="danger"
        loading={deleting}
      />
    </div>
  );
}
