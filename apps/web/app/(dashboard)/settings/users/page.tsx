"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/api-error";
import { PageHeader } from "@/components/ui/page-header";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";

type OrgUser = {
  id: string;
  email: string;
  full_name: string | null;
  is_active: boolean;
  role_id: number | null;
  role_code: string | null;
  role_name: string | null;
  is_default: boolean;
  joined_at: string;
};

type Role = {
  id: number;
  code: string;
  name: string;
};

type RoleTone = "danger" | "purple" | "primary" | "warning" | "success" | "neutral";

const ROLE_TONE: Record<string, RoleTone> = {
  superadmin: "danger",
  admin: "purple",
  manager: "primary",
  accountant: "warning",
  cashier: "success",
  viewer: "neutral",
};

export default function UsersPage() {
  const [users, setUsers] = useState<OrgUser[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [u, r] = await Promise.all([
        api.get<OrgUser[]>("/rbac/users"),
        api.get<Role[]>("/rbac/roles"),
      ]);
      setUsers(u.data);
      setRoles(r.data);
    } catch (e: any) {
      toast.error(getErrorMessage(e, "Yuklab bo'lmadi"));
    } finally {
      setLoading(false);
    }
  }

  async function setRole(userId: string, roleId: number) {
    setSavingId(userId);
    try {
      await api.put(`/rbac/users/${userId}/role`, { role_id: roleId });
      toast.success("Rol o'zgartirildi");
      await load();
    } catch (e: any) {
      toast.error(getErrorMessage(e, "Xato"));
    } finally {
      setSavingId(null);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const cols: Column<OrgUser>[] = [
    {
      key: "full_name",
      header: "Ism / Email",
      render: (u) => (
        <div>
          <div className="font-medium text-ink-900 dark:text-ink-100">{u.full_name || "���"}</div>
          <div className="text-xs text-ink-500 dark:text-ink-400">{u.email}</div>
        </div>
      ),
    },
    {
      key: "role_code",
      header: "Rol",
      render: (u) =>
        u.role_code ? (
          <Badge tone={ROLE_TONE[u.role_code] || "neutral"}>{u.role_name}</Badge>
        ) : (
          <span className="text-xs text-ink-400">��� rol yo'q ���</span>
        ),
    },
    {
      key: "is_active",
      header: "Holat",
      render: (u) => (
        <Badge tone={u.is_active ? "success" : "neutral"} dot>
          {u.is_active ? "Faol" : "Faol emas"}
        </Badge>
      ),
    },
    {
      key: "joined_at",
      header: "Qo'shilgan",
      render: (u) => new Date(u.joined_at).toLocaleDateString("uz-Cyrl-UZ"),
    },
    {
      key: "actions",
      header: "Amallar",
      align: "right",
      render: (u) => (
        <select
          className="text-sm border border-ink-300 dark:border-ink-700 rounded-md px-2 py-1 bg-white dark:bg-ink-900 text-ink-700 dark:text-ink-200"
          value={u.role_id ?? ""}
          onChange={(e) => setRole(u.id, Number(e.target.value))}
          disabled={savingId === u.id}
        >
          <option value="" disabled>
            Rol tanlash
          </option>
          {roles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Foydalanuvchilar va rollar"
        description="Tashkilotning xodimlariga rol biriktirish (har bir rol o'z ruxsatlariga ega)"
      />

      <DataTable
        columns={cols}
        rows={users}
        loading={loading}
        emptyText="Foydalanuvchilar yo'q"
        rowKey={(u) => u.id}
      />

      <div className="bg-info-50 dark:bg-info-500/15 border border-info-500/20 rounded-xl p-4 text-sm text-info-700 dark:text-info-500">
        <strong>Maslahat:</strong> Rollarning ruxsatlarini batafsil sozlash uchun{" "}
        <a href="/settings/roles" className="underline font-medium">
          Sozlamalar ��� Rollar
        </a>{" "}
        bo'limiga o'ting.
      </div>
    </div>
  );
}
