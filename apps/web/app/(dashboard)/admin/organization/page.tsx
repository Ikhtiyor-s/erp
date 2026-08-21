"use client";

import { useEffect, useState } from "react";
import { Building2, Save, Users, Package, ShoppingCart, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/api-error";
import { PageHeader } from "@/components/ui/page-header";
import { Field, input } from "@/components/ui/modal";

type Org = {
  id: string;
  name: string;
  code: string;
  tin: string | null;
  address: string | null;
  phone: string | null;
  logo_url: string | null;
  is_active: boolean;
  created_at: string;
  user_count: number;
  customer_count: number;
  product_count: number;
  sale_count: number;
};

export default function AdminOrgPage() {
  const [org, setOrg] = useState<Org | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    tin: "",
    address: "",
    phone: "",
    logo_url: "",
  });

  async function load() {
    setLoading(true);
    try {
      const r = await api.get<Org>("/organizations/current");
      setOrg(r.data);
      setForm({
        name: r.data.name || "",
        tin: r.data.tin || "",
        address: r.data.address || "",
        phone: r.data.phone || "",
        logo_url: r.data.logo_url || "",
      });
    } catch (e) {
      toast.error(getErrorMessage(e, "Yuklab bo'lmadi"));
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    if (!form.name.trim()) {
      toast.error("Tashkilot nomi shart");
      return;
    }
    setSaving(true);
    try {
      await api.put("/organizations/current", {
        name: form.name.trim(),
        tin: form.tin.trim() || null,
        address: form.address.trim() || null,
        phone: form.phone.trim() || null,
        logo_url: form.logo_url.trim() || null,
      });
      toast.success("Saqlandi");
      load();
    } catch (e) {
      toast.error(getErrorMessage(e, "Saqlab bo'lmadi"));
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tashkilot ma'lumotlari"
        description="Joriy tashkilot rekvizitlari va statistikasi"
      />

      {loading && (
        <div className="bg-white dark:bg-slate-800 rounded-lg p-10 text-center text-slate-400 border border-slate-200 dark:border-slate-700">
          Yuklanmoqda...
        </div>
      )}

      {!loading && org && (
        <>
          {/* Stats cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard icon={<Users size={16} />} label="Foydalanuvchi" value={org.user_count} />
            <StatCard icon={<UserCheck size={16} />} label="Mijoz" value={org.customer_count} />
            <StatCard icon={<Package size={16} />} label="Mahsulot" value={org.product_count} />
            <StatCard icon={<ShoppingCart size={16} />} label="Sotuv" value={org.sale_count} />
          </div>

          {/* Form */}
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm">
            <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 flex items-center gap-2 text-slate-900 dark:text-slate-100">
              <Building2 size={16} />
              <span className="font-semibold">Rekvizitlar</span>
            </div>

            <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Nomi" required>
                <input
                  type="text"
                  className={input}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </Field>
              <Field label="Kod">
                <input
                  type="text"
                  className={input}
                  value={org.code}
                  disabled
                  title="Tashkilot kodi o'zgartirilmaydi"
                />
              </Field>
              <Field label="STIR (TIN)">
                <input
                  type="text"
                  className={input}
                  value={form.tin}
                  onChange={(e) => setForm({ ...form, tin: e.target.value.replace(/\D/g, "").slice(0, 9) })}
                  placeholder="123456789"
                  pattern="\d{9}"
                  maxLength={9}
                />
                <p className="text-xs text-slate-500 mt-1">9 raqamli soliq raqami</p>
              </Field>
              <Field label="Telefon">
                <input
                  type="tel"
                  className={input}
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="+998 90 123 45 67"
                />
              </Field>
              <Field label="Manzil">
                <input
                  type="text"
                  className={input}
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  placeholder="Toshkent sh., Chilonzor t."
                />
              </Field>
              <Field label="Logo URL">
                <input
                  type="url"
                  className={input}
                  value={form.logo_url}
                  onChange={(e) => setForm({ ...form, logo_url: e.target.value })}
                  placeholder="https://..."
                />
              </Field>
            </div>

            <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-700 flex justify-end">
              <button
                onClick={save}
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-md text-sm font-medium disabled:opacity-50"
              >
                <Save size={14} />
                {saving ? "Saqlanmoqda..." : "Saqlash"}
              </button>
            </div>
          </div>

          {/* Meta */}
          <div className="text-xs text-slate-500 dark:text-slate-400">
            ID: <span className="font-mono">{org.id}</span> • Yaratilgan:{" "}
            {new Date(org.created_at).toLocaleString("uz-Cyrl-UZ")}
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({
  icon, label, value,
}: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-3">
      <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
        {icon}
        <span>{label}</span>
      </div>
      <div className="text-2xl font-bold font-mono text-slate-900 dark:text-slate-100 mt-1">
        {value.toLocaleString("ru-RU")}
      </div>
    </div>
  );
}
