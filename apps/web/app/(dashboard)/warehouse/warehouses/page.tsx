"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Search } from "lucide-react";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/api-error";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Modal, Field, input } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useTranslations } from "next-intl";

type Wh = {
  id: number;
  name: string;
  address?: string;
  responsible_id?: string;
  responsible_name?: string;
  type_id?: number | null;
  type_name?: string | null;
  location_id?: number | null;
  location_name?: string | null;
  product_count?: number;
  stock_value?: string;
};
type Emp = { id: string; full_name: string };
type WhType = { id: number; name: string; code: string | null };
type Loc = { id: number; name: string };

const empty = {
  name: "", address: "", responsible_id: null as string | null,
  type_id: null as number | null, location_id: null as number | null,
};
const fmt = (v: any) =>
  Number(v || 0).toLocaleString("ru-RU", { maximumFractionDigits: 2 });

export default function WarehousesPage() {
  const t = useTranslations("ui");
  const tw = useTranslations("warehouse");
  const [rows, setRows] = useState<Wh[]>([]);
  const [employees, setEmployees] = useState<Emp[]>([]);
  const [whTypes, setWhTypes] = useState<WhType[]>([]);
  const [locations, setLocations] = useState<Loc[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(empty);
  const [editId, setEditId] = useState<number | null>(null);
  const [confirmWh, setConfirmWh] = useState<Wh | null>(null);
  const [deleting, setDeleting] = useState(false);

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
    api
      .get<WhType[]>("/warehouse/types")
      .then((r) => setWhTypes(r.data))
      .catch(() => {});
    api
      .get<Loc[]>("/reference/locations")
      .then((r) => setLocations(r.data))
      .catch(() => {});
    load();
  }, []);

  async function save() {
    try {
      const payload = {
        ...form,
        responsible_id: form.responsible_id || null,
        type_id: form.type_id || null,
        location_id: form.location_id || null,
      };
      if (editId) await api.put(`/warehouse/warehouses/${editId}`, payload);
      else await api.post("/warehouse/warehouses", payload);
      toast.success(t("ui__сохранено_54a59b19"));
      setOpen(false);
      load();
    } catch (e) {
      toast.error(getErrorMessage(e, t("ui__ошибка_c6fd3c6a")));
    }
  }
  async function del(r: Wh) {
    setDeleting(true);
    try {
      await api.delete(`/warehouse/warehouses/${r.id}`);
      toast.success(t("ui__удалено_0c450c40"));
      setConfirmWh(null);
      load();
    } catch (e) {
      toast.error(getErrorMessage(e, t("ui__ошибка_c6fd3c6a")));
      setConfirmWh(null);
    } finally {
      setDeleting(false);
    }
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
      key: "type_name",
      header: tw("warehouse_type_label"),
      width: "160px",
      render: (r) => r.type_name ? (
        <Badge tone="neutral" className="font-mono">{r.type_name}</Badge>
      ) : "—",
    },
    {
      key: "address",
      header: t("ui__адрес_80148fa5"),
      render: (r) => r.address || "—",
    },
    {
      key: "location_name",
      header: "Filial",
      width: "160px",
      render: (r) => r.location_name || "—",
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
        <span className="font-mono text-ink-900 dark:text-ink-100">
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

      <Card>
        <div className="flex gap-3 items-end flex-wrap">
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <label className="text-xs text-ink-500 dark:text-ink-400 block mb-1">
              {t("ui__поиск_bfc95980")}
            </label>
            <Search
              size={14}
              className="absolute left-2.5 top-[34px] text-ink-400"
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
              <span className="text-ink-500 dark:text-ink-400">{t("ui__складов_f4b63aa1")}</span>{" "}
              <span className="font-semibold text-ink-900 dark:text-ink-100">
                {filtered.length}
              </span>
            </div>
            <div>
              <span className="text-ink-500 dark:text-ink-400">{t("ui__товаров_3a455dc3")}</span>{" "}
              <span className="font-mono font-semibold text-ink-900 dark:text-ink-100">
                {totalProducts}
              </span>
            </div>
            <div>
              <span className="text-ink-500 dark:text-ink-400">{t("ui__сумма_19fcefbe")}</span>{" "}
              <span className="font-mono font-semibold text-ink-900 dark:text-ink-100">
                {fmt(totalValue)}
              </span>
            </div>
          </div>
        </div>
      </Card>

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
              type_id: r.type_id ?? null,
              location_id: r.location_id ?? null,
            });
            setEditId(r.id);
            setOpen(true);
          }}
          onDelete={(r) => setConfirmWh(r)}
        />
      </div>

      {/* Mobile cards */}
      <ul className="md:hidden space-y-3">
        {loading && (
          <li className="text-center text-sm text-ink-400 py-8">{t("ui__загрузка_43e40d49")}</li>
        )}
        {!loading && filtered.length === 0 && (
          <li className="text-center text-sm text-ink-400 py-8">{t("ui__нет_данных_dee9a2d8")}</li>
        )}
        {filtered.map((r) => (
          <li key={r.id} className="bg-white dark:bg-ink-900 rounded-lg border border-ink-200 dark:border-ink-800 p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-ink-900 dark:text-ink-100 truncate">{r.name}</p>
                {r.address && <p className="text-sm text-ink-500 dark:text-ink-400 truncate">{r.address}</p>}
                {r.location_name && (
                  <p className="text-xs text-ink-400 dark:text-ink-500 mt-0.5">Filial: {r.location_name}</p>
                )}
                {r.responsible_name && (
                  <p className="text-xs text-ink-400 dark:text-ink-500 mt-0.5">{t("ui__ответственный_ab60703b")}: {r.responsible_name}</p>
                )}
                <div className="flex gap-4 mt-1 text-xs text-ink-500 dark:text-ink-400">
                  <span>{r.product_count || 0} {t("ui__товаров_ac7fc73e")}</span>
                  <span className="font-mono">{fmt(r.stock_value)}</span>
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button
                  aria-label="Tahrirlash"
                  variant="outline"
                  size="xs"
                  onClick={() => {
                    setForm({
                      name: r.name, address: r.address || "",
                      responsible_id: r.responsible_id || null,
                      type_id: r.type_id ?? null,
                      location_id: r.location_id ?? null,
                    });
                    setEditId(r.id);
                    setOpen(true);
                  }}
                >
                  {t("ui__редактировать_1706282c")}
                </Button>
                <Button
                  aria-label="O'chirish"
                  variant="danger"
                  size="xs"
                  onClick={() => setConfirmWh(r)}
                >
                  {t("ui__удалить_ed2bbfbc")}
                </Button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editId ? tw("edit_warehouse") : tw("new_warehouse")}
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
          <Field label="Filial">
            <select
              className={input}
              value={form.location_id ?? ""}
              onChange={(e) =>
                setForm({
                  ...form,
                  location_id: e.target.value ? Number(e.target.value) : null,
                })
              }
            >
              <option value="">{t("ui__нет_7b07413e")}</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
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
          <Field label={tw("warehouse_type_label")}>
            <select
              className={input}
              value={form.type_id ?? ""}
              onChange={(e) =>
                setForm({
                  ...form,
                  type_id: e.target.value ? Number(e.target.value) : null,
                })
              }
            >
              <option value="">{t("ui__нет_7b07413e")}</option>
              {whTypes.map((wt) => (
                <option key={wt.id} value={wt.id}>
                  {wt.name}
                </option>
              ))}
            </select>
          </Field>
          <div className="flex justify-end gap-2 pt-2 border-t border-ink-200 dark:border-ink-800">
            <Button variant="outline" onClick={() => setOpen(false)}>
              {t("ui__отмена_987b33c6")}
            </Button>
            <Button onClick={save}>
              {t("ui__сохранить_74ea58b6")}
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmWh !== null}
        onClose={() => setConfirmWh(null)}
        onConfirm={() => { if (confirmWh) del(confirmWh); }}
        title={t("ui__удалить_запись_12469355")}
        message={`«${confirmWh?.name}» ombori o'chirilsinmi?`}
        confirmLabel={t("ui__удалить_ed2bbfbc")}
        loading={deleting}
      />
    </div>
  );
}
