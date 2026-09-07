"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles, Send, Loader2, AlertCircle, Wrench } from "lucide-react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { input as inputClass } from "@/components/ui/modal";

type Msg = { role: "user" | "assistant"; content: string; tool_calls?: any[] };

type StatusResp = {
  anthropic_configured: boolean;
  openai_configured: boolean;
  tools_count: number;
  tools: string[];
};

const SUGGESTIONS = [
  "Oxirgi 30 kunda nechta sotuv qildim?",
  "Top 5 mijozim kim?",
  "Eng ko'p sotilgan mahsulotlar qaysilari?",
  "Past qoldiqdagi mahsulotlar bormi?",
  "Kim menga qancha qarzdor?",
  "Kassalarimda hozir qancha pul bor?",
];

export default function AssistantPage() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<StatusResp | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.get<StatusResp>("/assistant/status").then((r) => setStatus(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  async function send(content?: string) {
    const text = (content ?? input).trim();
    if (!text || sending) return;
    setInput("");
    const next: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setSending(true);
    try {
      const { data } = await api.post<{ reply: string; tool_calls?: any[]; provider: string }>(
        "/assistant/chat",
        { messages: next.map((m) => ({ role: m.role, content: m.content })) }
      );
      setMessages([...next, { role: "assistant", content: data.reply, tool_calls: data.tool_calls }]);
    } catch (e: any) {
      setMessages([
        ...next,
        {
          role: "assistant",
          content: `Xato: ${e?.response?.data?.detail || e.message || "noma'lum"}`,
        },
      ]);
    } finally {
      setSending(false);
    }
  }

  function reset() {
    setMessages([]);
    setInput("");
  }

  const anyProvider = status?.anthropic_configured || status?.openai_configured;

  return (
    <div className="space-y-4 h-[calc(100vh-7rem)] flex flex-col">
      <PageHeader
        title="AI assistent"
        description="Tabiiy tilda biznes savollar bering — sotuv, mijoz, qoldiq, kassa ma'lumotlari bilan ishlaydi"
      />

      {/* Provider status banner */}
      {status && !anyProvider && (
        <div className="bg-warn-50 dark:bg-warn-500/15 border border-warn-500/20 rounded-xl p-3 flex items-start gap-2 text-sm">
          <AlertCircle size={16} className="text-warn-600 dark:text-warn-500 mt-0.5 flex-shrink-0" />
          <div className="text-warn-700 dark:text-warn-500">
            <strong>Demo rejim:</strong> AI provider sozlanmagan. Real javoblar uchun{" "}
            <code className="bg-warn-500/10 dark:bg-warn-500/20 px-1 rounded">ANTHROPIC_API_KEY</code>{" "}
            yoki{" "}
            <code className="bg-warn-500/10 dark:bg-warn-500/20 px-1 rounded">OPENAI_API_KEY</code>{" "}
            o'rnating <code>apps/api/.env</code> faylida va API'ni qayta ishga tushiring.
            Demo rejimda ham {status.tools_count} ta ma'lumot funksiyasi ishlaydi.
          </div>
        </div>
      )}
      {status && anyProvider && (
        <div className="text-xs text-ink-500 dark:text-ink-400 flex items-center gap-2">
          <Wrench size={12} />
          {status.anthropic_configured ? "Anthropic Claude" : "OpenAI"} faol —{" "}
          {status.tools_count} ta tool ulangan ({status.tools.slice(0, 3).join(", ")}, ...)
        </div>
      )}

      {/* Chat history */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto bg-white dark:bg-ink-950 border border-ink-200/60 dark:border-ink-800/60 rounded-xl shadow-sm p-4 space-y-4"
      >
        {messages.length === 0 && (
          <div className="text-center py-12 text-ink-400 dark:text-ink-500">
            <Sparkles size={32} className="mx-auto mb-3 text-brand-400" />
            <div className="font-medium text-ink-600 dark:text-ink-300 mb-1">
              Aniq ERP AI assistentiga xush kelibsiz
            </div>
            <div className="text-sm">Quyidagi savollardan birini sinab ko'ring:</div>
            <div className="mt-4 flex flex-wrap justify-center gap-2 max-w-2xl mx-auto">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="px-3 py-1.5 bg-ink-100 hover:bg-brand-100 dark:bg-ink-800 dark:hover:bg-brand-900/40 text-ink-700 dark:text-ink-200 text-xs rounded-full transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-2xl px-4 py-3 rounded-2xl text-sm ${
                m.role === "user"
                  ? "bg-brand-600 text-white rounded-br-sm"
                  : "bg-ink-100 dark:bg-ink-800 text-ink-900 dark:text-ink-100 rounded-bl-sm"
              }`}
            >
              <div
                className="whitespace-pre-wrap"
                dangerouslySetInnerHTML={{ __html: formatAssistantHtml(m.content) }}
              />
              {m.tool_calls && m.tool_calls.length > 0 && (
                <div className="mt-2 pt-2 border-t border-ink-300/40 dark:border-ink-600 text-xs opacity-70 flex flex-wrap gap-1">
                  <Wrench size={11} className="inline" />
                  {m.tool_calls.map((tc: any, j: number) => (
                    <span key={j} className="px-1.5 py-0.5 bg-ink-200/50 dark:bg-ink-600/50 rounded">
                      {typeof tc === "string" ? tc : tc.tool || JSON.stringify(tc)}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex justify-start">
            <div className="px-4 py-3 rounded-2xl bg-ink-100 dark:bg-ink-800 text-ink-500 dark:text-ink-400 text-sm flex items-center gap-2">
              <Loader2 size={14} className="animate-spin" /> O'ylanmoqda...
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="flex gap-2">
        {messages.length > 0 && (
          <Button variant="outline" onClick={reset}>
            Yangi suhbat
          </Button>
        )}
        <input
          className={`flex-1 ${inputClass}`}
          placeholder="Savolingizni yozing..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          disabled={sending}
        />
        <Button onClick={() => send()} disabled={sending || !input.trim()} icon={Send}>
          Yuborish
        </Button>
      </div>
    </div>
  );
}

/**
 * Naive markdown-like formatting for assistant replies:
 * - <b>...</b> stays
 * - ```json blocks → <pre>
 * - Newlines → <br>
 */
function formatAssistantHtml(text: string): string {
  // Escape HTML except for our whitelisted tags
  let out = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  // Restore <b> and <i>
  out = out.replace(/&lt;b&gt;/g, "<b>").replace(/&lt;\/b&gt;/g, "</b>");
  out = out.replace(/&lt;i&gt;/g, "<i>").replace(/&lt;\/i&gt;/g, "</i>");
  out = out.replace(/&lt;code&gt;/g, "<code class='bg-black/10 dark:bg-white/10 px-1 rounded'>");
  out = out.replace(/&lt;\/code&gt;/g, "</code>");
  // Code blocks ```...```
  out = out.replace(/```(\w+)?\n([\s\S]*?)```/g,
    (_m, _lang, code) =>
      `<pre class="bg-ink-900 text-ink-50 p-3 rounded text-xs overflow-x-auto my-2">${code}</pre>`);
  // Inline code `...`
  out = out.replace(/`([^`]+)`/g, "<code class='bg-black/10 dark:bg-white/10 px-1 rounded'>$1</code>");
  // **bold**
  out = out.replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>");
  // Newlines → <br>
  out = out.replace(/\n/g, "<br>");
  return out;
}
