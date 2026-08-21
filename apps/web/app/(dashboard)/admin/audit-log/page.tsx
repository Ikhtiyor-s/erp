"use client";

import { Fragment, useEffect, useState } from "react";
import { Activity, Search, ChevronLeft, ChevronRight, RotateCw } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/api-error";
import { PageHeader } from "@/components/ui/page-header";
import { input } from "@/components/ui/modal";

type AuditRow = {
  id: string;
  action: string;
  entity: string | null;
  entity_id: string | null;
  diff: any;
  ip: string | null;
  user_agent: string | null;
  created_at: string;
  user_name: string | null;
  user_email: string | null;
};

const ACTION_COLORS: Record<string, string> = {
  create:    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  update:    "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300",
  delete:    "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
  login:     "bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300",
  logout:    "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
};

const PAGE_SIZE = 50;

export default function AdminAuditLogPage() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [filters, setFilters] = useState({
    q: "",
    action: "",
    entity: "",
    date_from: "",
    date_to: "",
  });
  const [entities, setEntities] = useState<string[]>([]);
  const [actions, setActions] = useState<string[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  async function load(overrides?: Partial<typeof filters>) {
    setLoading(true);
    try {
      const f = { ...filters, ...overrides };
      const p = new URLSearchParams();
      p.set("limit", String(PAGE_SIZE));
      p.set("offset", String(page * PAGE_SIZE));
      if (f.q) p.set("q", f.q);
      if (f.action) p.set("action", f.action);
      if (f.entity) p.set("entity", f.entity);
      if (f.date_from) p.set("date_from", f.date_from);
      if (f.date_to) p.set("date_to", f.date_to);
      const r = await api.get<{ rows: AuditRow[]; total: number }>(
        `/audit?${p.toString()}`
      );
      setRows(r.data.rows);
      setTotal(r.data.total);
    } catch (e) {
      toast.error(getErrorMessage(e, "Yuklab bo'lmadi"));
    } finally {
      setLoading(false);
    }
  }

  async function loadDicts() {
    try {
      const [e, a] = await Promise.all([
        api.get<{ entity: string }[]>("/audit/entities"),
        api.get<{ action: string }[]>("/audit/actions"),
      ]);
      setEntities(e.data.map((x) => x.entity).filter(Boolean));
      setActions(a.data.map((x) => x.action).filter(Boolean));
    } catch {}
  }

  useEffect(() => { loadDicts(); }, []);
  useEffect(() => { load(); /* eslint-disable-line */ }, [page]);

  function applyFilters() {
    setPage(0);
    load();
  }

  function reset() {
    const empty = { q: "", action: "", entity: "", date_from: "", date_to: "" };
    setFilters(empty);
    setPage(0);
    // H9: pass override directly — don't rely on stale closure of `filters`
    load(empty);
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-4">
      <PageHeader
        title="Audit jurnali"
        description="Tashkilotda sodir bo'lgan barcha o'zgarishlar tarixi"
      />

      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-3 sm:p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
        <div className="lg:col-span-2 relative">
          <label className="text-xs text-slate-500 dark:text-slate-400 block mb-1">Qidiruv</label>
          <Search size={14} className="absolute left-2.5 top-[34px] text-slate-400" />
          <input
            className={`${input} pl-8`}
            placeholder="diff ichida..."
            value={filters.q}
            onChange={(e) => setFilters({ ...filters, q: e.target.value })}
            onKeyDown={(e) => e.key === "Enter" && applyFilters()}
          />
        </div>
        <div>
          <label className="text-xs text-slate-500 dark:text-slate-400 block mb-1">Amal</label>
          <select
            className={input}
            value={filters.action}
            onChange={(e) => setFilters({ ...filters, action: e.target.value })}
          >
            <option value="">— hamma —</option>
            {actions.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-500 dark:text-slate-400 block mb-1">Obyekt</label>
          <select
            className={input}
            value={filters.entity}
            onChange={(e) => setFilters({ ...filters, entity: e.target.value })}
          >
            <option value="">— hamma —</option>
            {entities.map((e) => <option key={e} value={e}>{e}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-500 dark:text-slate-400 block mb-1">Sanadan</label>
          <input type="date" className={input}
            value={filters.date_from}
            onChange={(e) => setFilters({ ...filters, date_from: e.target.value })} />
        </div>
        <div>
          <label className="text-xs text-slate-500 dark:text-slate-400 block mb-1">Sanagacha</label>
          <input type="date" className={input}
            value={filters.date_to}
            onChange={(e) => setFilters({ ...filters, date_to: e.target.value })} />
        </div>
        <div className="sm:col-span-2 lg:col-span-6 flex justify-end gap-2">
          <button onClick={reset}
            className="px-3 py-2 text-sm rounded-md border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 inline-flex items-center gap-1.5">
            <RotateCw size={14} /> Reset
          </button>
          <button onClick={applyFilters}
            className="px-4 py-2 text-sm bg-brand-600 hover:bg-brand-700 text-white rounded-md">
            Filtr
          </button>
        </div>
      </div>

      {/* Mobile cards */}
      <ul className="md:hidden space-y-3">
        {loading && <li className="text-center text-sm text-slate-400 py-8">Yuklanmoqda...</li>}
        {!loading && rows.length === 0 && <li className="text-center text-sm text-slate-400 py-8">Hodisalar topilmadi</li>}
        {rows.map((r) => (
          <li key={r.id} className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${ACTION_COLORS[r.action] || "bg-slate-100 text-slate-700"}`}>{r.action}</span>
                  {r.entity && <span className="text-xs text-slate-500">{r.entity}</span>}
                </div>
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100 mt-1">{r.user_name || "—"}</p>
                <p className="text-xs text-slate-500">{r.user_email}</p>
                <p className="text-xs text-slate-400 font-mono mt-0.5">{new Date(r.created_at).toLocaleString("ru-RU")}</p>
              </div>
              <div className="text-xs text-slate-400 shrink-0">{r.ip || "—"}</div>
            </div>
          </li>
        ))}
      </ul>

      {/* Desktop table */}
      <div className="hidden md:block bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 flex items-center gap-2 text-slate-900 dark:text-slate-100">
          <Activity size={16} />
          <span className="font-semibold">Hodisalar ({total.toLocaleString("ru-RU")})</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900/40 text-xs text-slate-500 dark:text-slate-400 uppercase">
              <tr>
                <th className="text-left px-3 py-2">Vaqt</th>
                <th className="text-left px-3 py-2">Foydalanuvchi</th>
                <th className="text-left px-3 py-2">Amal</th>
                <th className="text-left px-3 py-2">Obyekt</th>
                <th className="text-left px-3 py-2">IP</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={5} className="text-center py-10 text-slate-400">Yuklanmoqda...</td></tr>
              )}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={5} className="text-center py-10 text-slate-400">Hodisalar topilmadi</td></tr>
              )}
              {rows.map((r) => (
                <Fragment key={r.id}>
                  <tr
                    onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
                    className="border-t border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-900/30 cursor-pointer">
                    <td className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap font-mono">
                      {new Date(r.created_at).toLocaleString("ru-RU", {
                        year: "2-digit", month: "2-digit", day: "2-digit",
                        hour: "2-digit", minute: "2-digit", second: "2-digit",
                      })}
                    </td>
                    <td className="px-3 py-2">
                      <div className="text-slate-900 dark:text-slate-100">{r.user_name || "—"}</div>
                      <div className="text-xs text-slate-500">{r.user_email || ""}</div>
                    </td>
                    <td className="px-3 py-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        ACTION_COLORS[r.action] || "bg-slate-100 text-slate-700"
                      }`}>
                        {r.action}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-slate-700 dark:text-slate-300">
                      {r.entity || "—"}
                      {r.entity_id && (
                        <span className="ml-1 text-xs text-slate-400 font-mono">
                          {r.entity_id.slice(0, 8)}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-500 font-mono">{r.ip || "—"}</td>
                  </tr>
                  {expandedId === r.id && (
                    <tr>
                      <td colSpan={5} className="px-3 py-2 bg-slate-50 dark:bg-slate-900/40 border-t border-slate-100 dark:border-slate-700">
                        <pre className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap overflow-x-auto max-h-60 overflow-y-auto font-mono">
                          {r.diff ? JSON.stringify(r.diff, null, 2) : "— diff yo'q —"}
                        </pre>
                        {r.user_agent && (
                          <div className="text-xs text-slate-500 mt-2">UA: {r.user_agent}</div>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
        {/* Pagination */}
        <div className="px-3 py-2 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between text-xs">
          <span className="text-slate-500">
            Sahifa {page + 1} / {totalPages} • {total.toLocaleString("ru-RU")} ta jami
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0 || loading}
              className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30">
              <ChevronLeft size={14} />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1 || loading}
              className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30">
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
