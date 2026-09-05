"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Phone,
  Plus,
  Minus,
  MessageSquare,
  Send,
  ArrowDownLeft,
  ArrowUpRight,
} from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/api-error";

type Movement = {
  id: number;
  direction: "in" | "out";
  amount: string;
  description: string | null;
  movement_date: string;
  cashbox_name: string | null;
  currency_code: string | null;
  payment_type_name: string | null;
};

type CustomerHead = {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
};

type CustomerDetail = {
  head: CustomerHead;
  balance: { bal: string; cnt: number };
  movements: Movement[];
};

const fmt = (v: string | number) =>
  Number(v || 0).toLocaleString("ru-RU", { maximumFractionDigits: 0 });

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

type ModalKind = "add_debt" | "receive_payment" | "sms" | null;

function BalanceModal({
  kind,
  customerName,
  currentBalance,
  onClose,
  onDone,
  t,
}: {
  kind: "add_debt" | "receive_payment";
  customerName: string;
  currentBalance: number;
  onClose: () => void;
  onDone: () => void;
  t: ReturnType<typeof useTranslations>;
}) {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const params = useParams<{ id: string }>();

  async function submit() {
    const parsed = Number(amount.replace(/\s/g, "").replace(",", "."));
    if (!parsed || parsed <= 0) {
      toast.error("Summa 0 dan katta bo'lishi kerak");
      return;
    }
    let newBalance: number;
    if (kind === "add_debt") {
      newBalance = currentBalance - parsed;
    } else {
      newBalance = currentBalance + parsed;
    }
    setSaving(true);
    try {
      await api.post(`/customer/customers/${params.id}/set-balance`, {
        new_balance: newBalance,
        notes: note || null,
      });
      toast.success(kind === "add_debt" ? t("add_debt") : t("receive_payment"));
      onDone();
    } catch (e) {
      toast.error(getErrorMessage(e, t("err_save")));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end" onClick={onClose}>
      <div
        className="w-full bg-white dark:bg-slate-900 rounded-t-2xl p-5 space-y-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-12 h-1 bg-slate-200 dark:bg-slate-700 rounded-full mx-auto" />
        <h2 className="text-lg font-semibold text-center">
          {kind === "add_debt" ? t("add_debt") : t("receive_payment")}
        </h2>
        <p className="text-sm text-slate-500 text-center">{customerName}</p>

        <div>
          <label className="text-xs text-slate-500 mb-1 block">{t("amount")}</label>
          <input
            type="number"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
            className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-4 py-3 text-xl font-mono bg-white dark:bg-slate-800 outline-none focus:ring-2 focus:ring-brand-500"
            autoFocus
          />
        </div>

        <div>
          <label className="text-xs text-slate-500 mb-1 block">{t("note")}</label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t("note_placeholder")}
            className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2.5 text-sm bg-white dark:bg-slate-800 outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        <button
          onClick={submit}
          disabled={saving || !amount}
          className={`w-full min-h-[48px] rounded-xl font-semibold text-white transition-colors ${
            kind === "add_debt"
              ? "bg-rose-600 active:bg-rose-700 disabled:bg-rose-300"
              : "bg-emerald-600 active:bg-emerald-700 disabled:bg-emerald-300"
          }`}
        >
          {saving ? "..." : kind === "add_debt" ? t("add_debt") : t("receive_payment")}
        </button>
      </div>
    </div>
  );
}

