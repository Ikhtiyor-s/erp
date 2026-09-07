"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowDownCircle, ArrowUpCircle, ArrowLeftRight } from "lucide-react";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/api-error";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Modal, Field, input } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useTranslations } from "next-intl";

type Cashbox = {
  id: number;
  name: string;
  currency_id: number;
  currency_code?: string;
  balance: string;
  is_active: boolean;
  responsible_id?: string;
  responsible_name?: string;
  warehouse_id?: number | null;
  warehouse_name?: string | null;
};
type Warehouse = { id: number; name: string };
type Currency = { id: number; code: string };
type Movement = {
  id: number;
  cashbox_id: number;
  cashbox_name?: string;
  direction: "in" | "out" | "transfer";
  amount: string;
  currency_code?: string;
  description?: string;
  movement_date: string;
  customer_name?: string;
  supplier_name?: string;
  employee_name?: string;
  payment_type_name?: string;
};

const emptyCB = { name: "", currency_id: null as number | null, warehouse_id: null as number | null };
const emptyMV = { cashbox_id: null as number | null, direction: "in" as "in" | "out", amount: 0, description: "" };
const emptyTR = { from_cashbox_id: null as number | null, to_cashbox_id: null as number | null, amount: 0, description: "" };

const fmt = (v: any) => Number(v || 0).toLocaleString("ru-RU", { maximumFractionDigits: 2 });

