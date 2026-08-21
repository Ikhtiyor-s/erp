"use client";

import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { api } from "@/lib/api";
import { DataTable, type Column } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { input } from "@/components/ui/modal";
import { useTranslations } from "next-intl";

type Row = {
  entity_id: string;
  entity_name: string;
  total_in: string;
  total_out: string;
  net: string;
  cnt: number;
};

const fmt = (v: any) =>
  Number(v || 0).toLocaleString("ru-RU", { maximumFractionDigits: 2 });
const today = () => new Date().toISOString().slice(0, 10);
const monthAgo = () => {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
};

type Props = {
  title: string;
  description: string;
  endpoint: string;
  entityLabel: string;
};

export function TurnoverReport({
  title,
  description,
  endpoint,
  entityLabel,
}: Props) {
  const t = useTranslations("ui");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState(monthAgo());
  const [dateTo, setDateTo] = useState(today());
  const [q, setQ] = useState("");

  async function load() {
    setLoading(true);
    try {
      setRows(
        (
          await api.get<Row[]>(
            `${endpoint}?date_from=${dateFrom}&date_to=${dateTo}`
          )
        ).data
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = q
    ? rows.filter((r) =>
        r.entity_name.toLowerCase().includes(q.toLowerCase())
      )
    : rows;

  const totalIn = filtered.reduce((s, r) => s + Number(r.total_in || 0), 0);
  const totalOut = filtered.reduce((s, r) => s + Number(r.total_out || 0), 0);

  const cols: Column<Row>[] = [
    { key: "entity_name", header: entityLabel },
    {
      key: "cnt",
      header: t("ui__операций_f680ce84"),
      align: "right",
      width: "110px",
      render: (r) => (
        <span className="font-mono text-slate-700 dark:text-slate-300">
          {r.cnt}
        </span>
      ),
    },
    {
      key: "total_in",
      header: t("ui__приход_ebf29487"),
      align: "right",
      width: "160px",
      render: (r) => (
        <span className="font-mono text-green-700 dark:text-green-400">
          {fmt(r.total_in)}
        </span>
      ),
    },
    {
      key: "total_out",
      header: t("ui__расход_6068400a"),
      align: "right",
      width: "160px",
      render: (r) => (
        <span className="font-mono text-red-700 dark:text-red-400">
          {fmt(r.total_out)}
        </span>
      ),
    },
    {
      key: "net",
      header: t("ui__сальдо_508d1e7a"),
      align: "right",
      width: "160px",
      render: (r) => {
        const v = Number(r.net);
        return (
          <span
            className={`font-mono font-semibold ${
              v < 0
                ? "text-red-700 dark:text-red-400"
                : v > 0
                ? "text-green-700 dark:text-green-400"
                : "text-slate-500 dark:text-slate-400"
            }`}
          >
            {fmt(v)}
          </span>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={title} description={description} />

      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="sm:col-span-2 relative">
          <label className="text-xs text-slate-500 dark:text-slate-400 block mb-1">
            {t("ui__поиск_bfc95980")}
          </label>
          <Search
            size={14}
            className="absolute left-2.5 top-[34px] text-slate-400"
          />
          <input
            className={`${input} pl-8`}
            placeholder={t("ui__поиск_b84a8f87")}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs text-slate-500 dark:text-slate-400 block mb-1">
            {t("ui__с_даты_09fc6619")}
          </label>
          <input
            type="date"
            className={input}
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs text-slate-500 dark:text-slate-400 block mb-1">
            {t("ui__по_дату_760bcfc8")}
          </label>
          <input
            type="date"
            className={input}
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </div>
        <div className="col-span-4 flex justify-end">
          <button
            onClick={load}
            className="px-4 py-2 bg-brand-600 text-white rounded-md text-sm hover:bg-brand-700"
          >
            {t("ui__показать_2a175c27")}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card
          label={t("ui__приход_ebf29487")}
          value={fmt(totalIn)}
          color="text-green-700 dark:text-green-400"
        />
        <Card
          label={t("ui__расход_6068400a")}
          value={fmt(totalOut)}
          color="text-red-700 dark:text-red-400"
        />
        <Card
          label={t("ui__сальдо_508d1e7a")}
          value={fmt(totalIn - totalOut)}
          color={
            totalIn >= totalOut
              ? "text-green-700 dark:text-green-400"
              : "text-red-700 dark:text-red-400"
          }
        />
      </div>

      <DataTable
        columns={cols}
        rows={filtered}
        loading={loading}
        rowKey={(r) => r.entity_id}
      />
    </div>
  );
}

function Card({ label, value, color }: any) {
  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm p-4">
      <div className="text-xs text-slate-500 dark:text-slate-400 uppercase">
        {label}
      </div>
      <div className={`text-2xl font-bold mt-1 font-mono ${color}`}>{value}</div>
    </div>
  );
}
