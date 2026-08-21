"use client";

import { useEffect, useState } from "react";
import { Shield, Search } from "lucide-react";
import { api } from "@/lib/api";
import { input } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { useTranslations } from "next-intl";

type Role = { id: number; code: string; name: string; description?: string };

export default function RolesPage() {
  const t = useTranslations("ui");
  const [rows, setRows] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    api
      .get<Role[]>("/hr/roles")
      .then((r) => setRows(r.data))
      .finally(() => setLoading(false));
  }, []);

  const filtered = q
    ? rows.filter((r) =>
        (r.name + " " + r.code + " " + (r.description || ""))
          .toLowerCase()
          .includes(q.toLowerCase())
      )
    : rows;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("ui__роли_316266ad")}
        description={t("ui__системные_роли_для_назначения__4a70b86c")}
      />

      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm p-4 flex gap-3 items-end">
        <div className="relative flex-1 max-w-md">
          <label className="text-xs text-slate-500 dark:text-slate-400 block mb-1">
            {t("ui__поиск_роли_497a0396")}
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
        <div className="ml-auto text-xs text-slate-500 dark:text-slate-400">
          {t("ui__всего_2dc77255")} <span className="font-semibold">{filtered.length}</span>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-10 text-slate-400 dark:text-slate-500">
          {t("ui__загрузка_43e40d49")}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-10 text-slate-400 dark:text-slate-500">
          {t("ui__роли_не_найдены_d9bda67a")}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {filtered.map((r) => (
            <div
              key={r.id}
              className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm p-5 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start gap-3">
                <div className="p-2 bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300 rounded-md">
                  <Shield size={18} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                      {r.name}
                    </h3>
                    <code className="text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded">
                      {r.code}
                    </code>
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
                    {r.description || "—"}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-slate-400 dark:text-slate-500 text-center pt-6">
        {t("ui__назначение_ролей_пользователям_555195f0")}
      </p>
    </div>
  );
}
