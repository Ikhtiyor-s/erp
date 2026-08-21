"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ChevronRight, LogOut } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";
import { logout } from "@/lib/auth";
import { menuTree, type MenuGroup, type MenuChild } from "@/lib/menu.config";
import { usePermissions } from "@/lib/permissions";

function isActiveHref(path: string, href: string) {
  if (href === "/dashboard") return path === "/dashboard";
  return path === href || path.startsWith(href + "/");
}

function isGroupActive(path: string, group: MenuGroup) {
  if (group.href && isActiveHref(path, group.href)) return true;
  return group.children?.some((c) => isActiveHref(path, c.href)) ?? false;
}

/**
 * Derive a permission code from a menu group key or child href.
 * Maps URL segments to module names used in our permission catalog.
 */
function urlToPermission(href: string): string | null {
  const seg = href.split("/").filter(Boolean)[0];
  if (!seg) return null;
  const mod: Record<string, string> = {
    dashboard: "statistics.view",
    sale: "sale.view",
    finance: "finance.view",
    warehouse: "warehouse.view",
    customer: "customer.view",
    supplier: "supplier.view",
    supply: "supplier.view",
    logistics: "sale.view",
    manufacturing: "manufacturing.view",
    hr: "hr.view",
    marketing: "marketing.view",
    reference: "reference.view",
    statistics: "statistics.view",
    settings: "settings.view",
    integration: "settings.integration",
    tools: "tools.view",
    tasks: "manufacturing.view",
    pos: "sale.create",
    assistant: "statistics.view", // anyone with stats can use AI
  };
  return mod[seg] || null;
}

export function Sidebar() {
  const path = usePathname();
  const t = useTranslations("nav");
  const { can, loading } = usePermissions();
  const [open, setOpen] = useState<Record<string, boolean>>({});

  // Filter menu tree by user permissions
  const filteredMenu = useMemo(() => {
    if (loading) return menuTree; // show all while loading to avoid flash

    const checkPerm = (perm: string | string[] | undefined, fallbackCode: string | null): boolean => {
      if (perm) {
        const codes = Array.isArray(perm) ? perm : [perm];
        return codes.some((c) => can(c));
      }
      if (fallbackCode) return can(fallbackCode);
      return true;
    };

    const out: MenuGroup[] = [];
    for (const g of menuTree) {
      const children = g.children?.filter((c) =>
        checkPerm(c.permission, urlToPermission(c.href))
      );
      if (g.children && (!children || children.length === 0)) continue;
      if (g.href && !checkPerm(g.permission, urlToPermission(g.href))) continue;
      out.push({ ...g, children });
    }
    return out;
  }, [loading, can]);

  useEffect(() => {
    const o: Record<string, boolean> = {};
    for (const g of filteredMenu) if (isGroupActive(path, g)) o[g.key] = true;
    setOpen((prev) => ({ ...prev, ...o }));
  }, [path]);

  function toggle(key: string) {
    setOpen((s) => ({ ...s, [key]: !s[key] }));
  }

  function tr(key: string | undefined, fallback: string): string {
    if (!key) return fallback;
    try {
      const v = t(key as any);
      return v === key ? fallback : v;
    } catch {
      return fallback;
    }
  }

  function groupLabel(g: MenuGroup): string {
    return tr(g.key, g.label);
  }

  function childLabel(c: MenuChild): string {
    return tr(c.i18nKey, c.label);
  }

  return (
    <aside className="w-56 bg-ink-50 dark:bg-ink-950 border-r border-ink-200/60 dark:border-ink-800/60 flex flex-col h-screen sticky top-0">
      {/* Logo: small, no gradient */}
      <div className="px-4 h-12 flex items-center">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-sm bg-brand-600 flex items-center justify-center text-white text-[10px] font-bold">
            A
          </div>
          <span className="text-[13px] font-semibold text-ink-900 dark:text-ink-100 tracking-tight">
            Aniq
          </span>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 pb-2 text-[13px] space-y-px">
        {filteredMenu.map((g) => {
          const Icon = g.icon;
          const active = isGroupActive(path, g);
          const label = groupLabel(g);

          if (!g.children) {
            return (
              <Link
                key={g.key}
                href={g.href || "#"}
                className={cn(
                  "flex items-center gap-2.5 px-2.5 py-1.5 rounded-md transition-colors",
                  active
                    ? "bg-ink-200/60 dark:bg-ink-800/80 text-ink-900 dark:text-ink-50 font-medium"
                    : "text-ink-600 dark:text-ink-400 hover:bg-ink-200/40 dark:hover:bg-ink-800/40 hover:text-ink-900 dark:hover:text-ink-100"
                )}
              >
                <Icon size={15} strokeWidth={1.75} />
                <span>{label}</span>
              </Link>
            );
          }

          const isOpen = open[g.key] ?? false;
          return (
            <div key={g.key}>
              <button
                onClick={() => toggle(g.key)}
                className={cn(
                  "w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md transition-colors",
                  active
                    ? "text-ink-900 dark:text-ink-100 font-medium"
                    : "text-ink-600 dark:text-ink-400 hover:bg-ink-200/40 dark:hover:bg-ink-800/40 hover:text-ink-900 dark:hover:text-ink-100"
                )}
              >
                <Icon size={15} strokeWidth={1.75} />
                <span className="flex-1 text-left">{label}</span>
                <ChevronRight
                  size={12}
                  className={cn(
                    "transition-transform opacity-60",
                    isOpen && "rotate-90"
                  )}
                />
              </button>

              {isOpen && (
                <div className="ml-3 pl-3 border-l border-ink-200/60 dark:border-ink-800/60 my-0.5 space-y-px">
                  {g.children.map((c) => {
                    const a = isActiveHref(path, c.href);
                    return (
                      <Link
                        key={c.href}
                        href={c.href}
                        title={c.description}
                        className={cn(
                          "block px-2.5 py-1 rounded-md text-[12.5px] transition-colors",
                          a
                            ? "text-ink-900 dark:text-ink-50 bg-ink-200/60 dark:bg-ink-800/80 font-medium"
                            : "text-ink-500 dark:text-ink-500 hover:bg-ink-200/40 dark:hover:bg-ink-800/40 hover:text-ink-900 dark:hover:text-ink-100"
                        )}
                      >
                        {childLabel(c)}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <button
        onClick={logout}
        className="flex items-center gap-2.5 px-3.5 py-2 mx-2 mb-2 rounded-md text-[13px] text-ink-500 dark:text-ink-500 hover:bg-ink-200/40 dark:hover:bg-ink-800/40 hover:text-ink-900 dark:hover:text-ink-100 transition-colors"
      >
        <LogOut size={15} strokeWidth={1.75} />
        {t("logout")}
      </button>
    </aside>
  );
}
