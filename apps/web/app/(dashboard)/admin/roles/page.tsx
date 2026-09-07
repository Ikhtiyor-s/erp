"use client";

import { useEffect, useState } from "react";
import { Shield, Save, Plus, Trash2, Copy } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/api-error";
import { PageHeader } from "@/components/ui/page-header";
import { Modal, Field, input } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

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

const SYSTEM_ROLES = ["superadmin", "admin", "manager", "accountant", "cashier", "viewer"];

type RoleTone = "danger" | "purple" | "primary" | "warning" | "success" | "neutral";

const ROLE_TONE: Record<string, RoleTone> = {
  superadmin: "danger",
  admin: "purple",
  manager: "primary",
  accountant: "warning",
  cashier: "success",
  viewer: "neutral",
};

const MODULE_LABELS: Record<string, string> = {
  sale: "Sotuv", warehouse: "Ombor", finance: "Moliya", customer: "Mijozlar",
  supplier: "Yetkazib beruvchilar", hr: "Xodimlar", manufacturing: "Ishlab chiqarish",
  marketing: "Marketing", reference: "Ma'lumotnoma", settings: "Sozlamalar",
  tools: "Asboblar", audit: "Audit", rbac: "Ruxsatlar", org: "Tashkilot",
  statistics: "Statistika",
};

const ACTION_LABELS: Record<string, string> = {
  view: "Ko'rish", create: "Yaratish", update: "O'zgartirish", delete: "O'chirish",
  export: "Eksport", approve: "Tasdiqlash", cancel: "Bekor qilish", pay: "To'lov",
  refund: "Qaytarish", discount: "Chegirma", inventory: "Inventarizatsiya",
  write_off: "Hisobdan chiqarish", transfer: "Ko'chirish", income: "Kirim",
  cashbox_manage: "Kassa boshqaruv", set_balance: "Balans o'rnatish", salary: "Ish haqi",
  subscription: "Obuna", integration: "Integratsiya", price_bulk: "Massali narx",
  manage: "Boshqarish", manage_users: "Foydalanuvchi boshqaruv",
};

