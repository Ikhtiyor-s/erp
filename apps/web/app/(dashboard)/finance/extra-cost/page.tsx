"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Search, Wallet, Tag, ListOrdered } from "lucide-react";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/api-error";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Modal, Field, input } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatWidget } from "@/components/ui/stat-widget";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useTranslations } from "next-intl";

type Cost = {
  id: string;
  cost_date: string;
  category: string;
  amount: string;
  description?: string;
  cashbox_name?: string;
  currency_code?: string;
};
type Cashbox = { id: number; name: string; currency_id: number };
type Currency = { id: number; code: string };

const fmt = (v: any) =>
  Number(v || 0).toLocaleString("ru-RU", { maximumFractionDigits: 2 });
const today = () => new Date().toISOString().slice(0, 10);
const monthAgo = () => {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
};

export default function ExtraCostPage() {
  const t = useTranslations("ui");
  const [rows, setRows] = useState<Cost[]>([]);
  const [boxes, setBoxes] = useState<Cashbox[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    q: "",
    date_from: monthAgo(),
    date_to: today(),
  });
  const [open, setOpen] = useState(false);
  const [delTarget, setDelTarget] = useState<Cost | null>(null);

  const empty = {
    cost_date: today(),
    category: "",
    amount: 0,
    currency_id: null as number | null,
    cashbox_id: null as number | null,
    description: "",
  };
  const [form, setForm] = useState<any>(empty);

  async function load() {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      if (filters.date_from) p.set("date_from", filters.date_from);
      if (filters.date_to) p.set("date_to", filters.date_to);
      const qs = p.toString();
      setRows(
        (await api.get<Cost[]>(`/finance/extra-costs${qs ? "?" + qs : ""}`))
          .data
      );
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    Promise.all([
      api
        .get<Cashbox[]>("/finance/cashboxes")
        .then((r) => setBoxes(r.data)),
      api
        .get<Currency[]>("/reference/currencies")
        .then((r) => setCurrencies(r.data)),
    ]).catch(() => {});
    load();
  }, []);

  async function save() {
    if (!form.category || !form.currency_id) {
      toast.error(t("ui__заполните_категорию_и_валюту_20ff5a2a"));
      return;
    }
    try {
      await api.post("/finance/extra-costs", {
        ...form,
        amount: Number(form.amount) || 0,
      });
      toast.success(t("ui__расход_добавлен_6ef110fa"));
      setOpen(false);
      setForm(empty);
      load();
    } catch (e) {
      toast.error(getErrorMessage(e, "Xato"));
    }
  }
  async function del() {
    if (!delTarget) return;
    await api.delete(`/finance/extra-costs/${delTarget.id}`);
    toast.success(t("ui__удалено_0c450c40"));
    setDelTarget(null);
    load();
  }

  const filtered = useMemo(() => {
    if (!filters.q) return rows;
    const q = filters.q.toLowerCase();
    return rows.filter((r) =>
      (r.category + " " + (r.description || "") + " " + (r.cashbox_name || ""))
        .toLowerCase()
        .includes(q)
    );
  }, [rows, filters.q]);

  const total = filtered.reduce((s, r) => s + Number(r.amount), 0);
  const byCategory = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of filtered)
      m.set(r.category, (m.get(r.category) || 0) + Number(r.amount));
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [filtered]);

  const cols: Column<Cost>[] = [
    {
      key: "cost_date",
      header: t("ui__дата_8cdd8bb7"),
      width: "140px",
      render: (r) => new Date(r.cost_date).toLocaleDateString("ru-RU"),
    },
    { key: "category", header: t("ui__категория_c95a1e2d") },
    {
      key: "description",
      header: t("ui__описание_38ca0af8"),
      render: (r) => r.description || "—",
    },
    {
      key: "cashbox_name",
      header: t("ui__касса_c85fd621"),
      render: (r) => r.cashbox_name || "—",
      width: "160px",
    },
    {
      key: "amount",
      header: t("ui__сумма_cf59ebf9"),
      align: "right",
      width: "180px",
      render: (r) => (
        <span className="font-mono text-danger-700 dark:text-danger-500">
          −{fmt(r.amount)} {r.currency_code}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("ui__дополнительные_расходы_8c0f051b")}
        description={t("ui__внеплановые_расходы_аренда_усл_33d267a9")}
        onCreate={() => {
          setForm(empty);
          setOpen(true);
        }}
      />

      <Card padding="md">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="sm:col-span-2 relative">
            <label className="text-xs text-ink-500 dark:text-ink-400 block mb-1">
              {t("ui__поиск_категория_описание_23bd63c5")}
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
            />
          </div>
          <div>
            <label className="text-xs text-ink-500 dark:text-ink-400 block mb-1">
              {t("ui__с_даты_09fc6619")}
            </label>
            <input
              type="date"
              className={input}
              value={filters.date_from}
              onChange={(e) =>
                setFilters({ ...filters, date_from: e.target.value })
              }
            />
          </div>
          <div>
            <label className="text-xs text-ink-500 dark:text-ink-400 block mb-1">
              {t("ui__по_дату_760bcfc8")}
            </label>
            <input
              type="date"
              className={input}
              value={filters.date_to}
              onChange={(e) =>
                setFilters({ ...filters, date_to: e.target.value })
              }
            />
          </div>
          <div className="flex items-end">
            <Button fullWidth onClick={load}>
              {t("ui__применить_2cd84411")}
            </Button>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatWidget
          label={t("ui__сумма_cf59ebf9")}
          value={fmt(total)}
          subValue={`${filtered.length} ta yozuv`}
          icon={Wallet}
          color="danger"
          mono
        />
        <StatWidget
          label={t("ui__топ_категория_75409665")}
          value={byCategory[0]?.[0] || "—"}
          subValue={byCategory[0] ? fmt(byCategory[0][1]) : ""}
          icon={Tag}
          color="warn"
        />
        <StatWidget
          label={t("ui__категорий_4c2c134b")}
          value={String(byCategory.length)}
          subValue="turli"
          icon={ListOrdered}
          color="ink"
        />
      </div>

      <DataTable columns={cols} rows={filtered} loading={loading} onDelete={(r) => setDelTarget(r)} />

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={t("ui__новый_расход_6c0a62a7")}
        size="lg"
      >
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("ui__дата_8cdd8bb7")} required>
              <input
                type="date"
                className={input}
                value={form.cost_date}
                onChange={(e) =>
                  setForm({ ...form, cost_date: e.target.value })
                }
              />
            </Field>
            <Field label={t("ui__категория_c95a1e2d")} required>
              <input
                className={input}
                placeholder={t("ui__аренда_услуги_налоги_3e3103bd")}
                value={form.category}
                onChange={(e) =>
                  setForm({ ...form, category: e.target.value })
                }
              />
            </Field>
            <Field label={t("ui__сумма_cf59ebf9")} required>
              <input
                type="number"
                step="0.01"
                className={input}
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
              />
            </Field>
            <Field label={t("ui__валюта_cf55d9a9")} required>
              <select
                className={input}
                value={form.currency_id || ""}
                onChange={(e) =>
                  setForm({
                    ...form,
                    currency_id: e.target.value ? Number(e.target.value) : null,
                  })
                }
              >
                <option value="">{t("ui__выбрать_fbbc1d13")}</option>
                {currencies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t("ui__касса_списать_с_6e18b9e3")}>
              <select
                className={input}
                value={form.cashbox_id || ""}
                onChange={(e) =>
                  setForm({
                    ...form,
                    cashbox_id: e.target.value ? Number(e.target.value) : null,
                  })
                }
              >
                <option value="">{t("ui__только_учёт_99bf8b5e")}</option>
                {boxes.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label={t("ui__описание_38ca0af8")}>
            <textarea
              className={input}
              rows={2}
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
            />
          </Field>
          <div className="flex justify-end gap-2 pt-2 border-t border-ink-200 dark:border-ink-800">
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
        open={!!delTarget}
        onClose={() => setDelTarget(null)}
        onConfirm={del}
        title="Chiqimni o'chirish"
        message={delTarget ? `«${delTarget.category}» chiqimi o'chirilsinmi?` : ""}
        confirmLabel={t("ui__удалено_0c450c40")}
        variant="danger"
      />
    </div>
  );
}
