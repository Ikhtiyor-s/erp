"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Search } from "lucide-react";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/api-error";
import { Modal, Field, input } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useTranslations } from "next-intl";

type EntityType = "cashbox" | "customer" | "employee" | "supplier" | "person";

const ENDPOINTS: Record<EntityType, string> = {
  cashbox: "/finance/cashbox-set-balance",
  customer: "/finance/customer-set-balance",
  employee: "/finance/employee-set-balance",
  supplier: "/finance/supplier-set-balance",
  person: "/finance/person-set-balance",
};

type ListItem = { id: string | number; label: string; sub?: string };
type BalanceState = { balance: string };

const fmt = (v: unknown) =>
  Number(v || 0).toLocaleString("ru-RU", { maximumFractionDigits: 2 });

function SetBalanceContent() {
  const t = useTranslations("finance.set_balance");
  const router = useRouter();
  const params = useSearchParams();
  const tab = (params.get("tab") as EntityType) || "cashbox";

  const [list, setList] = useState<ListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<ListItem | null>(null);
  const [bal, setBal] = useState<BalanceState | null>(null);
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newBalance, setNewBalance] = useState("");
  const [note, setNote] = useState("");

  const TABS: { key: EntityType; label: string }[] = [
    { key: "cashbox", label: t("tab_cashbox") },
    { key: "customer", label: t("tab_customer") },
    { key: "employee", label: t("tab_employee") },
    { key: "supplier", label: t("tab_supplier") },
    { key: "person", label: t("tab_person") },
  ];

  function switchTab(key: EntityType) {
    router.replace(`/finance/set-balance?tab=${key}`);
    setSelected(null);
    setBal(null);
    setQ("");
    setList([]);
  }

  useEffect(() => {
    setSelected(null);
    setBal(null);
    setQ("");
    loadList("");
  }, [tab]);

  async function loadList(search: string) {
    setLoading(true);
    try {
      if (tab === "cashbox") {
        const { data } = await api.get<
          { id: number; name: string; balance: string; currency_id: number }[]
        >("/finance/cashboxes");
        setList(
          data.map((b) => ({ id: b.id, label: b.name, balance: b.balance }))
        );
      } else if (tab === "customer") {
        const url = search
          ? `/customer/customers?q=${encodeURIComponent(search)}`
          : "/customer/customers?limit=50";
        const { data } = await api.get<
          { id: string; name: string; phone?: string }[]
        >(url);
        setList(data.map((c) => ({ id: c.id, label: c.name, sub: c.phone })));
      } else if (tab === "employee") {
        const url = search
          ? `/hr/employees?q=${encodeURIComponent(search)}`
          : "/hr/employees";
        const { data } = await api.get<
          { id: string; full_name: string; phone?: string }[]
        >(url);
        setList(
          data.map((e) => ({ id: e.id, label: e.full_name, sub: e.phone }))
        );
      } else if (tab === "supplier") {
        const url = search
          ? `/supplier/suppliers?q=${encodeURIComponent(search)}`
          : "/supplier/suppliers";
        const { data } = await api.get<
          { id: string; name: string; phone?: string }[]
        >(url);
        setList(data.map((s) => ({ id: s.id, label: s.name, sub: s.phone })));
      } else {
        setList([]);
      }
    } catch {
      setList([]);
    } finally {
      setLoading(false);
    }
  }

  async function pickItem(item: ListItem) {
    setSelected(item);
    setNewBalance("");
    setBal(null);
    try {
      if (tab === "cashbox") {
        const { data } = await api.get<
          { id: number; name: string; balance: string }[]
        >("/finance/cashboxes");
        const found = data.find((b) => b.id === item.id);
        if (found) {
          setBal({ balance: found.balance });
          setNewBalance(String(found.balance));
        }
      } else if (tab === "customer") {
        const { data } = await api.get<BalanceState>(
          `/customer/customers/${item.id}/balance`
        );
        setBal(data);
        setNewBalance(String(data.balance));
      } else if (tab === "employee") {
        const r = await api.get<{ id: string; balance: string }[]>(
          "/finance/employee-balance"
        );
        const found = r.data.find((b) => b.id === item.id);
        setBal(found ?? { balance: "0" });
        setNewBalance(found ? String(found.balance) : "0");
      } else if (tab === "supplier") {
        const { data } = await api.get<BalanceState>(
          `/supplier/suppliers/${item.id}/balance`
        );
        setBal(data);
        setNewBalance(String(data.balance));
      }
    } catch {
      setBal({ balance: "0" });
      setNewBalance("0");
    }
  }

  function openModal() {
    if (!note.trim() && tab !== "cashbox") {
      setNote("");
    }
    setOpen(true);
  }

  function requestConfirm() {
    const v = Number(newBalance);
    if (Number.isNaN(v)) {
      toast.error(t("error"));
      return;
    }
    if (!note.trim()) {
      toast.error(t("note_required"));
      return;
    }
    setOpen(false);
    setConfirm(true);
  }

  async function doSave() {
    if (!selected) return;
    const v = Number(newBalance);
    setSaving(true);
    try {
      if (tab === "cashbox") {
        const { data } = await api.post(ENDPOINTS.cashbox, {
          cashbox_id: selected.id,
          new_balance: v,
          reason: note,
        });
        toast.success(
          `${t("success")}: ${fmt(data.old_balance)} → ${fmt(data.new_balance)}`
        );
        const { data: boxes } = await api.get<
          { id: number; name: string; balance: string }[]
        >("/finance/cashboxes");
        const refreshed = boxes.find((b) => b.id === selected.id);
        if (refreshed) setBal({ balance: refreshed.balance });
      } else if (tab === "customer") {
        const { data } = await api.post(
          `/customer/customers/${selected.id}/set-balance`,
          { new_balance: v, notes: note }
        );
        toast.success(
          `${t("success")}: ${fmt(data.old_balance)} → ${fmt(data.new_balance)}`
        );
        const r = await api.get<BalanceState>(
          `/customer/customers/${selected.id}/balance`
        );
        setBal(r.data);
      } else if (tab === "employee") {
        await api.post(ENDPOINTS.employee, {
          subject_type: "employee",
          subject_id: selected.id,
          plan_amount: Number(bal?.balance) || 0,
          fact_amount: v,
          notes: note,
        });
        toast.success(t("success"));
        const r = await api.get<{ id: string; balance: string }[]>(
          "/finance/employee-balance"
        );
        const found = r.data.find((b) => b.id === selected.id);
        setBal(found ?? { balance: String(v) });
      } else if (tab === "supplier") {
        const { data } = await api.post(
          `/supplier/suppliers/${selected.id}/set-balance`,
          { new_balance: v, notes: note }
        );
        toast.success(
          `${t("success")}: ${fmt(data.old_balance)} → ${fmt(data.new_balance)}`
        );
        const r = await api.get<BalanceState>(
          `/supplier/suppliers/${selected.id}/balance`
        );
        setBal(r.data);
      } else if (tab === "person") {
        await api.post(ENDPOINTS.person, {
          subject_type: "person",
          subject_id: selected.id,
          plan_amount: 0,
          fact_amount: v,
          notes: note,
        });
        toast.success(t("success"));
        setBal({ balance: String(v) });
      }
      setConfirm(false);
      setNote("");
    } catch (e) {
      toast.error(getErrorMessage(e, t("error")));
    } finally {
      setSaving(false);
    }
  }

  const isPersonTab = tab === "person";

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("description")} />

      <div
        role="alert"
        className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-900/20 px-4 py-3 text-sm text-amber-800 dark:text-amber-300"
      >
        <span className="shrink-0 mt-0.5">⚠</span>
        <span>{t("warning")}</span>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-slate-200 dark:border-slate-700">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => switchTab(key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
              tab === key
                ? "border-brand-600 text-brand-600 dark:border-brand-400 dark:text-brand-400"
                : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {isPersonTab ? (
        <PersonForm onSaved={() => {}} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-1 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm p-4 h-fit">
            <div className="relative mb-3">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                className={`${input} pl-9`}
                placeholder={t("select_entity")}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") loadList(q);
                }}
              />
            </div>
            {loading ? (
              <div className="text-center py-6 text-sm text-slate-400">
                ...
              </div>
            ) : (
              <ul className="divide-y divide-slate-200 dark:divide-slate-700 max-h-[60vh] overflow-auto -mx-2">
                {list.map((item) => (
                  <li key={item.id}>
                    <button
                      onClick={() => pickItem(item)}
                      className={`w-full text-left px-2 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 ${
                        selected?.id === item.id
                          ? "bg-brand-50 dark:bg-brand-900/30"
                          : ""
                      }`}
                    >
                      <div className="font-medium text-sm text-slate-900 dark:text-slate-100">
                        {item.label}
                      </div>
                      {item.sub && (
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {item.sub}
                        </div>
                      )}
                    </button>
                  </li>
                ))}
                {list.length === 0 && (
                  <li className="text-center py-6 text-sm text-slate-400">
                    —
                  </li>
                )}
              </ul>
            )}
          </div>

          <div className="md:col-span-2 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm p-6">
            {!selected ? (
              <div className="text-center text-slate-400 dark:text-slate-500 py-20">
                {t("select_entity")}
              </div>
            ) : (
              <div className="space-y-6">
                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                  {selected.label}
                </h2>
                <div>
                  <div className="text-sm text-slate-500 dark:text-slate-400">
                    {t("new_balance")}
                  </div>
                  <div
                    className={`text-4xl font-bold font-mono ${
                      Number(bal?.balance) < 0
                        ? "text-red-600 dark:text-red-400"
                        : Number(bal?.balance) > 0
                        ? "text-green-600 dark:text-green-400"
                        : "text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    {bal ? fmt(bal.balance) : "—"}
                  </div>
                </div>
                <button
                  onClick={openModal}
                  className="px-5 py-2 bg-brand-600 text-white rounded-md hover:bg-brand-700"
                >
                  {t("save")}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={t("confirm_title")}
      >
        <div className="space-y-3">
          <Field label={t("new_balance")} required>
            <input
              type="number"
              step="0.01"
              className={input}
              value={newBalance}
              onChange={(e) => setNewBalance(e.target.value)}
            />
          </Field>
          <Field label={t("note")} required>
            <input
              className={input}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t("note")}
            />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setOpen(false)}
              className="px-4 py-2 text-sm rounded-md border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700"
            >
              {t("cancel")}
            </button>
            <button
              onClick={requestConfirm}
              className="px-4 py-2 text-sm rounded-md bg-amber-600 text-white hover:bg-amber-700"
            >
              {t("save")}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={doSave}
        title={t("confirm_title")}
        message={t("confirm_message")}
        confirmLabel={t("save")}
        cancelLabel={t("cancel")}
        variant="warning"
        loading={saving}
      />
    </div>
  );
}

function PersonForm({ onSaved }: { onSaved: () => void }) {
  const t = useTranslations("finance.set_balance");
  const [form, setForm] = useState({
    subject_id: "",
    fact_amount: "0",
    notes: "",
  });
  const [confirm, setConfirm] = useState(false);
  const [saving, setSaving] = useState(false);

  function requestConfirm() {
    if (!form.subject_id.trim()) {
      toast.error(t("select_entity"));
      return;
    }
    if (!form.notes.trim()) {
      toast.error(t("note_required"));
      return;
    }
    setConfirm(true);
  }

  async function doSave() {
    setSaving(true);
    try {
      await api.post("/finance/entity-set-balance", {
        subject_type: "person",
        subject_id: form.subject_id,
        plan_amount: 0,
        fact_amount: Number(form.fact_amount) || 0,
        notes: form.notes,
      });
      toast.success(t("success"));
      setForm({ subject_id: "", fact_amount: "0", notes: "" });
      setConfirm(false);
      onSaved();
    } catch (e) {
      toast.error(getErrorMessage(e, t("error")));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm p-6 max-w-2xl space-y-4">
      <Field label={t("select_entity")} required>
        <input
          className={input}
          value={form.subject_id}
          onChange={(e) => setForm({ ...form, subject_id: e.target.value })}
          placeholder="UUID"
        />
      </Field>
      <Field label={t("new_balance")} required>
        <input
          type="number"
          step="0.01"
          className={input}
          value={form.fact_amount}
          onChange={(e) => setForm({ ...form, fact_amount: e.target.value })}
        />
      </Field>
      <Field label={t("note")} required>
        <textarea
          className={input}
          rows={2}
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
        />
      </Field>
      <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
        <button
          onClick={requestConfirm}
          className="px-5 py-2 bg-brand-600 text-white rounded-md hover:bg-brand-700"
        >
          {t("save")}
        </button>
      </div>

      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={doSave}
        title={t("confirm_title")}
        message={t("confirm_message")}
        confirmLabel={t("save")}
        cancelLabel={t("cancel")}
        variant="warning"
        loading={saving}
      />
    </div>
  );
}

export default function SetBalancePage() {
  return (
    <Suspense>
      <SetBalanceContent />
    </Suspense>
  );
}
