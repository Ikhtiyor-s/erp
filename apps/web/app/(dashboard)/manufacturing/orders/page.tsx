"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Play, CheckCircle, XCircle, Eye, Search } from "lucide-react";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/api-error";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Modal, Field, input } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { useTranslations } from "next-intl";

type Order = {
  id: string;
  doc_number?: string;
  uuid_label?: string;
  planned_qty: string;
  produced_qty: string;
  status: string;
  started_at?: string;
  finished_at?: string;
  created_at?: string;
  product_name?: string;
  warehouse_name?: string;
  warehouse_id?: number;
  responsible_name?: string;
  responsible_id?: string;
  created_by_name?: string;
  org_name?: string;
};
type Bom = { id: string; product_name: string; output_qty: string };
type Wh = { id: number; name: string };
type Emp = { id: string; full_name: string };

const fmt = (v: any) => Number(v || 0).toLocaleString("ru-RU", { maximumFractionDigits: 3 });
const statusColor = (s: string) => ({
  draft: "text-slate-500 dark:text-slate-400", in_progress: "text-yellow-600",
  completed: "text-green-600", cancelled: "text-red-600",
}[s] || "");
const statusLabel = (s: string) => ({
  draft: "Qoralama", in_progress: "Ishda",
  completed: "Yakunlandi", cancelled: "Bekor qilindi",
}[s] || s);

