"use client";

import { useEffect, useState } from "react";
import { Building2, Save, Users, Package, ShoppingCart, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/api-error";
import { PageHeader } from "@/components/ui/page-header";
import { Field, input } from "@/components/ui/modal";
import { Card, CardHeader, CardBody, CardFooter } from "@/components/ui/card";
import { StatWidget } from "@/components/ui/stat-widget";
import { Button } from "@/components/ui/button";

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
        <Card className="p-10 text-center text-ink-400">Yuklanmoqda...</Card>
      )}

      {!loading && org && (
        <>
          {/* Stats cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatWidget icon={Users} label="Foydalanuvchi" value={org.user_count} color="brand" mono />
            <StatWidget icon={UserCheck} label="Mijoz" value={org.customer_count} color="info" mono />
            <StatWidget icon={Package} label="Mahsulot" value={org.product_count} color="warn" mono />
            <StatWidget icon={ShoppingCart} label="Sotuv" value={org.sale_count} color="success" mono />
          </div>

          {/* Form */}
          <Card padding="none">
            <CardHeader>
              <div className="flex items-center gap-2 text-ink-900 dark:text-ink-100">
                <Building2 size={16} />
                <span className="font-semibold">Rekvizitlar</span>
              </div>
            </CardHeader>

            <CardBody className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                <p className="text-xs text-ink-500 mt-1">9 raqamli soliq raqami</p>
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
            </CardBody>

            <CardFooter className="flex justify-end">
              <Button onClick={save} disabled={saving} loading={saving} icon={Save}>
                {saving ? "Saqlanmoqda..." : "Saqlash"}
              </Button>
            </CardFooter>
          </Card>

          {/* Meta */}
          <div className="text-xs text-ink-500 dark:text-ink-400">
            ID: <span className="font-mono">{org.id}</span> • Yaratilgan:{" "}
            {new Date(org.created_at).toLocaleString("uz-Cyrl-UZ")}
          </div>
        </>
      )}
    </div>
  );
}
