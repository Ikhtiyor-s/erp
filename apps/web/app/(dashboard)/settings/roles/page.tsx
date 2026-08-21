"use client";

import { useEffect, useState } from "react";
import { Shield, Save, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/api-error";
import { PageHeader } from "@/components/ui/page-header";

type Role = {
  id: number;
  code: string;
  name: string;
  description: string | null;
  perm_count: number;
};

type Permission = {
  id: number;
  code: string;
  module: string;
  action: string;
};

const ROLE_COLORS: Record<string, string> = {
  superadmin: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  admin: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  manager: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  accountant: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  cashier: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  viewer: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
};

const MODULE_LABELS: Record<string, string> = {
  sale: "Sotuv",
  warehouse: "Ombor",
  finance: "Moliya",
  customer: "Mijozlar",
  supplier: "Yetkazib beruvchilar",
  hr: "Xodimlar",
  manufacturing: "Ishlab chiqarish",
  marketing: "Marketing",
  reference: "Ma'lumotnoma",
  settings: "Sozlamalar",
  tools: "Asboblar",
  audit: "Audit",
  rbac: "Ruxsatlar",
  org: "Tashkilot",
  statistics: "Statistika",
};

const ACTION_LABELS: Record<string, string> = {
  view: "Ko'rish",
  create: "Yaratish",
  update: "O'zgartirish",
  delete: "O'chirish",
  export: "Eksport",
  approve: "Tasdiqlash",
  cancel: "Bekor qilish",
  pay: "To'lov",
  refund: "Qaytarish",
  discount: "Chegirma",
  inventory: "Inventarizatsiya",
  write_off: "Hisobdan chiqarish",
  transfer: "Ko'chirish",
  income: "Kirim",
  cashbox_manage: "Kassa boshqaruv",
  set_balance: "Balans o'rnatish",
  salary: "Ish haqi",
  subscription: "Obuna",
  integration: "Integratsiya",
  price_bulk: "Massali narx",
  manage: "Boshqarish",
  manage_users: "Foydalanuvchi boshqaruv",
};

export default function RolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);
  const [selectedRolePerms, setSelectedRolePerms] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  async function loadAll() {
    setLoading(true);
    try {
      const [r, p] = await Promise.all([
        api.get<Role[]>("/rbac/roles"),
        api.get<Permission[]>("/rbac/permissions"),
      ]);
      setRoles(r.data);
      setPermissions(p.data);
    } catch (e: any) {
      toast.error(getErrorMessage(e, "Yuklab bo'lmadi"));
    } finally {
      setLoading(false);
    }
  }

  async function loadRolePerms(roleId: number) {
    try {
      const { data } = await api.get<Permission[]>(`/rbac/roles/${roleId}/permissions`);
      setSelectedRolePerms(new Set(data.map((p) => p.id)));
    } catch {}
  }

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    if (selectedRoleId !== null) loadRolePerms(selectedRoleId);
  }, [selectedRoleId]);

  function togglePerm(id: number) {
    setSelectedRolePerms((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleModule(module: string, allIds: number[]) {
    setSelectedRolePerms((prev) => {
      const next = new Set(prev);
      const allSelected = allIds.every((id) => next.has(id));
      if (allSelected) allIds.forEach((id) => next.delete(id));
      else allIds.forEach((id) => next.add(id));
      return next;
    });
  }

  async function save() {
    if (selectedRoleId === null) return;
    setSaving(true);
    try {
      await api.put(`/rbac/roles/${selectedRoleId}/permissions`, {
        permission_ids: Array.from(selectedRolePerms),
      });
      toast.success("Saqlandi");
      loadAll();
    } catch (e: any) {
      toast.error(getErrorMessage(e, "Saqlashda xato"));
    } finally {
      setSaving(false);
    }
  }

  // Group permissions by module for display
  const byModule: Record<string, Permission[]> = {};
  for (const p of permissions) {
    (byModule[p.module] ||= []).push(p);
  }

  const selectedRole = roles.find((r) => r.id === selectedRoleId);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rollar va ruxsatlar"
        description="Foydalanuvchilarga rol biriktiring va har rol uchun ruxsatlarni sozlang"
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: roles list */}
        <div className="lg:col-span-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm">
          <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 font-semibold text-slate-900 dark:text-slate-100">
            Rollar
          </div>
          <div>
            {loading && (
              <div className="p-6 text-center text-slate-400">Yuklanmoqda...</div>
            )}
            {roles.map((r) => (
              <button
                key={r.id}
                onClick={() => setSelectedRoleId(r.id)}
                className={`w-full px-4 py-3 flex items-center justify-between border-l-2 hover:bg-slate-50 dark:hover:bg-slate-900/40 text-left ${
                  selectedRoleId === r.id
                    ? "border-brand-500 bg-brand-50/50 dark:bg-brand-900/20"
                    : "border-transparent"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-medium ${
                      ROLE_COLORS[r.code] || "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {r.code}
                  </span>
                  <div>
                    <div className="font-medium text-slate-900 dark:text-slate-100 text-sm">
                      {r.name}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {r.perm_count} ta ruxsat
                    </div>
                  </div>
                </div>
                <ChevronRight size={14} className="text-slate-400" />
              </button>
            ))}
          </div>
        </div>

        {/* Right: permissions matrix for selected role */}
        <div className="lg:col-span-8 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm">
          {!selectedRole && (
            <div className="p-10 text-center text-slate-400">
              <Shield size={32} className="mx-auto mb-2 opacity-30" />
              Chap tomondan rolni tanlang
            </div>
          )}
          {selectedRole && (
            <>
              <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-slate-900 dark:text-slate-100">
                    {selectedRole.name} ({selectedRole.code})
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    Tanlangan: {selectedRolePerms.size} / {permissions.length}
                  </div>
                </div>
                <button
                  onClick={save}
                  disabled={saving || selectedRole.code === "superadmin"}
                  className="flex items-center gap-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-md text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  title={selectedRole.code === "superadmin" ? "Super Admin'ni o'zgartirish mumkin emas" : ""}
                >
                  <Save size={14} />
                  {saving ? "Saqlanmoqda..." : "Saqlash"}
                </button>
              </div>

              <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
                {Object.entries(byModule).map(([mod, perms]) => {
                  const allIds = perms.map((p) => p.id);
                  const allSelected = allIds.every((id) => selectedRolePerms.has(id));
                  const someSelected = allIds.some((id) => selectedRolePerms.has(id));
                  return (
                    <div key={mod} className="border border-slate-200 dark:border-slate-700 rounded-md">
                      <div className="px-3 py-2 bg-slate-50 dark:bg-slate-900/40 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={allSelected}
                            ref={(el) => {
                              if (el) el.indeterminate = !allSelected && someSelected;
                            }}
                            onChange={() => toggleModule(mod, allIds)}
                            disabled={selectedRole.code === "superadmin"}
                          />
                          <span className="font-medium text-slate-900 dark:text-slate-100 text-sm">
                            {MODULE_LABELS[mod] || mod}
                          </span>
                        </label>
                        <span className="text-xs text-slate-500">
                          {allIds.filter((id) => selectedRolePerms.has(id)).length}/{allIds.length}
                        </span>
                      </div>
                      <div className="p-3 grid grid-cols-2 md:grid-cols-3 gap-2">
                        {perms.map((p) => (
                          <label
                            key={p.id}
                            className="flex items-center gap-2 text-sm cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900/30 px-2 py-1 rounded"
                          >
                            <input
                              type="checkbox"
                              checked={selectedRolePerms.has(p.id)}
                              onChange={() => togglePerm(p.id)}
                              disabled={selectedRole.code === "superadmin"}
                            />
                            <span className="text-slate-700 dark:text-slate-300">
                              {ACTION_LABELS[p.action] || p.action}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