export default function ProductionPage() {
  const t = useTranslations("ui");
  const [rows, setRows] = useState<Order[]>([]);
  const [boms, setBoms] = useState<Bom[]>([]);
  const [warehouses, setWarehouses] = useState<Wh[]>([]);
  const [employees, setEmployees] = useState<Emp[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<any | null>(null);

  const empty = {
    bom_id: "", warehouse_id: "" as number | "", warehouse_from_id: "" as number | "",
    planned_qty: "1", responsible_id: "", notes: "",
  };
  const [form, setForm] = useState<any>(empty);

  const [finishOpen, setFinishOpen] = useState(false);
  const [finishQty, setFinishQty] = useState("");

  const [filters, setFilters] = useState({
    q: "",
    status: "",
    responsible_id: "",
    warehouse_id: "" as number | "",
  });

  async function load() {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      if (filters.q) p.set("q", filters.q);
      if (filters.status) p.set("status", filters.status);
      if (filters.responsible_id) p.set("responsible_id", filters.responsible_id);
      if (filters.warehouse_id) p.set("warehouse_id", String(filters.warehouse_id));
      const qs = p.toString();
      setRows((await api.get<Order[]>(`/manufacturing/production-orders${qs ? "?" + qs : ""}`)).data);
    } finally { setLoading(false); }
  }
  useEffect(() => {
    Promise.all([
      api.get<Bom[]>("/manufacturing/bom").then((r) => setBoms(r.data)),
      api.get<Wh[]>("/warehouse/warehouses").then((r) => setWarehouses(r.data)),
      api.get<Emp[]>("/hr/employees").then((r) => setEmployees(r.data)),
    ]).catch(() => {});
    load();
  }, []);

  async function create() {
    if (!form.bom_id || !form.warehouse_id) { toast.error(t("ui__выберите_рецепт_и_склад_afd3a412")); return; }
    try {
      await api.post("/manufacturing/production-orders", {
        bom_id: form.bom_id,
        warehouse_id: Number(form.warehouse_id),
        warehouse_from_id: form.warehouse_from_id ? Number(form.warehouse_from_id) : null,
        planned_qty: Number(form.planned_qty) || 1,
        responsible_id: form.responsible_id || null,
        notes: form.notes || null,
      });
      toast.success(t("ui__заказ_создан_4dc0ec43")); setOpen(false); setForm(empty); load();
    } catch (e) { toast.error(getErrorMessage(e, "Xato")); }
  }

  async function openView(o: Order) {
    const { data } = await api.get(`/manufacturing/production-orders/${o.id}`);
    setView(data);
    setFinishQty(String(data.head.planned_qty));
  }

  async function start(id: string) {
    try {
      await api.post(`/manufacturing/production-orders/${id}/start`);
      toast.success(t("ui__запущено_6bec5a01")); load(); if (view?.head?.id === id) openView({ id } as any);
    } catch (e) { toast.error(getErrorMessage(e, "Xato")); }
  }

  async function finishOrder() {
    if (!view) return;
    const v = Number(finishQty);
    if (!v || v <= 0) { toast.error(t("ui__введите_количество_76068af1")); return; }
    try {
      const { data } = await api.post(`/manufacturing/production-orders/${view.head.id}/finish`,
        { produced_qty: v });
      toast.success(`Yakunlandi. Birlik tannarxi: ${fmt(data.unit_cost)}`);
      setFinishOpen(false); setView(null); load();
    } catch (e) { toast.error(getErrorMessage(e, "Xato")); }
  }

  async function cancel(id: string) {
    if (!confirm("Ishlab chiqarish buyurtmasini bekor qilasizmi?")) return;
    await api.delete(`/manufacturing/production-orders/${id}`);
    toast.success(t("ui__отменено_81a04dab")); setView(null); load();
  }

  const cols: Column<Order>[] = [
    {
      key: "uuid_label",
      header: t("ui__id_номер_e669322b"),
      width: "100px",
      render: (r) => (
        <code className="text-xs text-slate-600 dark:text-slate-400">
          {r.uuid_label || `#${r.id.slice(0, 8)}`}
        </code>
      ),
    },
    { key: "doc_number", header: "№", render: (r) => r.doc_number || "—", width: "90px" },
    { key: "product_name", header: t("ui__готовая_продукция_5d5498a6") },
    {
      key: "warehouse_name",
      header: t("ui__склад_e8bf999f"),
      width: "140px",
      render: (r) => r.warehouse_name || "—",
    },
    {
      key: "responsible_name",
      header: t("ui__ответственный_ab60703b"),
      width: "160px",
      render: (r) => r.responsible_name || "—",
    },
    {
      key: "created_by_name",
      header: t("ui__создал_3a6d92d4"),
      width: "140px",
      render: (r) => r.created_by_name || "—",
    },
    {
      key: "created_at",
      header: t("ui__создан_8be108de"),
      width: "140px",
      render: (r) =>
        r.created_at ? new Date(r.created_at).toLocaleDateString("ru-RU") : "—",
    },
    {
      key: "planned_qty",
      header: t("ui__план_ee229f3b"),
      align: "right",
      width: "100px",
      render: (r) => <span className="font-mono">{fmt(r.planned_qty)}</span>,
    },
    {
      key: "produced_qty",
      header: t("ui__факт_0a982a27"),
      align: "right",
      width: "100px",
      render: (r) => <span className="font-mono">{fmt(r.produced_qty)}</span>,
    },
    {
      key: "status",
      header: t("ui__статус_7203f7a4"),
      width: "120px",
      render: (r) => (
        <span className={statusColor(r.status)}>{statusLabel(r.status)}</span>
      ),
    },
    {
      key: "id" as any,
      header: "",
      align: "center",
      width: "60px",
      render: (r) => (
        <button
          onClick={() => openView(r)}
          className="text-brand-600 hover:text-brand-700 dark:text-brand-400"
        >
          <Eye size={14} />
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={t("ui__заказы_на_производство_5bf29aa0")} description={t("ui__производство_готовой_продукции_cfee26bc")}
        onCreate={() => { setForm(empty); setOpen(true); }} createLabel={t("ui__новый_заказ_9a1a009d")} />

      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="sm:col-span-2 relative">
          <label className="text-xs text-slate-500 dark:text-slate-400 block mb-1">
            {t("ui__поиск_продукт_ответственный_за_f1c866e1")}
          </label>
          <Search
            size={14}
            className="absolute left-2.5 top-[34px] text-slate-400"
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
          <label className="text-xs text-slate-500 dark:text-slate-400 block mb-1">
            {t("ui__статус_7203f7a4")}
          </label>
          <select
            className={input}
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
          >
            <option value="">{t("ui__все_a07b234e")}</option>
            <option value="draft">{t("ui__черновик_30ab6155")}</option>
            <option value="in_progress">{t("ui__в_работе_8c92e34f")}</option>
            <option value="completed">{t("ui__завершено_0083ce05")}</option>
            <option value="cancelled">{t("ui__отменено_81a04dab")}</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-500 dark:text-slate-400 block mb-1">
            {t("ui__ответственный_ab60703b")}
          </label>
          <select
            className={input}
            value={filters.responsible_id}
            onChange={(e) =>
              setFilters({ ...filters, responsible_id: e.target.value })
            }
          >
            <option value="">{t("ui__все_a07b234e")}</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.full_name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-500 dark:text-slate-400 block mb-1">
            {t("ui__склад_e8bf999f")}
          </label>
          <select
            className={input}
            value={filters.warehouse_id}
            onChange={(e) =>
              setFilters({
                ...filters,
                warehouse_id: e.target.value ? Number(e.target.value) : "",
              })
            }
          >
            <option value="">{t("ui__все_a07b234e")}</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </div>
        <div className="col-span-5 flex justify-end gap-2">
          <button
            onClick={() => {
              setFilters({ q: "", status: "", responsible_id: "", warehouse_id: "" });
              setTimeout(load, 0);
            }}
            className="px-4 py-2 text-sm rounded-md border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700"
          >
            {t("ui__сброс_1b421ddb")}
          </button>
          <button
            onClick={load}
            className="px-4 py-2 bg-brand-600 text-white rounded-md text-sm hover:bg-brand-700"
          >
            {t("ui__фильтр_2f884b41")}
          </button>
        </div>
      </div>

      <DataTable columns={cols} rows={rows} loading={loading} />

      <Modal open={open} onClose={() => setOpen(false)} size="lg" title={t("ui__новый_заказ_на_производство_5add9f2c")}>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("ui__рецепт_bom_ba5d443b")} required>
              <select className={input} value={form.bom_id}
                onChange={(e) => setForm({ ...form, bom_id: e.target.value })}>
                <option value="">{t("ui__выберите_edab92dd")}</option>
                {boms.map((b) => <option key={b.id} value={b.id}>{t("ui__b_product_name_выход_fmt_b_out_744b0d4a")}</option>)}
              </select>
            </Field>
            <Field label={t("ui__план_кол_во_2d591956")} required>
              <input type="number" step="0.001" className={input} value={form.planned_qty}
                onChange={(e) => setForm({ ...form, planned_qty: e.target.value })} />
            </Field>
            <Field label={t("ui__склад_готовой_ad5000b8")} required>
              <select className={input} value={form.warehouse_id}
                onChange={(e) => setForm({ ...form, warehouse_id: e.target.value ? Number(e.target.value) : "" })}>
                <option value="">{t("ui__выберите_edab92dd")}</option>
                {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </Field>
            <Field label={t("ui__склад_сырья_97f0fa4d")}>
              <select className={input} value={form.warehouse_from_id}
                onChange={(e) => setForm({ ...form, warehouse_from_id: e.target.value ? Number(e.target.value) : "" })}>
                <option value="">{t("ui__как_склад_готовой_a48684fc")}</option>
                {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </Field>
            <Field label={t("ui__ответственный_ab60703b")}>
              <select className={input} value={form.responsible_id}
                onChange={(e) => setForm({ ...form, responsible_id: e.target.value })}>
                <option value="">{t("ui__нет_7b07413e")}</option>
                {employees.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}
              </select>
            </Field>
            <Field label={t("ui__примечание_686eb72b")}>
              <input className={input} value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </Field>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setOpen(false)} className="px-4 py-2 text-sm rounded-md border hover:bg-slate-50 dark:bg-slate-900/40">{t("ui__отмена_987b33c6")}</button>
            <button onClick={create} className="px-4 py-2 text-sm rounded-md bg-brand-600 text-white hover:bg-brand-700">{t("ui__создать_b059f7e1")}</button>
          </div>
        </div>
      </Modal>

      <Modal open={!!view} onClose={() => setView(null)} size="lg"
        title={view ? `Buyurtma: ${view.head.product_name}` : ""}>
        {view && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-slate-500 dark:text-slate-400">{t("ui__статус_9fa7ff8e")}</span> <span className={statusColor(view.head.status)}>{statusLabel(view.head.status)}</span></div>
              <div><span className="text-slate-500 dark:text-slate-400">{t("ui__план_3d7adcfe")}</span> <span className="font-mono">{fmt(view.head.planned_qty)}</span></div>
              <div><span className="text-slate-500 dark:text-slate-400">{t("ui__склад_готовой_75442a37")}</span> {view.head.warehouse_name}</div>
              <div><span className="text-slate-500 dark:text-slate-400">{t("ui__ответственный_4746ee0f")}</span> {view.head.responsible_name || "—"}</div>
            </div>

            <div>
              <h4 className="font-semibold mb-2 text-sm">{t("ui__ингредиенты_на_план_b844f35d")}</h4>
              <div className="border rounded-md">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-900/40">
                    <tr>
                      <th className="px-3 py-2 text-left">{t("ui__ингредиент_3ab4d4ca")}</th>
                      <th className="px-3 py-2 text-right">{t("ui__на_1_ед_66e87448")}</th>
                      <th className="px-3 py-2 text-right">{t("ui__на_план_6f75b16b")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {view.ingredients.map((i: any) => {
                      const mult = Number(view.head.planned_qty) / Number(view.head.output_qty || 1);
                      return (
                        <tr key={i.product_id} className="border-t">
                          <td className="px-3 py-2">{i.product_name}</td>
                          <td className="px-3 py-2 text-right font-mono">{fmt(i.quantity)}</td>
                          <td className="px-3 py-2 text-right font-mono font-semibold">{fmt(Number(i.quantity) * mult)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              {view.head.status === "draft" && (
                <>
                  <button onClick={() => cancel(view.head.id)}
                    className="px-3 py-2 text-sm border border-red-300 text-red-700 rounded-md hover:bg-red-50 inline-flex items-center gap-1.5">
                    <XCircle size={14} /> {t("ui__отменить_ecdbdc8b")}
                  </button>
                  <button onClick={() => start(view.head.id)}
                    className="px-4 py-2 text-sm bg-yellow-600 text-white rounded-md hover:bg-yellow-700 inline-flex items-center gap-1.5">
                    <Play size={14} /> {t("ui__запустить_2ae9b916")}
                  </button>
                </>
              )}
              {view.head.status === "in_progress" && (
                <button onClick={() => setFinishOpen(true)}
                  className="px-4 py-2 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 inline-flex items-center gap-1.5">
                  <CheckCircle size={14} /> {t("ui__завершить_b0e3a5e0")}
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>

      <Modal open={finishOpen} onClose={() => setFinishOpen(false)} title={t("ui__завершить_производство_d8f11799")}>
        <div className="space-y-3">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {t("ui__сырьё_будет_списано_по_рецепту_0aeff348")}
          </p>
          <Field label={t("ui__фактически_произведено_a4cede7d")} required>
            <input type="number" step="0.001" className={input} value={finishQty}
              onChange={(e) => setFinishQty(e.target.value)} />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setFinishOpen(false)} className="px-4 py-2 text-sm rounded-md border hover:bg-slate-50 dark:bg-slate-900/40">{t("ui__отмена_987b33c6")}</button>
            <button onClick={finishOrder} className="px-4 py-2 text-sm rounded-md bg-green-600 text-white hover:bg-green-700">{t("ui__завершить_b0e3a5e0")}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
