"use client";

import { useEffect, useState } from "react";
import { Search, Filter, RotateCcw, ChevronLeft, ChevronRight } from "lucide-react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/ui/page-header";
import { input } from "@/components/ui/modal";

type AuditRow = {
  id: number;
  action: string;
  entity: string;
  entity_id: string | null;
  diff: any;
  ip: string | null;
  user_agent: string | null;
  created_at: string;
  user_name: string | null;
  user_email: string | null;
};

type ListResponse = {
  rows: AuditRow[];
  total: number;
  limit: number;
  offset: number;
};

const ACTION_COLORS: Record<string, string> = {
  create:    "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  update:    "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  delete:    "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  pay:       "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  cancel:    "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
  duplicate: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
};

function actionLabel(a: string): string {
  return {
    create: "Yaratish",
    update: "O'zgartirish",
    delete: "O'chirish",
    pay: "To'lov",
    cancel: "Bekor qilish",
    duplicate: "Nusxalash",
    login: "Kirish",
    logout: "Chiqish",
  }[a] || a;
}

function entityLabel(e: string): string {
  return {
    sales: "Sotuvlar",
    sale_items: "Sotuv pozitsiyalari",
    sale_returns: "Qaytarishlar",
    products: "Mahsulotlar",
    customers: "Mijozlar",
    suppliers: "Yetkazib beruvchilar",
    cashboxes: "Kassalar",
    cash_movements: "Pul harakatlari",
    employees: "Xodimlar",
    warehouses: "Omborlar",
    users: "Foydalanuvchilar",
  }[e] || e;
}

