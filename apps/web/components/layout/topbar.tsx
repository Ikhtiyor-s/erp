"use client";

import { useEffect, useState } from "react";
import { Moon, Sun, Monitor, Languages, ChevronDown, Search, Menu } from "lucide-react";
import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";
import { useLocale } from "@/i18n/locale-provider";
import { fetchMe, fetchMyOrgs } from "@/lib/auth";
import { useSidebar } from "./sidebar-context";

export function Topbar() {
  const tu = useTranslations("ui");
  const t = useTranslations("common");
  const { toggleMobile } = useSidebar();
  const [user, setUser] = useState<{ full_name?: string; email: string } | null>(
    null
  );
  const [orgs, setOrgs] = useState<Array<{ id: string; name: string }>>([]);
  const [activeOrg, setActiveOrg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const u = await fetchMe();
        setUser(u);
        const o = await fetchMyOrgs();
        setOrgs(o);
        const saved = localStorage.getItem("org_id");
        const def = saved || o[0]?.id;
        if (def) {
          localStorage.setItem("org_id", def);
          setActiveOrg(def);
        }
      } catch {}
    })();
  }, []);

  function changeOrg(id: string) {
    localStorage.setItem("org_id", id);
    setActiveOrg(id);
    window.location.reload();
  }

  function openPalette() {
    window.dispatchEvent(new CustomEvent("erp:open-palette"));
  }

  return (
    <header className="h-11 bg-white/80 dark:bg-ink-950/80 backdrop-blur border-b border-ink-200/60 dark:border-ink-800/60 flex items-center justify-between px-4 sticky top-0 z-10">
      <div className="flex items-center gap-2">
        <button
          onClick={toggleMobile}
          className="md:hidden p-1.5 rounded hover:bg-ink-100 dark:hover:bg-ink-800 text-ink-600 dark:text-ink-300"
          aria-label="Menu"
        >
          <Menu size={18} />
        </button>
        {orgs.length > 0 && (
          <select
            value={activeOrg ?? ""}
            onChange={(e) => changeOrg(e.target.value)}
            className="border-0 rounded text-[13px] bg-transparent text-ink-700 dark:text-ink-200 hover:bg-ink-100 dark:hover:bg-ink-800 px-2 py-1 cursor-pointer transition-colors"
          >
            {orgs.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={openPalette}
          className="inline-flex items-center gap-2 px-2.5 py-1 rounded text-[12.5px] text-ink-500 dark:text-ink-400 hover:bg-ink-100 dark:hover:bg-ink-800 hover:text-ink-900 dark:hover:text-ink-100 transition-colors"
          title={`${t("search")} (⌘K)`}
        >
          <Search size={13} strokeWidth={1.75} />
          <span className="hidden sm:inline">{t("search")}</span>
          <kbd className="hidden sm:inline px-1 py-px text-[10px] rounded bg-ink-200/60 dark:bg-ink-800 font-mono">
            ⌘K
          </kbd>
        </button>
        <LocaleSwitcher />
        <ThemeToggle />
        <div className="text-[12.5px] text-ink-500 dark:text-ink-400 hidden md:block ml-2 pl-3 border-l border-ink-200/60 dark:border-ink-800/60">
          {user?.full_name || user?.email}
        </div>
      </div>
    </header>
  );
}

function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const t = useTranslations("theme");
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="w-7 h-7" />;

  const current = resolvedTheme;
  const Icon = current === "dark" ? Moon : Sun;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((s) => !s)}
        className="p-1.5 rounded hover:bg-ink-100 dark:hover:bg-ink-800 text-ink-500 dark:text-ink-400 hover:text-ink-900 dark:hover:text-ink-100"
        aria-label="Theme"
        title="Theme"
      >
        <Icon size={14} strokeWidth={1.75} />
      </button>
      {open && (
        <div
          className="absolute right-0 mt-1 w-32 bg-white dark:bg-ink-900 border border-ink-200/60 dark:border-ink-800 rounded-md shadow-md overflow-hidden z-20"
          onMouseLeave={() => setOpen(false)}
        >
          {[
            { v: "light", icon: Sun, label: t("light") },
            { v: "dark", icon: Moon, label: t("dark") },
            { v: "system", icon: Monitor, label: t("system") },
          ].map((o) => {
            const I = o.icon;
            return (
              <button
                key={o.v}
                onClick={() => {
                  setTheme(o.v);
                  setOpen(false);
                }}
                className={`w-full px-3 py-1.5 text-[12.5px] text-left flex items-center gap-2 hover:bg-ink-100 dark:hover:bg-ink-800 ${
                  theme === o.v
                    ? "text-brand-600 dark:text-brand-400 font-medium"
                    : "text-ink-700 dark:text-ink-200"
                }`}
              >
                <I size={12} /> {o.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function LocaleSwitcher() {
  const { locale, setLocale } = useLocale();
  const [open, setOpen] = useState(false);

  const langs: { v: "uz" | "ru" | "en"; label: string }[] = [
    { v: "uz", label: "UZ" },
    { v: "ru", label: "RU" },
    { v: "en", label: "EN" },
  ];
  const current = langs.find((l) => l.v === locale)!;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((s) => !s)}
        className="inline-flex items-center gap-1 px-1.5 py-1.5 rounded hover:bg-ink-100 dark:hover:bg-ink-800 text-ink-500 dark:text-ink-400 hover:text-ink-900 dark:hover:text-ink-100 text-[12.5px]"
        aria-label="Language"
        title="Language"
      >
        <Languages size={13} strokeWidth={1.75} />
        <span className="hidden sm:inline uppercase">{current.v}</span>
        <ChevronDown size={10} className="opacity-50" />
      </button>
      {open && (
        <div
          className="absolute right-0 mt-1 w-36 bg-white dark:bg-ink-900 border border-ink-200/60 dark:border-ink-800 rounded-md shadow-md overflow-hidden z-20"
          onMouseLeave={() => setOpen(false)}
        >
          {langs.map((l) => (
            <button
              key={l.v}
              onClick={() => {
                setLocale(l.v);
                setOpen(false);
              }}
              className={`w-full px-3 py-1.5 text-[12.5px] text-left hover:bg-ink-100 dark:hover:bg-ink-800 ${
                l.v === locale
                  ? "text-brand-600 dark:text-brand-400 font-medium"
                  : "text-ink-700 dark:text-ink-200"
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