export default function AdminRolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);
  const [selectedRolePerms, setSelectedRolePerms] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const [createOpen, setCreateOpen] = useState(false);
  const [newRole, setNewRole] = useState({
    code: "",
    name: "",
    description: "",
    copy_from_role_id: 0,
  });
  const [creating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Role | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function loadAll() {
    setLoading(true);
    try {
      const [r, p] = await Promise.all([
        api.get<Role[]>("/rbac/roles"),
        api.get<Permission[]>("/rbac/permissions"),
      ]);
      setRoles(r.data);
      setPermissions(p.data);
    } catch (e) {
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

  useEffect(() => { loadAll(); }, []);
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

  function toggleModule(allIds: number[]) {
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
    } catch (e) {
      toast.error(getErrorMessage(e, "Saqlab bo'lmadi"));
    } finally {
      setSaving(false);
    }
  }

  async function doDeleteRole() {
    if (!confirmDelete) return;
    if (SYSTEM_ROLES.includes(confirmDelete.code)) {
      toast.error("Tizim rolini o'chirib bo'lmaydi");
      setConfirmDelete(null);
      return;
    }
    setDeleting(true);
    try {
      await api.delete(`/rbac/roles/${confirmDelete.id}`);
      toast.success("O'chirildi");
      if (selectedRoleId === confirmDelete.id) setSelectedRoleId(null);
      setConfirmDelete(null);
      loadAll();
    } catch (e) {
      toast.error(getErrorMessage(e, "O'chirib bo'lmadi"));
    } finally {
      setDeleting(false);
    }
  }

  async function createRole() {
    if (!newRole.code.trim() || !newRole.name.trim()) {
      toast.error("Kod va nom kiritilishi shart");
      return;
    }
    setCreating(true);
    try {
      const body: any = {
        code: newRole.code.trim().toLowerCase(),
        name: newRole.name.trim(),
        description: newRole.description.trim() || null,
      };
      if (newRole.copy_from_role_id) body.copy_from_role_id = newRole.copy_from_role_id;
      const r = await api.post<{ id: number }>("/rbac/roles", body);
      toast.success("Rol yaratildi");
      setCreateOpen(false);
      setNewRole({ code: "", name: "", description: "", copy_from_role_id: 0 });
      await loadAll();
      setSelectedRoleId(r.data.id);
    } catch (e) {
      toast.error(getErrorMessage(e, "Yaratib bo'lmadi"));
    } finally {
      setCreating(false);
    }
  }

  const byModule: Record<string, Permission[]> = {};
  for (const p of permissions) (byModule[p.module] ||= []).push(p);

  const selectedRole = roles.find((r) => r.id === selectedRoleId);
  const isSystemRole = selectedRole && SYSTEM_ROLES.includes(selectedRole.code);
  const isSuperadmin = selectedRole?.code === "superadmin";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rollar va ruxsatlar"
        description="Default tizim rollari + maxsus (custom) rollar yaratish"
        onCreate={() => setCreateOpen(true)}
        createLabel="Yangi rol"
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: roles list */}
        <Card padding="none" className="lg:col-span-4">
          <CardHeader title={`Rollar (${roles.length})`} />
          <div>
            {loading && <div className="p-6 text-center text-ink-400">Yuklanmoqda...</div>}
            {roles.map((r) => {
              const isSystem = SYSTEM_ROLES.includes(r.code);
              return (
                <div
                  key={r.id}
                  className={`w-full px-4 py-3 border-l-2 hover:bg-ink-50 dark:hover:bg-ink-900/40 ${
                    selectedRoleId === r.id
                      ? "border-brand-500 bg-brand-50/50 dark:bg-brand-900/20"
                      : "border-transparent"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <button onClick={() => setSelectedRoleId(r.id)} className="flex items-center gap-3 text-left flex-1 min-w-0">
                      <Badge tone={ROLE_TONE[r.code] || "neutral"}>{r.code}</Badge>
                      <div className="min-w-0">
                        <div className="font-medium text-ink-900 dark:text-ink-100 text-sm truncate">
                          {r.name}
                          {!isSystem && <span className="ml-1 text-xs text-brand-600">custom</span>}
                        </div>
                        <div className="text-xs text-ink-500 dark:text-ink-400">
                          {r.perm_count} ta ruxsat
                        </div>
                      </div>
                    </button>
                    {!isSystem && (
                      <button
                        onClick={() => setConfirmDelete(r)}
                        className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/30 text-ink-500 dark:text-ink-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                        title="O'chirish"
                        aria-label={`${r.name} rolini o'chirish`}
                      >
                        <Trash2 size={13} aria-hidden="true" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Right: permissions matrix */}
        <Card padding="none" className="lg:col-span-8">
          {!selectedRole && (
            <div className="p-10 text-center text-ink-400">
              <Shield size={32} className="mx-auto mb-2 opacity-30" />
              Chap tomondan rolni tanlang yoki yangi rol yarating
            </div>
          )}
          {selectedRole && (
            <>
              <CardHeader
                actions={
                  <Button
                    onClick={save}
                    disabled={saving || isSuperadmin}
                    loading={saving}
                    icon={Save}
                    size="sm"
                    title={isSuperadmin ? "Super Admin'ni o'zgartirish mumkin emas" : undefined}
                  >
                    {saving ? "Saqlanmoqda..." : "Saqlash"}
                  </Button>
                }
              >
                <div className="font-semibold text-ink-900 dark:text-ink-100">
                  {selectedRole.name} <span className="text-xs text-ink-400 font-normal">({selectedRole.code})</span>
                </div>
                <div className="text-xs text-ink-500 dark:text-ink-400">
                  Tanlangan: {selectedRolePerms.size} / {permissions.length}
                </div>
              </CardHeader>

              <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
                {Object.entries(byModule).map(([mod, perms]) => {
                  const allIds = perms.map((p) => p.id);
                  const allSelected = allIds.every((id) => selectedRolePerms.has(id));
                  const someSelected = allIds.some((id) => selectedRolePerms.has(id));
                  return (
                    <div key={mod} className="border border-ink-200/60 dark:border-ink-800/60 rounded-md">
                      <div className="px-3 py-2 bg-ink-50 dark:bg-ink-900/40 border-b border-ink-200/60 dark:border-ink-800/60 flex items-center justify-between">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={allSelected}
                            ref={(el) => {
                              if (el) el.indeterminate = !allSelected && someSelected;
                            }}
                            onChange={() => toggleModule(allIds)}
                            disabled={isSuperadmin}
                          />
                          <span className="font-medium text-ink-900 dark:text-ink-100 text-sm">
                            {MODULE_LABELS[mod] || mod}
                          </span>
                        </label>
                        <span className="text-xs text-ink-500">
                          {allIds.filter((id) => selectedRolePerms.has(id)).length}/{allIds.length}
                        </span>
                      </div>
                      <div className="p-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {perms.map((p) => (
                          <label
                            key={p.id}
                            className="flex items-center gap-2 text-sm cursor-pointer hover:bg-ink-50 dark:hover:bg-ink-900/30 px-2 py-1 rounded"
                          >
                            <input
                              type="checkbox"
                              checked={selectedRolePerms.has(p.id)}
                              onChange={() => togglePerm(p.id)}
                              disabled={isSuperadmin}
                            />
                            <span className="text-ink-700 dark:text-ink-300">
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
        </Card>
      </div>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Yangi rol yaratish">
        <div className="space-y-3">
          <Field label="Kod (ingliz tilida, kichik harf)" required>
            <input
              type="text"
              className={input}
              value={newRole.code}
              onChange={(e) => setNewRole({ ...newRole, code: e.target.value.toLowerCase().replace(/\s+/g, "_") })}
              placeholder="masalan: filial_mudiri"
              autoFocus
            />
            <p className="text-xs text-ink-500 mt-1">
              Tizim rollari (admin, manager, cashier, ...) ishlatilmaydi
            </p>
          </Field>
          <Field label="Ko'rinadigan nom" required>
            <input
              type="text"
              className={input}
              value={newRole.name}
              onChange={(e) => setNewRole({ ...newRole, name: e.target.value })}
              placeholder="masalan: Filial mudiri"
            />
          </Field>
          <Field label="Tavsif">
            <input
              type="text"
              className={input}
              value={newRole.description}
              onChange={(e) => setNewRole({ ...newRole, description: e.target.value })}
              placeholder="Bu rol nima qiladi?"
            />
          </Field>
          <Field label="Mavjud roldan nusxalash (ixtiyoriy)">
            <select
              className={input}
              value={newRole.copy_from_role_id}
              onChange={(e) => setNewRole({ ...newRole, copy_from_role_id: Number(e.target.value) })}
            >
              <option value={0}>— bo'sh rol —</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.perm_count} ruxsat)
                </option>
              ))}
            </select>
            <p className="text-xs text-ink-500 mt-1 inline-flex items-center gap-1">
              <Copy size={11} /> Ruxsatlar nusxalanadi, keyin o'zgartirishingiz mumkin
            </p>
          </Field>
          <div className="flex justify-end gap-2 pt-2 border-t border-ink-200 dark:border-ink-800">
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
              Bekor
            </Button>
            <Button type="button" onClick={createRole} disabled={creating} loading={creating} icon={Plus}>
              {creating ? "Yaratilmoqda..." : "Yaratish"}
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        onConfirm={doDeleteRole}
        loading={deleting}
        variant="danger"
        title="Rolni o'chirish"
        message={`'${confirmDelete?.name}' rolini o'chirilsinmi? Foydalanuvchilarga biriktirilgan bo'lsa, avval almashtiring.`}
        confirmLabel="O'chirish"
      />
    </div>
  );
}