function formatDate(s: string): string {
  return new Date(s).toLocaleString("uz-Cyrl-UZ", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

export default function AuditLogPage() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [entities, setEntities] = useState<{ entity: string; count: number }[]>([]);
  const [actions, setActions] = useState<{ action: string; count: number }[]>([]);
  const [selected, setSelected] = useState<AuditRow | null>(null);

  // Filters
  const [filterEntity, setFilterEntity] = useState("");
  const [filterAction, setFilterAction] = useState("");
  const [filterQ, setFilterQ] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");

  const limit = 50;

  async function loadFilters() {
    try {
      const [e, a] = await Promise.all([
        api.get<{ entity: string; count: number }[]>("/audit/entities"),
        api.get<{ action: string; count: number }[]>("/audit/actions"),
      ]);
      setEntities(e.data);
      setActions(a.data);
    } catch {}
  }

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: String(limit),
        offset: String(page * limit),
      });
      if (filterEntity) params.set("entity", filterEntity);
      if (filterAction) params.set("action", filterAction);
      if (filterQ) params.set("q", filterQ);
      if (filterDateFrom) params.set("date_from", filterDateFrom);
      if (filterDateTo) params.set("date_to", filterDateTo);
      const { data } = await api.get<ListResponse>(`/audit/logs?${params}`);
      setRows(data.rows);
      setTotal(data.total);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadFilters();
  }, []);

  useEffect(() => {
    load();
  }, [page]);

  function applyFilters() {
    setPage(0);
    load();
  }

  function resetFilters() {
    setFilterEntity("");
    setFilterAction("");
    setFilterQ("");
    setFilterDateFrom("");
    setFilterDateTo("");
    setPage(0);
    setTimeout(load, 0);
  }

  const lastPage = Math.max(0, Math.ceil(total / limit) - 1);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit tarixi"
        description="Tizimdagi barcha o'zgartirishlar — kim, qachon, nima qildi"
      />

      {/* Filters card */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm p-4">
        <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
          <div className="md:col-span-2">
            <label className="text-xs text-slate-500 dark:text-slate-400 block mb-1">
              Qidirish (JSON ichida)
            </label>
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
              <input
                className={`${input} pl-8`}
                placeholder="Mahsulot nomi, summa, ID..."
                value={filterQ}
                onChange={(e) => setFilterQ(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && applyFilters()}
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-500 dark:text-slate-400 block mb-1">
              Modul
            </label>
            <select
              className={input}
              value={filterEntity}
              onChange={(e) => setFilterEntity(e.target.value)}
            >
              <option value="">— hammasi —</option>
              {entities.map((e) => (
                <option key={e.entity} value={e.entity}>
                  {entityLabel(e.entity)} ({e.count})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-500 dark:text-slate-400 block mb-1">
              Harakat
            </label>
            <select
              className={input}
              value={filterAction}
              onChange={(e) => setFilterAction(e.target.value)}
            >
              <option value="">— hammasi —</option>
              {actions.map((a) => (
                <option key={a.action} value={a.action}>
                  {actionLabel(a.action)} ({a.count})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-500 dark:text-slate-400 block mb-1">
              Sanadan
            </label>
            <input
              type="date"
              className={input}
              value={filterDateFrom}
              onChange={(e) => setFilterDateFrom(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 dark:text-slate-400 block mb-1">
              Sanagacha
            </label>
            <input
              type="date"
              className={input}
              value={filterDateTo}
              onChange={(e) => setFilterDateTo(e.target.value)}
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={resetFilters}
            className="flex items-center gap-1.5 px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-md hover:bg-slate-50 dark:hover:bg-slate-700"
          >
            <RotateCcw size={14} /> Tozalash
          </button>
          <button
            onClick={applyFilters}
            className="flex items-center gap-1.5 px-4 py-2 text-sm bg-brand-600 hover:bg-brand-700 text-white rounded-md font-medium"
          >
            <Filter size={14} /> Filtrlash
          </button>
        </div>
      </div>

      {/* Result table */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900/50 text-xs text-slate-500 dark:text-slate-400 uppercase">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Vaqt</th>
                <th className="text-left px-4 py-3 font-medium">Foydalanuvchi</th>
                <th className="text-left px-4 py-3 font-medium">Harakat</th>
                <th className="text-left px-4 py-3 font-medium">Modul</th>
                <th className="text-left px-4 py-3 font-medium">ID</th>
                <th className="text-left px-4 py-3 font-medium">IP</th>
                <th className="text-right px-4 py-3 font-medium">Tafsilot</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-slate-400 dark:text-slate-500">
                    Yuklanmoqda...
                  </td>
                </tr>
              )}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-slate-400 dark:text-slate-500">
                    Ma'lumot yo'q
                  </td>
                </tr>
              )}
              {!loading &&
                rows.map((r) => (
                  <tr
                    key={r.id}
                    className="border-t border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-900/30"
                  >
                    <td className="px-4 py-2 font-mono text-xs text-slate-700 dark:text-slate-300">
                      {formatDate(r.created_at)}
                    </td>
                    <td className="px-4 py-2 text-slate-900 dark:text-slate-100">
                      {r.user_name || r.user_email || (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-medium ${
                          ACTION_COLORS[r.action] ||
                          "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300"
                        }`}
                      >
                        {actionLabel(r.action)}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-slate-700 dark:text-slate-300">
                      {entityLabel(r.entity)}
                    </td>
                    <td className="px-4 py-2 font-mono text-xs text-slate-500 dark:text-slate-400">
                      {r.entity_id ? r.entity_id.slice(0, 8) : "—"}
                    </td>
                    <td className="px-4 py-2 font-mono text-xs text-slate-500 dark:text-slate-400">
                      {r.ip || "—"}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {r.diff && (
                        <button
                          onClick={() => setSelected(r)}
                          className="text-brand-600 dark:text-brand-400 text-xs hover:underline"
                        >
                          Ko'rish
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {total > limit && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 dark:border-slate-700 text-sm">
            <div className="text-slate-500 dark:text-slate-400">
              {page * limit + 1}–{Math.min((page + 1) * limit, total)} / {total}
            </div>
            <div className="flex gap-2">
              <button
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                className="flex items-center gap-1 px-3 py-1.5 border border-slate-300 dark:border-slate-600 rounded-md hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={14} /> Oldingi
              </button>
              <button
                disabled={page >= lastPage}
                onClick={() => setPage((p) => Math.min(lastPage, p + 1))}
                className="flex items-center gap-1 px-3 py-1.5 border border-slate-300 dark:border-slate-600 rounded-md hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Keyingi <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Detail modal */}
      {selected && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setSelected(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto"
          >
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <div>
                <div className="font-semibold text-slate-900 dark:text-slate-100">
                  {actionLabel(selected.action)} — {entityLabel(selected.entity)}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {formatDate(selected.created_at)} •{" "}
                  {selected.user_name || selected.user_email || "—"}
                </div>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 text-2xl leading-none"
              >
                &times;
              </button>
            </div>
            <div className="p-5 space-y-3 text-sm">
              {selected.entity_id && (
                <div>
                  <span className="text-slate-500 dark:text-slate-400">Yozuv ID: </span>
                  <span className="font-mono">{selected.entity_id}</span>
                </div>
              )}
              {selected.ip && (
                <div>
                  <span className="text-slate-500 dark:text-slate-400">IP: </span>
                  <span className="font-mono">{selected.ip}</span>
                </div>
              )}
              {selected.user_agent && (
                <div>
                  <span className="text-slate-500 dark:text-slate-400">User Agent: </span>
                  <span className="font-mono text-xs break-all">
                    {selected.user_agent}
                  </span>
                </div>
              )}
              <div>
                <div className="text-slate-500 dark:text-slate-400 mb-1">O'zgarishlar:</div>
                <pre className="bg-slate-50 dark:bg-slate-900 rounded p-3 text-xs overflow-x-auto font-mono text-slate-800 dark:text-slate-200">
                  {JSON.stringify(selected.diff, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
