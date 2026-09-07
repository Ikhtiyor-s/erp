"use client";

import { useEffect, useState } from "react";
import { Search, Filter, RotateCcw, ChevronLeft, ChevronRight } from "lucide-react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/ui/page-header";
import { input, Modal } from "@/components/ui/modal";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

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

type BadgeTone = "success" | "warning" | "danger" | "info" | "primary" | "neutral" | "teal" | "purple";

const ACTION_TONE: Record<string, BadgeTone> = {
  create:    "success",
  update:    "info",
  delete:    "danger",
  pay:       "success",
  cancel:    "warning",
  duplicate: "purple",
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
      <Card padding="md">
        <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
          <div className="md:col-span-2">
            <label className="text-xs text-ink-500 dark:text-ink-400 block mb-1">
              Qidirish (JSON ichida)
            </label>
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-2.5 text-ink-400" />
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
            <label className="text-xs text-ink-500 dark:text-ink-400 block mb-1">
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
            <label className="text-xs text-ink-500 dark:text-ink-400 block mb-1">
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
            <label className="text-xs text-ink-500 dark:text-ink-400 block mb-1">
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
            <label className="text-xs text-ink-500 dark:text-ink-400 block mb-1">
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
          <Button variant="outline" size="md" icon={RotateCcw} onClick={resetFilters}>
            Tozalash
          </Button>
          <Button variant="primary" size="md" icon={Filter} onClick={applyFilters}>
            Filtrlash
          </Button>
        </div>
      </Card>

      {/* Result table */}
      <Card padding="none">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-ink-50 dark:bg-ink-900 text-xs text-ink-500 dark:text-ink-400 uppercase tracking-wider">
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
                  <td colSpan={7} className="text-center py-10 text-ink-400 dark:text-ink-600">
                    Yuklanmoqda...
                  </td>
                </tr>
              )}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-ink-400 dark:text-ink-600">
                    Ma'lumot yo'q
                  </td>
                </tr>
              )}
              {!loading &&
                rows.map((r) => (
                  <tr
                    key={r.id}
                    className="border-t border-ink-100 dark:border-ink-800/40 hover:bg-ink-50/80 dark:hover:bg-ink-900/40"
                  >
                    <td className="px-4 py-2 font-mono text-xs text-ink-700 dark:text-ink-300">
                      {formatDate(r.created_at)}
                    </td>
                    <td className="px-4 py-2 text-ink-900 dark:text-ink-100">
                      {r.user_name || r.user_email || (
                        <span className="text-ink-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <Badge tone={ACTION_TONE[r.action] || "neutral"}>
                        {actionLabel(r.action)}
                      </Badge>
                    </td>
                    <td className="px-4 py-2 text-ink-700 dark:text-ink-300">
                      {entityLabel(r.entity)}
                    </td>
                    <td className="px-4 py-2 font-mono text-xs text-ink-500 dark:text-ink-400">
                      {r.entity_id ? r.entity_id.slice(0, 8) : "—"}
                    </td>
                    <td className="px-4 py-2 font-mono text-xs text-ink-500 dark:text-ink-400">
                      {r.ip || "—"}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {r.diff && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="xs"
                          onClick={() => setSelected(r)}
                          className="text-brand-600 dark:text-brand-400"
                        >
                          Ko'rish
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {total > limit && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-ink-100 dark:border-ink-800/40 text-sm">
            <div className="text-ink-500 dark:text-ink-400">
              {page * limit + 1}–{Math.min((page + 1) * limit, total)} / {total}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                icon={ChevronLeft}
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                Oldingi
              </Button>
              <Button
                variant="outline"
                size="sm"
                iconRight={ChevronRight}
                disabled={page >= lastPage}
                onClick={() => setPage((p) => Math.min(lastPage, p + 1))}
              >
                Keyingi
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Detail modal */}
      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected ? `${actionLabel(selected.action)} — ${entityLabel(selected.entity)}` : ""}
        size="lg"
      >
        {selected && (
          <div className="space-y-3 text-sm">
            <div className="text-xs text-ink-500 dark:text-ink-400">
              {formatDate(selected.created_at)} •{" "}
              {selected.user_name || selected.user_email || "—"}
            </div>
            {selected.entity_id && (
              <div>
                <span className="text-ink-500 dark:text-ink-400">Yozuv ID: </span>
                <span className="font-mono">{selected.entity_id}</span>
              </div>
            )}
            {selected.ip && (
              <div>
                <span className="text-ink-500 dark:text-ink-400">IP: </span>
                <span className="font-mono">{selected.ip}</span>
              </div>
            )}
            {selected.user_agent && (
              <div>
                <span className="text-ink-500 dark:text-ink-400">User Agent: </span>
                <span className="font-mono text-xs break-all">
                  {selected.user_agent}
                </span>
              </div>
            )}
            <div>
              <div className="text-ink-500 dark:text-ink-400 mb-1">O'zgarishlar:</div>
              <pre className="bg-ink-50 dark:bg-ink-900 rounded p-3 text-xs overflow-x-auto font-mono text-ink-800 dark:text-ink-200">
                {JSON.stringify(selected.diff, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
