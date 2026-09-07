"use client";

import { useEffect, useState } from "react";
import { Shield, Search } from "lucide-react";
import { api } from "@/lib/api";
import { input } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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

      <Card padding="md" className="flex gap-3 items-end">
        <div className="relative flex-1 max-w-md">
          <label className="text-xs text-ink-500 dark:text-ink-400 block mb-1">
            {t("ui__поиск_роли_497a0396")}
          </label>
          <Search
            size={14}
            className="absolute left-2.5 top-[34px] text-ink-400"
          />
          <input
            className={`${input} pl-8`}
            placeholder={t("ui__поиск_b84a8f87")}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="ml-auto text-xs text-ink-500 dark:text-ink-400">
          {t("ui__всего_2dc77255")} <span className="font-semibold">{filtered.length}</span>
        </div>
      </Card>

      {loading ? (
        <div className="text-center py-10 text-ink-400 dark:text-ink-500">
          {t("ui__загрузка_43e40d49")}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-10 text-ink-400 dark:text-ink-500">
          {t("ui__роли_не_найдены_d9bda67a")}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {filtered.map((r) => (
            <Card key={r.id} padding="lg" className="hover:shadow-md transition-shadow">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300 rounded-md">
                  <Shield size={18} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-ink-900 dark:text-ink-100">
                      {r.name}
                    </h3>
                    <Badge tone="neutral" className="font-mono">{r.code}</Badge>
                  </div>
                  <p className="text-sm text-ink-600 dark:text-ink-300 mt-1">
                    {r.description || "—"}
                  </p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <p className="text-xs text-ink-400 dark:text-ink-500 text-center pt-6">
        {t("ui__назначение_ролей_пользователям_555195f0")}
      </p>
    </div>
  );
}
