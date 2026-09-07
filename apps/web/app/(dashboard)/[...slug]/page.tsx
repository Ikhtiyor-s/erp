"use client";

import { use } from "react";
import { Construction, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { menuTree } from "@/lib/menu.config";
import { useTranslations } from "next-intl";
import { Card } from "@/components/ui/card";

function findMenu(href: string) {
  for (const g of menuTree) {
    if (g.href === href) return { parent: null, item: { label: g.label, href, description: undefined } };
    if (g.children) {
      const it = g.children.find((c) => c.href === href);
      if (it) return { parent: g, item: it };
    }
  }
  return null;
}

export default function CatchAllPage({ params }: { params: Promise<{ slug: string[] }> }) {
  const t = useTranslations("ui");
  const { slug } = use(params);
  const href = "/" + slug.join("/");
  const found = findMenu(href);

  const title = found?.item.label || slug[slug.length - 1];
  const parent = found?.parent;
  const description = found?.item.description;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 text-sm text-ink-500 dark:text-ink-400">
        {parent && (
          <>
            <span>{parent.label}</span>
            <span>/</span>
          </>
        )}
        <span className="text-ink-700 dark:text-ink-200">{title}</span>
      </div>

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{title}</h1>
        <Link
          href="/dashboard"
          className="flex items-center gap-2 text-sm text-ink-600 dark:text-ink-300 hover:text-brand-600"
        >
          <ArrowLeft size={16} /> {t("ui__на_главную_3ddda6d2")}
        </Link>
      </div>

      {description && <p className="text-ink-600 dark:text-ink-300">{description}</p>}

      <Card className="p-12 text-center">
        <Construction size={48} className="mx-auto text-warn-500 mb-4" />
        <h2 className="text-lg font-semibold mb-2">{t("ui__раздел_в_разработке_66ed13b2")}</h2>
        <p className="text-sm text-ink-500 dark:text-ink-400 mb-4">
          Эта страница ({href}) находится в плане разработки.
          <br />
          {t("ui__api_endpoint_и_ui_будут_добавл_3df152d7")}
        </p>
        <code className="inline-block bg-ink-100 text-ink-700 dark:bg-ink-800 dark:text-ink-200 px-3 py-1 rounded text-xs">
          {href}
        </code>
      </Card>

      {parent?.children && parent.children.length > 1 && (
        <Card>
          <h3 className="font-semibold mb-3 text-ink-700 dark:text-ink-200">Другие разделы «{parent.label}»</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {parent.children
              .filter((c) => c.href !== href)
              .map((c) => (
                <Link
                  key={c.href}
                  href={c.href}
                  className="block p-3 rounded-md border border-ink-200/60 dark:border-ink-800/60 hover:border-brand-300 hover:bg-brand-50/50 transition"
                >
                  <div className="font-medium text-sm">{c.label}</div>
                  {c.description && (
                    <div className="text-xs text-ink-500 dark:text-ink-400 mt-0.5">{c.description}</div>
                  )}
                </Link>
              ))}
          </div>
        </Card>
      )}
    </div>
  );
}
