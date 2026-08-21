"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { menuTree } from "@/lib/menu.config";

type Item = { label: string; href: string; group?: string; groupKey?: string; i18nKey?: string };

export function CommandPalette() {
  const router = useRouter();
  const t = useTranslations("nav");
  const tc = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);

  function tr(key: string | undefined, fallback: string): string {
    if (!key) return fallback;
    try {
      const v = t(key as any);
      return v === key ? fallback : v;
    } catch {
      return fallback;
    }
  }

  const items = useMemo<Item[]>(() => {
    const acc: Item[] = [];
    for (const g of menuTree) {
      const groupLabel = tr(g.key, g.label);
      if (g.href)
        acc.push({
          label: groupLabel,
          href: g.href,
          group: groupLabel,
          groupKey: g.key,
        });
      if (g.children) {
        for (const c of g.children) {
          acc.push({
            label: tr(c.i18nKey, c.label),
            href: c.href,
            group: groupLabel,
            groupKey: g.key,
            i18nKey: c.i18nKey,
          });
        }
      }
    }
    return acc;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t]);

  const filtered = useMemo(() => {
    if (!q) return items.slice(0, 20);
    const lower = q.toLowerCase();
    return items
      .filter(
        (i) =>
          i.label.toLowerCase().includes(lower) ||
          (i.group || "").toLowerCase().includes(lower) ||
          i.href.toLowerCase().includes(lower)
      )
      .slice(0, 30);
  }, [items, q]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((x) => !x);
        setQ("");
        setActive(0);
        return;
      }
      if (!open) return;
      if (e.key === "Escape") {
        setOpen(false);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive((a) => Math.min(a + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive((a) => Math.max(a - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const target = filtered[active];
        if (target) {
          setOpen(false);
          router.push(target.href);
        }
      }
    }
    function onOpen() {
      setOpen(true);
      setQ("");
      setActive(0);
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("erp:open-palette", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("erp:open-palette", onOpen);
    };
  }, [open, filtered, active, router]);

  useEffect(() => {
    setActive(0);
  }, [q]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center pt-[15vh] p-4 bg-ink-900/30 dark:bg-ink-950/70 backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <div
        className="bg-white dark:bg-ink-900 text-ink-900 dark:text-ink-100 rounded-lg shadow-lg w-full max-w-xl border border-ink-200/60 dark:border-ink-800/60 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-4 py-3 border-b border-ink-200/60 dark:border-ink-800/60">
          <Search size={15} className="text-ink-400" strokeWidth={1.75} />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={tc("search") + "..."}
            className="flex-1 bg-transparent outline-none text-[13px] placeholder:text-ink-400 dark:placeholder:text-ink-600"
          />
          <kbd className="px-1.5 py-0.5 text-[10px] rounded bg-ink-100 dark:bg-ink-800 text-ink-400 font-mono">
            Esc
          </kbd>
        </div>

        <div className="max-h-96 overflow-auto py-1">
          {filtered.length === 0 ? (
            <div className="text-center text-[13px] text-ink-400 dark:text-ink-500 py-10">
              {tc("no_data")}
            </div>
          ) : (
            filtered.map((item, i) => (
              <button
                key={item.href + i}
                onClick={() => {
                  setOpen(false);
                  router.push(item.href);
                }}
                onMouseEnter={() => setActive(i)}
                className={`w-full text-left px-4 py-1.5 text-[13px] flex items-center justify-between gap-3 ${
                  i === active
                    ? "bg-brand-50 dark:bg-brand-900/30 text-brand-900 dark:text-brand-100"
                    : "text-ink-700 dark:text-ink-300"
                }`}
              >
                <span className="flex items-baseline gap-2 min-w-0">
                  <span className="text-[11px] text-ink-400 dark:text-ink-500 shrink-0">
                    {item.group}
                  </span>
                  <span className="truncate">{item.label}</span>
                </span>
                <span className="text-[10px] text-ink-400 dark:text-ink-600 font-mono truncate">
                  {item.href}
                </span>
              </button>
            ))
          )}
        </div>

        <div className="px-4 py-2 text-[10px] text-ink-400 dark:text-ink-600 flex items-center gap-3 border-t border-ink-200/60 dark:border-ink-800/60">
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 rounded bg-ink-100 dark:bg-ink-800 font-mono">
              ↑↓
            </kbd>
            navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 rounded bg-ink-100 dark:bg-ink-800 font-mono">
              ↵
            </kbd>
            open
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 rounded bg-ink-100 dark:bg-ink-800 font-mono">
              ⌘K
            </kbd>
            toggle
          </span>
        </div>
      </div>
    </div>
  );
}
