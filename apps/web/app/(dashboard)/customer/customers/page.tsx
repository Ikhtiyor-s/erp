"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Search, Download, Upload, Eye } from "lucide-react";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/api-error";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Modal, Field, input } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useTranslations } from "next-intl";

type Customer = {
  id: string;
  code?: string;
  uuid_label: string;
  name: string;
  phone?: string;
  email?: string;
  tin?: string;
  category_id?: number;
  category_name?: string;
  location_name?: string;
  org_name?: string;
  address?: string;
  balance?: string;
  created_at?: string;
};
type Category = { id: number; name: string };

const empty = {
  name: "",
  code: "",
  phone: "",
  email: "",
  address: "",
  tin: "",
  category_id: null,
  notes: "",
};

const fmt = (v: any) =>
  Number(v || 0).toLocaleString("ru-RU", { maximumFractionDigits: 2 });

export default function CustomersPage() {
  const t = useTranslations("ui");
  const router = useRouter();
  const [rows, setRows] = useState<Customer[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ q: "", category_id: "" });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(empty);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      p.set("limit", "200");
      if (filters.q) p.set("q", filters.q);
      if (filters.category_id) p.set("category_id", filters.category_id);
      setRows((await api.get<Customer[]>(`/customer/customers?${p}`)).data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    api
      .get<Category[]>("/customer/categories")
      .then((r) => setCats(r.data))
      .catch(() => {});
    load();
  }, []);

  async function save() {
    try {
      const payload = { ...form, category_id: form.category_id || null };
      if (editId) await api.put(`/customer/customers/${editId}`, payload);
      else await api.post("/customer/customers", payload);
      toast.success(t("ui__сохранено_54a59b19"));
      setOpen(false);
      load();
    } catch (e) {
      toast.error(getErrorMessage(e, "Xato"));
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await api.delete(`/customer/customers/${deleteTarget.id}`);
      toast.success(t("ui__удалено_0c450c40"));
      setDeleteTarget(null);
      load();
    } catch (e) {
      toast.error(getErrorMessage(e, "Xato"));
    } finally {
      setDeleteLoading(false);
    }
  }

  const fileRef = useRef<HTMLInputElement>(null);

  async function exportCsv() {
    const { data } = await api.get("/customer/customers/export", {
      responseType: "blob",
    });
    const url = URL.createObjectURL(data as Blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "customers.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function importCsv(file: File) {
    const fd = new FormData();
    fd.append("file", file);
    try {
      const { data } = await api.post("/customer/customers/import", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      toast.success(`Import: ${data.created}, o'tkazib yuborildi: ${data.skipped}`);
      load();
    } catch (e) {
      toast.error(getErrorMessage(e, "Import xatosi"));
    }
  }

  const columns: Column<Customer>[] = [
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
    { key: "name", header: t("ui__фио_название_35bab21a") },
    {
      key: "phone",
      header: t("ui__телефон_2928e19c"),
      width: "150px",
      render: (r) => r.phone || "—",
    },
    {
      key: "tin",
      header: t("ui__инн_5b0ec543"),
      width: "120px",
      render: (r) => r.tin || "—",
    },
    {
      key: "category_name",
      header: t("ui__категория_c95a1e2d"),
      width: "140px",
      render: (r) =>
        r.category_name ? <Badge tone="neutral">{r.category_name}</Badge> : "—",
    },
    {
      key: "location_name",
      header: t("ui__локация_fb00342c"),
      width: "140px",
      render: (r) => r.location_name || "—",
    },
    {
      key: "balance",
      header: t("ui__баланс_95dcad97"),
      align: "right",
      width: "140px",
      render: (r) => {
        const v = Number(r.balance || 0);
        const cls =
          v < 0
            ? "text-danger-700 dark:text-danger-500"
            : v > 0
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
        <Button
          type="button"
          variant="ghost"
          size="xs"
          icon={Eye}
          onClick={(e) => {
            e.stopPropagation();
            router.push(`/customer/customers/${r.id}`);
          }}
          title={t("ui__профиль_a46c3723")}
          aria-label={`${r.name} profilini ko'rish`}
          className="text-brand-600 dark:text-brand-400 hover:text-brand-700"
        />
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("ui__клиенты_0b63184a")}
        description={t("ui__база_клиентов_организации_cae61437")}
        onCreate={() => {
          setForm(empty);
          setEditId(null);
          setOpen(true);
        }}
      />

      {/* Filters */}
      <Card className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="sm:col-span-2 relative">
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
            value={filters.q}
            onChange={(e) => setFilters({ ...filters, q: e.target.value })}
            onKeyDown={(e) => e.key === "Enter" && load()}
          />
        </div>
        <div>
          <label className="text-xs text-ink-500 dark:text-ink-400 block mb-1">
            {t("ui__категория_c95a1e2d")}
          </label>
          <select
            className={input}
            value={filters.category_id}
            onChange={(e) =>
              setFilters({ ...filters, category_id: e.target.value })
            }
          >
            <option value="">{t("ui__все_a07b234e")}</option>
            {cats.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end gap-2">
          <Button type="button" onClick={load} size="md">
            {t("ui__фильтр_2f884b41")}
          </Button>
        </div>
        <div className="flex items-end gap-2 justify-end">
          <Button type="button" variant="outline" size="sm" icon={Download} onClick={exportCsv}>
            CSV
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            icon={Upload}
            onClick={() => fileRef.current?.click()}
          >
            {t("ui__импорт_d0cee49f")}
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) importCsv(f);
              e.target.value = "";
            }}
          />
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
              address: r.address || "",
              tin: r.tin || "",
              category_id: r.category_id || null,
              notes: "",
            });
            setEditId(r.id);
            setOpen(true);
          }}
          onDelete={(r) => setDeleteTarget(r)}
        />
      </div>

      {/* Mobile cards */}
      {loading ? (
        <div className="md:hidden text-center text-sm text-ink-400 py-8">
          {t("ui__загрузка_43e40d49")}
        </div>
      ) : rows.length === 0 ? (
        <div className="md:hidden text-center text-sm text-ink-400 py-8">
          {t("ui__нет_данных_dee9a2d8")}
        </div>
      ) : (
        <Card padding="none" className="md:hidden">
          <ul className="divide-y divide-ink-100 dark:divide-ink-800">
            {rows.map((r) => (
              <li key={r.id} className="p-4 flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-ink-900 dark:text-ink-100 truncate">{r.name}</p>
                  {r.phone && <p className="text-sm text-ink-500 dark:text-ink-400">{r.phone}</p>}
                  {r.category_name && (
                    <div className="mt-1">
                      <Badge tone="neutral">{r.category_name}</Badge>
                    </div>
                  )}
                  <p
                    className={`text-xs font-mono mt-1 ${
                      Number(r.balance || 0) < 0
                        ? "text-danger-600 dark:text-danger-500"
                        : Number(r.balance || 0) > 0
                        ? "text-success-600 dark:text-success-500"
                        : "text-ink-400"
                    }`}
                  >
                    {t("ui__баланс_95dcad97")}: {fmt(r.balance)}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button
                    type="button"
                    variant="outline"
                    size="xs"
                    aria-label="Ko'rish"
                    onClick={() => router.push(`/customer/customers/${r.id}`)}
                  >
                    Ko&apos;rish
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    aria-label="Tahrirlash"
                    onClick={() => {
                      setForm({
                        name: r.name,
                        code: r.code || "",
                        phone: r.phone || "",
                        email: r.email || "",
                        address: r.address || "",
                        tin: r.tin || "",
                        category_id: r.category_id || null,
                        notes: "",
                      });
                      setEditId(r.id);
                      setOpen(true);
                    }}
                  >
                    Tahrir
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editId ? "Mijozni tahrirlash" : "Yangi mijoz"}
        size="lg"
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("ui__фио_название_35bab21a")} required>
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
          <Field label={t("ui__категория_c95a1e2d")}>
            <select
              className={input}
              value={form.category_id || ""}
              onChange={(e) =>
                setForm({
                  ...form,
                  category_id: e.target.value ? Number(e.target.value) : null,
                })
              }
            >
              <option value="">{t("ui__нет_7b07413e")}</option>
              {cats.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
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
          <div className="col-span-2">
            <Field label={t("ui__заметки_c8866295")}>
              <textarea
                className={input}
                rows={2}
                value={form.notes}
                onChange={(e) =>
                  setForm({ ...form, notes: e.target.value })
                }
              />
            </Field>
          </div>
          <div className="col-span-2 flex justify-end gap-2 pt-2 border-t border-ink-200 dark:border-ink-800">
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
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="O'chirish"
        message={`«${deleteTarget?.name}» o'chirilsinmi?`}
        variant="danger"
        loading={deleteLoading}
      />
    </div>
  );
}