export default function CashPage() {
  const t = useTranslations("ui");
  const tCB = useTranslations("finance.cashbox");
  const [boxes, setBoxes] = useState<Cashbox[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCB, setFilterCB] = useState<number | null>(null);

  const [cbOpen, setCbOpen] = useState(false);
  const [cbForm, setCbForm] = useState<any>(emptyCB);
  const [cbEditId, setCbEditId] = useState<number | null>(null);
  const [cbDelTarget, setCbDelTarget] = useState<Cashbox | null>(null);

  const [mvOpen, setMvOpen] = useState(false);
  const [mvForm, setMvForm] = useState<any>(emptyMV);

  const [trOpen, setTrOpen] = useState(false);
  const [trForm, setTrForm] = useState<any>(emptyTR);

  async function loadBoxes() { setBoxes((await api.get<Cashbox[]>("/finance/cashboxes")).data); }
  async function loadMovements(cb?: number | null) {
    const url = cb ? `/finance/movements?cashbox_id=${cb}` : "/finance/movements";
    setMovements((await api.get<Movement[]>(url)).data);
  }

  useEffect(() => {
    api.get<Currency[]>("/reference/currencies").then((r) => setCurrencies(r.data)).catch(() => {});
    api.get<Warehouse[]>("/warehouse/warehouses").then((r) => {
      setWarehouses(r.data || []);
    }).catch(() => {});
    (async () => {
      setLoading(true); await loadBoxes(); await loadMovements(); setLoading(false);
    })();
  }, []);

  async function saveCashbox() {
    if (!cbEditId && !cbForm.warehouse_id) {
      toast.error(tCB("warehouse_required"));
      return;
    }
    try {
      const payload = { ...cbForm };
      if (!payload.warehouse_id) delete payload.warehouse_id;
      if (cbEditId) await api.put(`/finance/cashboxes/${cbEditId}`, payload);
      else await api.post("/finance/cashboxes", payload);
      toast.success(t("ui__сохранено_54a59b19")); setCbOpen(false); setCbForm(emptyCB); setCbEditId(null); loadBoxes();
    } catch (e) { toast.error(getErrorMessage(e, "Xato")); }
  }
  async function delCashbox() {
    if (!cbDelTarget) return;
    await api.delete(`/finance/cashboxes/${cbDelTarget.id}`);
    toast.success(t("ui__закрыто_82809576"));
    setCbDelTarget(null);
    loadBoxes();
  }

  async function saveMovement() {
    if (!mvForm.cashbox_id) return toast.error(t("ui__выберите_кассу_9a1b030a"));
    const cb = boxes.find((b) => b.id === mvForm.cashbox_id);
    if (!cb) return;
    try {
      await api.post("/finance/movements", {
        cashbox_id: mvForm.cashbox_id, direction: mvForm.direction,
        amount: Number(mvForm.amount), currency_id: cb.currency_id,
        description: mvForm.description,
      });
      toast.success(t("ui__операция_проведена_b2bd14af")); setMvOpen(false); setMvForm(emptyMV);
      loadBoxes(); loadMovements(filterCB);
    } catch (e) { toast.error(getErrorMessage(e, "Xato")); }
  }

  async function saveTransfer() {
    if (!trForm.from_cashbox_id || !trForm.to_cashbox_id) return toast.error(t("ui__выберите_обе_кассы_5e09b8a4"));
    if (trForm.from_cashbox_id === trForm.to_cashbox_id) return toast.error(t("ui__кассы_совпадают_ca58c37c"));
    try {
      await api.post("/finance/transfer", {
        from_cashbox_id: trForm.from_cashbox_id, to_cashbox_id: trForm.to_cashbox_id,
        amount: Number(trForm.amount), description: trForm.description,
      });
      toast.success(t("ui__перевод_выполнен_86f6af27")); setTrOpen(false); setTrForm(emptyTR);
      loadBoxes(); loadMovements(filterCB);
    } catch (e) { toast.error(getErrorMessage(e, "Xato")); }
  }

  const cbName = (id: number) => boxes.find((b) => b.id === id)?.name || `#${id}`;
  const curCode = (id?: number) => id ? currencies.find((c) => c.id === id)?.code || "" : "";

  const boxCols: Column<Cashbox>[] = [
    { key: "name", header: t("ui__касса_c85fd621") },
    {
      key: "currency_id",
      header: t("ui__валюта_cf55d9a9"),
      width: "100px",
      render: (r) => r.currency_code || curCode(r.currency_id) || "—",
    },
    {
      key: "warehouse_name" as keyof Cashbox,
      header: tCB("warehouse_label"),
      width: "160px",
      render: (r) => r.warehouse_name || "—",
    },
    {
      key: "responsible_name",
      header: t("ui__ответственный_ab60703b"),
      width: "180px",
      render: (r) => r.responsible_name || "—",
    },
    {
      key: "balance",
      header: t("ui__баланс_95dcad97"),
      align: "right",
      width: "180px",
      render: (r) => (
        <span
          className={`font-mono ${
            Number(r.balance) < 0
              ? "text-danger-600 dark:text-danger-500"
              : "text-success-700 dark:text-success-500"
          }`}
        >
          {fmt(r.balance)} {r.currency_code || curCode(r.currency_id)}
        </span>
      ),
    },
    {
      key: "is_active",
      header: t("ui__статус_7203f7a4"),
      align: "center",
      width: "100px",
      render: (r) =>
        r.is_active ? (
          <Badge tone="success">{t("ui__активна_047e75c5")}</Badge>
        ) : (
          <Badge tone="neutral">{t("ui__закрыта_e17fe6d2")}</Badge>
        ),
    },
  ];

  function counterparty(r: Movement) {
    if (r.customer_name) return r.customer_name;
    if (r.supplier_name) return r.supplier_name;
    if (r.employee_name) return r.employee_name;
    return "—";
  }

  const movCols: Column<Movement>[] = [
    {
      key: "movement_date",
      header: t("ui__дата_8cdd8bb7"),
      width: "160px",
      render: (r) => new Date(r.movement_date).toLocaleString("ru-RU"),
    },
    {
      key: "cashbox_id",
      header: t("ui__касса_c85fd621"),
      width: "160px",
      render: (r) => r.cashbox_name || cbName(r.cashbox_id),
    },
    {
      key: "direction",
      header: t("ui__тип_345805b8"),
      align: "center",
      width: "110px",
      render: (r) =>
        r.direction === "in" ? (
          <span className="text-success-600 dark:text-success-500 inline-flex items-center gap-1">
            <ArrowDownCircle size={14} /> {t("ui__приход_ebf29487")}
          </span>
        ) : (
          <span className="text-danger-600 dark:text-danger-500 inline-flex items-center gap-1">
            <ArrowUpCircle size={14} /> {t("ui__расход_6068400a")}
          </span>
        ),
    },
    {
      key: "amount",
      header: t("ui__сумма_cf59ebf9"),
      align: "right",
      width: "160px",
      render: (r) => (
        <span
          className={`font-mono ${
            r.direction === "in"
              ? "text-success-700 dark:text-success-500"
              : "text-danger-700 dark:text-danger-500"
          }`}
        >
          {r.direction === "in" ? "+" : "−"}
          {fmt(r.amount)} {r.currency_code || ""}
        </span>
      ),
    },
    {
      key: "payment_type_name",
      header: t("ui__способ_c5fe4929"),
      width: "120px",
      render: (r) => r.payment_type_name || "—",
    },
    {
      key: "customer_name" as any,
      header: t("ui__контрагент_aad01fb1"),
      width: "160px",
      render: counterparty,
    },
    { key: "description", header: t("ui__описание_38ca0af8"), render: (r) => r.description || "—" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={t("ui__кассы_2e721ce2")} description={t("ui__кассы_и_операции_afe29bf7")}
        onCreate={() => { setCbForm(emptyCB); setCbEditId(null); setCbOpen(true); }} createLabel={t("ui__добавить_кассу_6e7a1891")} />

      <DataTable columns={boxCols} rows={boxes} loading={loading}
        onEdit={(r) => { setCbForm({ name: r.name, currency_id: r.currency_id, warehouse_id: r.warehouse_id ?? null }); setCbEditId(r.id); setCbOpen(true); }}
        onDelete={(r) => setCbDelTarget(r)} />

      <div className="flex items-center justify-between mt-8">
        <h2 className="text-[14px] font-semibold text-ink-800 dark:text-ink-100">{t("ui__операции_1e7f2e5c")}</h2>
        <div className="flex gap-2">
          <select className={`${input} max-w-xs`} value={filterCB || ""}
            onChange={(e) => {
              const v = e.target.value ? Number(e.target.value) : null;
              setFilterCB(v); loadMovements(v);
            }}>
            <option value="">{t("ui__все_кассы_c22bb516")}</option>
            {boxes.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <Button variant="outline" size="sm" icon={ArrowLeftRight} onClick={() => { setTrForm(emptyTR); setTrOpen(true); }}>
            {t("ui__перевод_b93e8b66")}
          </Button>
          <Button size="sm" onClick={() => { setMvForm(emptyMV); setMvOpen(true); }}>
            {t("ui__новая_операция_f4eae07b")}
          </Button>
        </div>
      </div>

      <DataTable columns={movCols} rows={movements} loading={false} />

      <Modal open={cbOpen} onClose={() => setCbOpen(false)} title={cbEditId ? "Kassani tahrirlash" : "Yangi kassa"}>
        <div className="space-y-3">
          <Field label={t("ui__название_602680ed")} required>
            <input className={input} value={cbForm.name} onChange={(e) => setCbForm({ ...cbForm, name: e.target.value })} />
          </Field>
          <Field label={t("ui__валюта_cf55d9a9")} required>
            <select className={input} value={cbForm.currency_id || ""}
              onChange={(e) => setCbForm({ ...cbForm, currency_id: e.target.value ? Number(e.target.value) : null })}>
              <option value="">{t("ui__выбрать_fbbc1d13")}</option>
              {currencies.map((c) => <option key={c.id} value={c.id}>{c.code}</option>)}
            </select>
          </Field>
          <Field label={tCB("warehouse_label")} required={!cbEditId}>
            <select
              className={`${input} ${!cbEditId && !cbForm.warehouse_id ? "border-danger-300 focus:border-danger-500 focus:ring-danger-300/30" : ""}`}
              value={cbForm.warehouse_id || ""}
              onChange={(e) => setCbForm({ ...cbForm, warehouse_id: e.target.value ? Number(e.target.value) : null })}
            >
              <option value="">{cbEditId ? "— o'zgartirmaslik —" : t("ui__выбрать_fbbc1d13")}</option>
              {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
            {!cbEditId && !cbForm.warehouse_id && (
              <p className="text-xs text-danger-500 mt-0.5">{tCB("warehouse_required")}</p>
            )}
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setCbOpen(false)}>{t("ui__отмена_987b33c6")}</Button>
            <Button
              type="button"
              onClick={saveCashbox}
              disabled={!cbEditId && !cbForm.warehouse_id}
            >
              {t("ui__сохранить_74ea58b6")}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={mvOpen} onClose={() => setMvOpen(false)} title={t("ui__кассовая_операция_99c12976")}>
        <div className="space-y-3">
          <Field label={t("ui__касса_c85fd621")} required>
            <select className={input} value={mvForm.cashbox_id || ""}
              onChange={(e) => setMvForm({ ...mvForm, cashbox_id: e.target.value ? Number(e.target.value) : null })}>
              <option value="">{t("ui__выбрать_fbbc1d13")}</option>
              {boxes.map((b) => <option key={b.id} value={b.id}>{b.name} ({curCode(b.currency_id)})</option>)}
            </select>
          </Field>
          <Field label={t("ui__тип_операции_43ca5509")} required>
            <div className="flex gap-2">
              <Button type="button" fullWidth variant={mvForm.direction === "in" ? "success" : "outline"}
                onClick={() => setMvForm({ ...mvForm, direction: "in" })}>
                {t("ui__приход_ebf29487")}
              </Button>
              <Button type="button" fullWidth variant={mvForm.direction === "out" ? "danger" : "outline"}
                onClick={() => setMvForm({ ...mvForm, direction: "out" })}>
                {t("ui__расход_6068400a")}
              </Button>
            </div>
          </Field>
          <Field label={t("ui__сумма_cf59ebf9")} required>
            <input type="number" step="0.01" className={input} value={mvForm.amount}
              onChange={(e) => setMvForm({ ...mvForm, amount: e.target.value })} />
          </Field>
          <Field label={t("ui__описание_38ca0af8")}>
            <textarea className={input} rows={2} value={mvForm.description}
              onChange={(e) => setMvForm({ ...mvForm, description: e.target.value })} />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setMvOpen(false)}>{t("ui__отмена_987b33c6")}</Button>
            <Button type="button" onClick={saveMovement}>{t("ui__провести_569058f4")}</Button>
          </div>
        </div>
      </Modal>

      <Modal open={trOpen} onClose={() => setTrOpen(false)} title={t("ui__перевод_между_кассами_22ce5c31")}>
        <div className="space-y-3">
          <Field label={t("ui__откуда_2043c6e6")} required>
            <select className={input} value={trForm.from_cashbox_id || ""}
              onChange={(e) => setTrForm({ ...trForm, from_cashbox_id: e.target.value ? Number(e.target.value) : null })}>
              <option value="">{t("ui__касса_51879a03")}</option>
              {boxes.map((b) => <option key={b.id} value={b.id}>{t("ui__b_name_баланс_fmt_b_balance_7f5a7bba")}</option>)}
            </select>
          </Field>
          <Field label={t("ui__куда_b60bd4b1")} required>
            <select className={input} value={trForm.to_cashbox_id || ""}
              onChange={(e) => setTrForm({ ...trForm, to_cashbox_id: e.target.value ? Number(e.target.value) : null })}>
              <option value="">{t("ui__касса_51879a03")}</option>
              {boxes.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </Field>
          <Field label={t("ui__сумма_cf59ebf9")} required>
            <input type="number" step="0.01" className={input} value={trForm.amount}
              onChange={(e) => setTrForm({ ...trForm, amount: e.target.value })} />
          </Field>
          <Field label={t("ui__описание_38ca0af8")}>
            <input className={input} value={trForm.description}
              onChange={(e) => setTrForm({ ...trForm, description: e.target.value })} />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setTrOpen(false)}>{t("ui__отмена_987b33c6")}</Button>
            <Button type="button" onClick={saveTransfer}>{t("ui__перевести_844df3cf")}</Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!cbDelTarget}
        onClose={() => setCbDelTarget(null)}
        onConfirm={delCashbox}
        title="Kassani yopish"
        message={cbDelTarget ? `«${cbDelTarget.name}» kassasi yopilsinmi?` : ""}
        confirmLabel="Yopish"
        variant="danger"
      />
    </div>
  );
}
