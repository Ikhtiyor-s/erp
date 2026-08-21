"use client";

import Link from "next/link";
import { Users, Shield, Building2, Activity, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";

const CARDS = [
  {
    href: "/admin/users",
    icon: Users,
    title: "Foydalanuvchilar",
    description: "Tashkilot xodimlarini boshqarish, rol biriktirish, qo'shish/o'chirish",
  },
  {
    href: "/admin/roles",
    icon: Shield,
    title: "Rollar",
    description: "Tizim rollarini sozlash va custom rollar yaratish",
  },
  {
    href: "/admin/organization",
    icon: Building2,
    title: "Tashkilot",
    description: "Tashkilot rekvizitlari (STIR, manzil, logo) va statistikasi",
  },
  {
    href: "/admin/audit-log",
    icon: Activity,
    title: "Audit jurnali",
    description: "Tizimdagi barcha o'zgarishlar tarixi",
  },
];

export default function AdminIndexPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Admin panel"
        description="Tashkilot, foydalanuvchilar va ruxsatlarni boshqarish markazi"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {CARDS.map((c) => {
          const Icon = c.icon;
          return (
            <Link
              key={c.href}
              href={c.href}
              className="group bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4 hover:border-brand-500 hover:shadow-md transition-all"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="w-10 h-10 rounded-lg bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 flex items-center justify-center">
                  <Icon size={18} />
                </div>
                <ChevronRight
                  size={14}
                  className="text-slate-300 group-hover:text-brand-600 group-hover:translate-x-0.5 transition-transform"
                />
              </div>
              <div className="font-semibold text-slate-900 dark:text-slate-100 text-sm">
                {c.title}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                {c.description}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