function SmsModal({
  customerName,
  balance,
  customerId,
  onClose,
  t,
}: {
  customerName: string;
  balance: number;
  customerId: string;
  onClose: () => void;
  t: ReturnType<typeof useTranslations>;
}) {
  const template = t("sms_template")
    .replace("{name}", customerName)
    .replace("{amount}", fmt(Math.abs(balance)));
  const [text, setText] = useState(template);
  const [sending, setSending] = useState(false);

  async function send() {
    if (!text.trim()) return;
    setSending(true);
    try {
      await api.post("/integration/sms/debt-reminder", {
        customer_id: customerId,
        message: text,
      });
      toast.success(t("sent"));
      onClose();
    } catch (e: any) {
      const status = e?.response?.status;
      if (status === 404 || status === 503) {
        toast.error(t("sms_unavailable"));
      } else {
        toast.error(getErrorMessage(e, t("err_sms")));
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end" onClick={onClose}>
      <div
        className="w-full bg-white dark:bg-slate-900 rounded-t-2xl p-5 space-y-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-12 h-1 bg-slate-200 dark:bg-slate-700 rounded-full mx-auto" />
        <h2 className="text-lg font-semibold text-center">{t("send_sms")}</h2>
        <p className="text-sm text-slate-500 text-center">{customerName}</p>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2.5 text-sm bg-white dark:bg-slate-800 outline-none focus:ring-2 focus:ring-brand-500 resize-none"
        />

        <button
          onClick={send}
          disabled={sending || !text.trim()}
          className="w-full min-h-[48px] rounded-xl font-semibold text-white bg-brand-600 active:bg-brand-700 disabled:bg-brand-300 flex items-center justify-center gap-2 transition-colors"
        >
          <Send size={18} />
          {sending ? "..." : t("send")}
        </button>
      </div>
    </div>
  );
}

function SkeletonDetail() {
  return (
    <div className="p-4 space-y-4 animate-pulse">
      <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-1/2 mx-auto" />
      <div className="h-12 bg-slate-200 dark:bg-slate-700 rounded w-1/3 mx-auto" />
      <div className="grid grid-cols-2 gap-3">
        {[1, 2, 3, 4].map((n) => (
          <div key={n} className="h-12 bg-slate-200 dark:bg-slate-700 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

export default function DebtorDetailPage() {
  const t = useTranslations("mobile.debtors");
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<CustomerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<ModalKind>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get<CustomerDetail>(`/customer/customers/${params.id}`);
      setData(r.data);
    } catch (e) {
      toast.error(getErrorMessage(e, t("err_load_detail")));
    } finally {
      setLoading(false);
    }
  }, [params.id, t]);

  useEffect(() => {
    load();
  }, [load]);

  function handleDone() {
    setModal(null);
    load();
  }

  const balance = Number(data?.balance.bal ?? 0);
  const head = data?.head;
  const movements = data?.movements ?? [];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="sticky top-0 z-10 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 px-3 py-2.5 flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="p-1 text-slate-700 dark:text-slate-300 min-w-[44px] flex items-center"
        >
          <ArrowLeft size={22} />
        </button>
        <span className="font-semibold truncate flex-1">
          {loading ? "..." : head?.name ?? ""}
        </span>
      </div>

      {loading ? (
        <SkeletonDetail />
      ) : !data ? (
        <div className="py-20 text-center text-slate-400 text-sm">
          {t("err_load_detail")}
        </div>
      ) : (
        <div className="p-4 space-y-4 pb-8">
          {head?.phone && (
            <a
              href={`tel:${head.phone}`}
              className="flex items-center justify-center gap-2 text-sm text-brand-600"
            >
              <Phone size={15} />
              {head.phone}
            </a>
          )}

          <div className="text-center">
            <div
              className={`text-4xl font-bold font-mono ${
                balance < 0
                  ? "text-rose-600 dark:text-rose-400"
                  : balance > 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-slate-600 dark:text-slate-400"
              }`}
            >
              {balance < 0 ? "-" : balance > 0 ? "+" : ""}
              {fmt(Math.abs(balance))}
            </div>
            <div className="text-xs text-slate-400 mt-1">{t("debt_amount")}</div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setModal("add_debt")}
              className="min-h-[52px] bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800 rounded-xl font-medium text-sm flex flex-col items-center justify-center gap-1 active:bg-rose-100"
            >
              <Plus size={20} />
              {t("add_debt")}
            </button>
            <button
              onClick={() => setModal("receive_payment")}
              className="min-h-[52px] bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 rounded-xl font-medium text-sm flex flex-col items-center justify-center gap-1 active:bg-emerald-100"
            >
              <Minus size={20} />
              {t("receive_payment")}
            </button>
            {head?.phone && (
              <a
                href={`tel:${head.phone}`}
                className="min-h-[52px] bg-sky-50 dark:bg-sky-900/20 text-sky-700 dark:text-sky-400 border border-sky-200 dark:border-sky-800 rounded-xl font-medium text-sm flex flex-col items-center justify-center gap-1 active:bg-sky-100"
              >
                <Phone size={20} />
                {t("call")}
              </a>
            )}
            <button
              onClick={() => setModal("sms")}
              className="min-h-[52px] bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-400 border border-violet-200 dark:border-violet-800 rounded-xl font-medium text-sm flex flex-col items-center justify-center gap-1 active:bg-violet-100"
            >
              <MessageSquare size={20} />
              {t("send_sms")}
            </button>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
            <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 font-semibold text-sm">
              {t("txn_history")}
            </div>
            {movements.length === 0 ? (
              <div className="py-10 text-center text-slate-400 text-sm">
                {t("no_history")}
              </div>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-700">
                {movements.map((m) => (
                  <li key={m.id} className="px-4 py-3 flex items-start gap-3">
                    <div
                      className={`mt-0.5 p-1 rounded-full flex-shrink-0 ${
                        m.direction === "in"
                          ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600"
                          : "bg-rose-100 dark:bg-rose-900/30 text-rose-600"
                      }`}
                    >
                      {m.direction === "in" ? (
                        <ArrowDownLeft size={14} />
                      ) : (
                        <ArrowUpRight size={14} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-slate-400">{fmtDate(m.movement_date)}</div>
                      {m.description && (
                        <div className="text-xs text-slate-500 truncate mt-0.5">
                          {m.description}
                        </div>
                      )}
                    </div>
                    <div
                      className={`font-mono font-semibold text-sm flex-shrink-0 ${
                        m.direction === "in"
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-rose-600 dark:text-rose-400"
                      }`}
                    >
                      {m.direction === "in" ? "+" : "-"}
                      {fmt(m.amount)}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {modal === "add_debt" && head && (
        <BalanceModal
          kind="add_debt"
          customerName={head.name}
          currentBalance={balance}
          onClose={() => setModal(null)}
          onDone={handleDone}
          t={t}
        />
      )}
      {modal === "receive_payment" && head && (
        <BalanceModal
          kind="receive_payment"
          customerName={head.name}
          currentBalance={balance}
          onClose={() => setModal(null)}
          onDone={handleDone}
          t={t}
        />
      )}
      {modal === "sms" && head && (
        <SmsModal
          customerName={head.name}
          balance={balance}
          customerId={params.id}
          onClose={() => setModal(null)}
          t={t}
        />
      )}
    </div>
  );
}
