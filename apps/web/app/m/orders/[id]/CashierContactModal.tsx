"use client";

import { useEffect, useState } from "react";
import { Phone, Send, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { Modal } from "@/components/ui/modal";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/api-error";

type Message = {
  id: string;
  from_user_name: string;
  kind: "message" | "call";
  body: string | null;
  created_at: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  orderId: string;
  productName: string;
  onNotFound: () => void;
};

function fmtTime(iso: string) {
  try {
    return new Date(iso).toLocaleString("uz-Cyrl-UZ", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return iso;
  }
}

export function CashierContactModal({ open, onClose, orderId, productName, onNotFound }: Props) {
  const [body, setBody] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open) return;
    setBody("");
    setLoadingMsgs(true);
    api
      .get<Message[]>(`/orders/${orderId}/pick/messages`)
      .then((r) => setMessages(r.data || []))
      .catch(() => setMessages([]))
      .finally(() => setLoadingMsgs(false));
  }, [open, orderId]);

  async function send(kind: "message" | "call") {
    if (kind === "message" && !body.trim()) {
      toast.error("Xabar matni bo'sh bo'lishi mumkin emas.");
      return;
    }
    setSending(true);
    try {
      const payload: { kind: string; body?: string } = { kind };
      if (kind === "message") payload.body = body.trim();
      await api.post(`/orders/${orderId}/pick/messages`, payload);
      toast.success(kind === "message" ? "Xabar yuborildi" : "Qo'ng'iroq qayd etildi");
      onClose();
    } catch (e) {
      toast.error(getErrorMessage(e, "Xabar yuborib bo'lmadi"));
    } finally {
      setSending(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={`Kassirga murojaat — ${productName}`} size="md">
      <div className="p-4 space-y-4">
        {loadingMsgs ? (
          <div className="py-4 text-center text-sm text-slate-400">Yuklanmoqda...</div>
        ) : messages.length > 0 ? (
          <div className="space-y-2 max-h-40 overflow-y-auto">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Xabarlar tarixi</p>
            {messages.map((m) => (
              <div key={m.id} className="bg-slate-50 dark:bg-slate-800 rounded-lg px-3 py-2">
                <div className="flex items-center gap-1.5 mb-0.5">
                  {m.kind === "call" ? (
                    <Phone size={12} className="text-amber-500" />
                  ) : (
                    <MessageSquare size={12} className="text-brand-500" />
                  )}
                  <span className="text-[11px] font-medium text-slate-700 dark:text-slate-300">
                    {m.from_user_name}
                  </span>
                  <span className="text-[10px] text-slate-400 ml-auto">{fmtTime(m.created_at)}</span>
                </div>
                {m.kind === "message" && m.body && (
                  <p className="text-xs text-slate-600 dark:text-slate-400">{m.body}</p>
                )}
                {m.kind === "call" && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">Qo'ng'iroq qayd etildi</p>
                )}
              </div>
            ))}
          </div>
        ) : null}

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
            Xabar
          </label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Xabar yozing..."
            rows={3}
            disabled={sending}
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-50"
          />
        </div>

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={() => send("message")}
            disabled={sending || !body.trim()}
            className="flex-1 min-h-[48px] flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 text-white font-medium text-sm rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send size={16} />
            Xabar yuborish
          </button>
          <button
            type="button"
            onClick={() => send("call")}
            disabled={sending}
            className="flex-1 min-h-[48px] flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 text-white font-medium text-sm rounded-lg disabled:opacity-50 transition-colors"
          >
            <Phone size={16} />
            Qo'ng'iroq qildim
          </button>
        </div>
      </div>
    </Modal>
  );
}
