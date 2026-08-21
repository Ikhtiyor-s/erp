"use client";

import { useEffect, useState } from "react";
import { Users, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/api-error";
import { PageHeader } from "@/components/ui/page-header";

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

const ROLE_COLORS: Record<string, string> = {
  superadmin: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  admin: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  manager: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  accountant: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  cashier: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  viewer: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Foydalanuvchilar va rollar"
        description="Tashkilotning xodimlariga rol biriktirish (har bir rol o'z ruxsatlariga ega)"
      />

      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 flex items-center gap-2 text-slate-900 dark:text-slate-100">
          <Users size={16} />
          <span className="font-semibold">Foydalanuvchilar ({users.length})</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900/40 text-xs text-slate-500 dark:text-slate-400 uppercase">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Ism / Email</th>
                <th className="text-left px-4 py-3 font-medium">Rol</th>
                <th className="text-left px-4 py-3 font-medium">Holat</th>
                <th className="text-left px-4 py-3 font-medium">Qo'shilgan</th>
                <th className="text-right px-4 py-3 font-medium">Amallar</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={5} className="text-center py-10 text-slate-400">
                    Yuklanmoqda...
                  </td>
                </tr>
              )}
              {!loading && users.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-10 text-slate-400">
                    Foydalanuvchilar yo'q
                  </td>
                </tr>
              )}
              {users.map((u) => (
                <tr
                  key={u.id}
                  className="border-t border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-900/30"
                >
                  <td className="px-4 py-2">
                    <div className="font-medium text-slate-900 dark:text-slate-100">
                      {u.full_name || "���"}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {u.email}
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    {u.role_code ? (
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-medium ${
                          ROLE_COLORS[u.role_code] || "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {u.role_name}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">��� rol yo'q ���</span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    {u.is_active ? (
                      <span className="inline-flex items-center gap-1 text-green-700 dark:text-green-400 text-xs">
                        <UserCheck size={12} /> Faol
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">Faol emas</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-xs text-slate-500 dark:text-slate-400">
                    {new Date(u.joined_at).toLocaleDateString("uz-Cyrl-UZ")}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <select
                      className="text-sm border border-slate-300 dark:border-slate-600 rounded-md px-2 py-1 bg-white dark:bg-slate-800"
                      value={u.role_id ?? ""}
                      onChange={(e) =>
                        setRole(u.id, Number(e.target.value))
                      }
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
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 text-sm text-blue-800 dark:text-blue-200">
        <strong>Maslahat:</strong> Rollarning ruxsatlarini batafsil sozlash uchun{" "}
        <a href="/settings/roles" className="underline font-medium">
          Sozlamalar ��� Rollar
        </a>{" "}
        bo'limiga o'ting.
      </div>
    </div>
  );
}
