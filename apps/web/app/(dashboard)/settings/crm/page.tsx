"use client";

import { useState } from "react";
import { SettingsForm } from "@/components/settings/SettingsForm";
import { useTranslations } from "next-intl";
import { Copy, Check } from "lucide-react";

const BOT_COMMANDS = [
  { cmd: "/buyurtma", descKey: "ui__telegram_cmd_buyurtma" },
  { cmd: "/qoldiq",   descKey: "ui__telegram_cmd_qoldiq" },
  { cmd: "/balans",   descKey: "ui__telegram_cmd_balans" },
  { cmd: "/yordam",   descKey: "ui__telegram_cmd_yordam" },
] as const;

function CopyButton({ text }: { text: string }) {
  const t = useTranslations("ui");
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <button
      onClick={handleCopy}
      title={copied ? t("ui__telegram_copied") : t("ui__telegram_copy")}
      className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
    >
      {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
    </button>
  );
}

function BotCommandsSection() {
  const t = useTranslations("ui");
  return (
    <div className="bg-white border rounded-lg shadow-sm p-6 space-y-3">
      <h3 className="text-sm font-semibold text-slate-700">
        {t("ui__telegram_bot_commands_title")}
      </h3>
      <p className="text-xs text-slate-500">{t("ui__telegram_start_hint")}</p>
      <ul className="divide-y divide-slate-100">
        {BOT_COMMANDS.map(({ cmd, descKey }) => (
          <li key={cmd} className="flex items-center justify-between py-2 gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <code className="text-sm font-mono bg-slate-100 px-2 py-0.5 rounded text-emerald-700 shrink-0">
                {cmd}
              </code>
              <span className="text-sm text-slate-600 truncate">
                {t(descKey as any)}
              </span>
            </div>
            <CopyButton text={cmd} />
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Page() {
  const t = useTranslations("ui");
  return (
    <div className="space-y-6 max-w-2xl">
      <SettingsForm
        title={t("ui__crm_настройки_cfa1bb13")}
        description={t("ui__интеграции_crm_telegram_бот_те_843da679")}
        settingsKey="crm"
        fields={[
          { key: "telegram_bot_token", label: "Telegram bot token", type: "password",
            placeholder: "123456:ABCD...",
            help: "Bot yarating: @BotFather orqali token oling" },
          { key: "telegram_channel_id", label: t("ui__telegram_канал_id_66bc5246"),
            placeholder: "-100xxxxxxxxxx",
            help: "Sotuv xabarnomalari kanali" },
          { key: "notify_on_sale", label: t("ui__уведомлять_о_продажах_d0208e6b"), type: "boolean" },
          { key: "notify_on_low_stock", label: t("ui__уведомлять_о_низких_остатках_28bb989c"), type: "boolean" },
          { key: "default_tags", label: t("ui__теги_по_умолчанию_через_запяту_c7f448e2"),
            placeholder: "yangi, VIP, ulgurji" },
        ]}
      />
      <BotCommandsSection />
    </div>
  );
}
