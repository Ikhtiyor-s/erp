"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Search } from "lucide-react";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/api-error";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Modal, Field, input } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { useTranslations } from "next-intl";

type Wh = {
  id: number;
  name: string;
  address?: string;
  responsible_id?: string;
  responsible_name?: string;
  product_count?: number;
  stock_value?: string;
};
type Emp = { id: string; full_name: string };

const empty = { name: "", address: "", responsible_id: null as string | null };
const fmt = (v: any) =>
  Number(v || 0).toLocaleString("ru-RU", { maximumFractionDigits: 2 });

export default function WarehousesPage() {
  const t = useTranslations("ui");
  const [rows, setRows] = useState<Wh[]>([]);
  const [employees, setEmployees] = useState<Emp[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(empty);
  const [editId, setEditId] = useState<number | null>(null);

  async function load() {
    setLoading(true);
    try {
      setRows((await api.get<Wh[]>("/warehouse/warehouses")).data);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    api
      .get<Emp[]>("/hr/employees")
      .then((r) => setEmployees(r.data))
      .catch(() => {});
    load();
  }, []);

  async function save() {
    try {
      const payload = {
        ...form,
        responsible_id: form.responsible_id || null,
      };
      if (editId) await api.put(`/warehouse/warehouses/${editId}`, payload);
      else await api.post("/warehouse/warehouses", payload);
      toast.success(t("ui__сохранено_54a59b19"));
      setOpen(false);
      load();
    } catch (e) {
      toast.error(getErrorMessage(e, "Xato"));
    }
  }
  async function del(r: Wh) {
    if (!confirm(`«${r.name}» ombori o'chirilsinmi?`)) return;
    await api.delete(`/warehouse/warehouses/${r.id}`);
    toast.success(t("ui__удалено_0c450c40"));
    load();
  }

  const filtered = q
    ? rows.filter((r) =>
        (r.name + " " + (r.address || "") + " " + (r.responsible_name || ""))
          .toLowerCase()
          .includes(q.toLowerCase())
      )
    : rows;

  const totalValue = filtered.reduce(
    (s, r) => s + Number(r.stock_value || 0),
    0
  );
  const totalProducts = filtered.reduce(
    (s, r) => s + (r.product_count || 0),
    0
  );

  const columns: Column<Wh>[] = [
    { key: "name", header: t("ui__название_602680ed") },
    {
      key: "address",
      header: t("ui__адрес_80148fa5"),
      render: (r) => r.address || "—",
    },
    {
      key: "responsible_name",
      header: t("ui__ответственный_ab60703b"),
      width: "180px",
      render: (r) => r.responsible_name || "—",
    },
    {
      key: "product_count",
      header: t("ui__товаров_ac7fc73e"),
      align: "right",
      width: "120px",
      render: (r) => (
        <span className="font-mono text-brand-700 dark:text-brand-400">
          {r.product_count || 0}
        </span>
      ),
    },
    {
      key: "stock_value",
      header: t("ui__стоимость_остатка_f66111d8"),
      align: "right",
      width: "180px",
      render: (r) => (
        <span className="font-mono text-slate-900 dark:text-slate-100">
          {fmt(r.stock_value)}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("ui__склады_c11af0a0")}
        description={t("ui__места_хранения_товаров_13b3d933")}
        onCreate={() => {
          setForm(empty);
          setEditId(null);
          setOpen(true);
        }}
      />

      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm p-4 flex gap-3 items-end">
        <div className="relative flex-1 max-w-md">
          <label className="text-xs text-slate-500 dark:text-slate-400 block mb-1">
            {t("ui__поиск_bfc95980")}
          </label>
          <Search
            size={14}
            className="absolute left-2.5 top-[34px] text-slate-400"
          />
          <input
            className={`${input} pl-8`}
            placeholder={t("ui__поиск_склада_9a95110b")}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="ml-auto text-sm flex gap-6">
          <div>
            <span className="text-slate-500 dark:text-slate-400">{t("ui__складов_f4b63aa1")}</span>{" "}
            <span className="font-semibold text-slate-900 dark:text-slate-100">
              {filtered.length}
            </span>
          </div>
          <div>
            <span className="text-slate-500 dark:text-slate-400">{t("ui__товаров_3a455dc3")}</span>{" "}
            <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
              {totalProducts}
            </span>
          </div>
          <div>
            <span className="text-slate-500 dark:text-slate-400">{t("ui__сумма_19fcefbe")}</span>{" "}
            <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
              {fmt(totalValue)}
            </span>
          </div>
        </div>
      </div>

      {/* Desktop table */}
      <div className="hidden md:block">
        <DataTable
          columns={columns}
          rows={filtered}
          loading={loading}
          onEdit={(r) => {
            setForm({
              name: r.name,
              address: r.address || "",
              responsible_id: r.responsible_id || null,
            });
            setEditId(r.id);
            setOpen(true);
          }}
          onDelete={del}
        />
      </div>

      {/* Mobile cards */}
      <ul className="md:hidden space-y-3">
        {loading && (
          <li className="text-center text-sm text-slate-400 py-8">{t("ui__загрузка_43e40d49")}</li>
        )}
        {!loading && filtered.length === 0 && (
          <li className="text-center text-sm text-slate-400 py-8">{t("ui__нет_данных_dee9a2d8")}</li>
        )}
        {filtered.map((r) => (
          <li key={r.id} className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-slate-900 dark:text-slate-100 truncate">{r.name}</p>
                {r.address && <p className="text-sm text-slate-500 dark:text-slate-400 truncate">{r.address}</p>}
                {r.responsible_name && (
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{t("ui__ответственный_ab60703b")}: {r.responsible_name}</p>
                )}
                <div className="flex gap-4 mt-1 text-xs text-slate-500 dark:text-slate-400">
                  <span>{r.product_count || 0} {t("ui__товаров_ac7fc73e")}</span>
                  <span className="font-mono">{fmt(r.stock_value)}</span>
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  aria-label="Tahrirlash"
                  onClick={() => {
                    setForm({ name: r.name, address: r.address || "", responsible_id: r.responsible_id || null });
                    setEditId(r.id);
                    setOpen(true);
                  }}
                  className="text-xs text-brand-600 hover:text-brand-700 px-2 py-1 rounded border border-brand-200"
                >
                  {t("ui__редактировать_bc41d38a") || "Tahrir"}
                </button>
                <button
                  aria-label="O'chirish"
                  onClick={() => del(r)}
                  className="text-xs text-rose-600 hover:text-rose-700 px-2 py-1 rounded border border-rose-200"
                >
                  {t("ui__удалить_b8cd2db2") || "O'chir"}
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editId ? "Omborni tahrirlash" : "Yangi ombor"}
      >
        <div className="space-y-3">
          <Field label={t("ui__название_602680ed")} required>
            <input
              className={input}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </Field>
          <Field label={t("ui__адрес_80148fa5")}>
            <input
              className={input}
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          </Field>
          <Field label={t("ui__ответственный_ab60703b")}>
            <select
              className={input}
              value={form.responsible_id || ""}
              onChange={(e) =>
                setForm({
                  ...form,
                  responsible_id: e.target.value || null,
                })
              }
            >
              <option value="">{t("ui__нет_7b07413e")}</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.full_name}
                </option>
              ))}
            </select>
          </Field>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setOpen(false)}
              className="px-4 py-2 text-sm rounded-md border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700"
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
