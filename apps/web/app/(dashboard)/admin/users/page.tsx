"use client";

import { useEffect, useState } from "react";
import { Users, UserCheck, UserPlus, UserMinus, Power } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/api-error";
import { PageHeader } from "@/components/ui/page-header";
import { Modal, Field, input } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

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
  superadmin: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
  admin: "bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300",
  manager: "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300",
  accountant: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  cashier: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  viewer: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
};

type ConfirmState =
  | { kind: "remove"; user: OrgUser }
  | { kind: "toggle"; user: OrgUser }
  | null;

export default function AdminUsersPage() {
  const [users, setUsers] = useState<OrgUser[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [invite, setInvite] = useState({
    email: "",
    full_name: "",
    role_id: 0,
    initial_password: "",
  });
  const [inviting, setInviting] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmState>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [u, r] = await Promise.all([
        api.get<OrgUser[]>("/rbac/users"),
        api.get<Role[]>("/rbac/roles"),
      ]);
      setUsers(u.data);
      setRoles(r.data);
      if (r.data.length > 0 && !invite.role_id) {
        const defaultRole = r.data.find((x) => x.code === "cashier") || r.data[0];
        setInvite((s) => ({ ...s, role_id: defaultRole.id }));
      }
    } catch (e) {
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
    } catch (e) {
      toast.error(getErrorMessage(e, "Rolni o'zgartirib bo'lmadi"));
    } finally {
      setSavingId(null);
    }
  }

  async function doConfirmAction() {
    if (!confirm) return;
    setConfirmLoading(true);
    try {
      if (confirm.kind === "remove") {
        await api.delete(`/rbac/users/${confirm.user.id}`);
        toast.success("Tashkilotdan o'chirildi");
      } else {
        await api.put(`/rbac/users/${confirm.user.id}/active`, {
          is_active: !confirm.user.is_active,
        });
        toast.success(confirm.user.is_active ? "Bloklandi" : "Faollashtirildi");
      }
      setConfirm(null);
      load();
    } catch (e) {
      toast.error(getErrorMessage(e, "Amalni bajarib bo'lmadi"));
    } finally {
      setConfirmLoading(false);
    }
  }

  function validateInvite(): string | null {
    if (!invite.email.trim()) return "Email kiritilishi shart";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(invite.email.trim())) {
      return "Email formati noto'g'ri";
    }
    if (!invite.role_id) return "Rol tanlanmagan";
    if (invite.initial_password && invite.initial_password.length < 6) {
      return "Parol kamida 6 belgi bo'lishi kerak";
    }
    return null;
  }

  async function doInvite(e?: React.FormEvent) {
    e?.preventDefault();
    const err = validateInvite();
    if (err) {
      toast.error(err);
      return;
    }
    setInviting(true);
    try {
      const body: any = {
        email: invite.email.trim(),
        role_id: invite.role_id,
      };
      if (invite.full_name.trim()) body.full_name = invite.full_name.trim();
      if (invite.initial_password) body.initial_password = invite.initial_password;
      const r = await api.post<{ created_new?: boolean; user_existed?: boolean; invitation_token?: string }>(
        "/rbac/users/invite",
        body,
      );
      if (r.data.user_existed && r.data.invitation_token) {
        toast.success("Mavjud foydalanuvchiga taklif yuborildi (token yaratildi)", { duration: 5000 });
      } else {
        toast.success("Yangi foydalanuvchi yaratildi");
      }
      setInviteOpen(false);
      setInvite({
        email: "",
        full_name: "",
        role_id: roles[0]?.id || 0,
        initial_password: "",
      });
      load();
    } catch (e) {
      toast.error(getErrorMessage(e, "Qo'shib bo'lmadi"));
    } finally {
      setInviting(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Foydalanuvchilar"
        description="Tashkilot xodimlarini boshqarish va rol biriktirish"
        onCreate={() => setInviteOpen(true)}
        createLabel="Foydalanuvchi qo'shish"
      />

      {/* DESKTOP table */}
      <div className="hidden md:block bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm overflow-hidden">
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
                <tr><td colSpan={5} className="text-center py-10 text-slate-400">Yuklanmoqda...</td></tr>
              )}
              {!loading && users.length === 0 && (
                <tr><td colSpan={5} className="text-center py-10 text-slate-400">Foydalanuvchilar yo'q</td></tr>
              )}
              {users.map((u) => (
                <tr key={u.id}
                  className="border-t border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-900/30">
                  <td className="px-4 py-2">
                    <div className="font-medium text-slate-900 dark:text-slate-100">{u.full_name || "—"}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">{u.email}</div>
                  </td>
                  <td className="px-4 py-2">
                    {u.role_code ? (
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${ROLE_COLORS[u.role_code] || "bg-slate-100 text-slate-700"}`}>
                        {u.role_name}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">— rol yo'q —</span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    {u.is_active ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 text-xs">
                        <UserCheck size={12} /> Faol
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">Bloklangan</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-xs text-slate-500 dark:text-slate-400">
                    {new Date(u.joined_at).toLocaleDateString("uz-UZ")}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <div className="inline-flex items-center gap-2">
                      <select
                        className="text-sm border border-slate-300 dark:border-slate-600 rounded-md px-2 py-1 bg-white dark:bg-slate-800"
                        value={u.role_id ?? ""}
                        onChange={(e) => setRole(u.id, Number(e.target.value))}
                        disabled={savingId === u.id}
                        aria-label={`${u.email} uchun rol`}
                      >
                        <option value="" disabled>Rol tanlash</option>
                        {roles.map((r) => (
                          <option key={r.id} value={r.id}>{r.name}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => setConfirm({ kind: "toggle", user: u })}
                        className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500"
                        title={u.is_active ? "Bloklash" : "Faollashtirish"}
                        aria-label={`${u.email} ni ${u.is_active ? "bloklash" : "faollashtirish"}`}
                      >
                        <Power size={14} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirm({ kind: "remove", user: u })}
                        className="p-1.5 rounded hover:bg-rose-50 dark:hover:bg-rose-900/30 text-rose-600"
                        title="Tashkilotdan o'chirish"
                        aria-label={`${u.email} ni tashkilotdan o'chirish`}
                      >
                        <UserMinus size={14} aria-hidden="true" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* MOBILE card list */}
      <div className="md:hidden bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm overflow-hidden">
        <div className="px-3 py-2.5 border-b border-slate-100 dark:border-slate-700 flex items-center gap-2 text-slate-900 dark:text-slate-100">
          <Users size={16} />
          <span className="font-semibold text-sm">Foydalanuvchilar ({users.length})</span>
        </div>
        {loading && <div className="py-10 text-center text-slate-400 text-sm">Yuklanmoqda...</div>}
        {!loading && users.length === 0 && (
          <div className="py-10 text-center text-slate-400 text-sm">Foydalanuvchilar yo'q</div>
        )}
        <ul className="divide-y divide-slate-100 dark:divide-slate-700">
          {users.map((u) => (
            <li key={u.id} className="p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-slate-900 dark:text-slate-100 truncate">
                    {u.full_name || "—"}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 truncate">{u.email}</div>
                </div>
                {u.role_code && (
                  <span className={`shrink-0 px-2 py-0.5 rounded text-xs font-medium ${ROLE_COLORS[u.role_code] || "bg-slate-100 text-slate-700"}`}>
                    {u.role_name}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs">
                {u.is_active ? (
                  <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                    <UserCheck size={11} /> Faol
                  </span>
                ) : (
                  <span className="text-slate-400">Bloklangan</span>
                )}
                <span className="text-slate-400">·</span>
                <span className="text-slate-500">
                  {new Date(u.joined_at).toLocaleDateString("uz-UZ")}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <select
                  className="flex-1 text-sm border border-slate-300 dark:border-slate-600 rounded-md px-2 py-1.5 bg-white dark:bg-slate-800"
                  value={u.role_id ?? ""}
                  onChange={(e) => setRole(u.id, Number(e.target.value))}
                  disabled={savingId === u.id}
                  aria-label={`${u.email} uchun rol`}
                >
                  <option value="" disabled>Rol</option>
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setConfirm({ kind: "toggle", user: u })}
                  className="p-2 rounded border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-400"
                  aria-label={`${u.email} ni ${u.is_active ? "bloklash" : "faollashtirish"}`}
                >
                  <Power size={14} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => setConfirm({ kind: "remove", user: u })}
                  className="p-2 rounded border border-rose-300 dark:border-rose-700 text-rose-600 dark:text-rose-400"
                  aria-label={`${u.email} ni tashkilotdan o'chirish`}
                >
                  <UserMinus size={14} aria-hidden="true" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <Modal open={inviteOpen} onClose={() => setInviteOpen(false)} title="Yangi foydalanuvchi">
        <form onSubmit={doInvite} className="space-y-3">
          <Field label="Email" required>
            <input
              type="email"
              className={input}
              value={invite.email}
              onChange={(e) => setInvite({ ...invite, email: e.target.value })}
              placeholder="user@example.com"
              autoFocus
              required
            />
          </Field>
          <Field label="To'liq ism">
            <input
              type="text"
              className={input}
              value={invite.full_name}
              onChange={(e) => setInvite({ ...invite, full_name: e.target.value })}
              placeholder="Ali Valiyev"
            />
          </Field>
          <Field label="Rol" required>
            <select
              className={input}
              value={invite.role_id}
              onChange={(e) => setInvite({ ...invite, role_id: Number(e.target.value) })}
              required
            >
              {roles.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Parol (faqat yangi foydalanuvchi uchun)">
            <input
              type="text"
              className={input}
              value={invite.initial_password}
              onChange={(e) => setInvite({ ...invite, initial_password: e.target.value })}
              placeholder="kamida 6 belgi"
              minLength={6}
            />
            <p className="text-xs text-slate-500 mt-1">
              Bo'sh qoldirsangiz va email allaqachon ro'yxatda bo'lsa — taklif jo'natiladi
              (foydalanuvchi tasdiqlashi shart). Yangi foydalanuvchi uchun parol kerak.
            </p>
          </Field>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setInviteOpen(false)}
              className="px-4 py-2 text-sm rounded-md border border-slate-300 dark:border-slate-600"
            >
              Bekor
            </button>
            <button
              type="submit"
              disabled={inviting}
              className="px-4 py-2 text-sm rounded-md bg-brand-600 hover:bg-brand-700 text-white disabled:opacity-50 inline-flex items-center gap-1.5"
            >
              <UserPlus size={14} aria-hidden="true" />
              {inviting ? "Qo'shilmoqda..." : "Qo'shish"}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        onConfirm={doConfirmAction}
        loading={confirmLoading}
        variant={confirm?.kind === "remove" ? "danger" : "warning"}
        title={
          confirm?.kind === "remove"
            ? "Tashkilotdan o'chirish"
            : confirm?.user.is_active
            ? "Bloklash"
            : "Faollashtirish"
        }
        message={
          confirm?.kind === "remove"
            ? `${confirm.user.email}'ni tashkilotdan o'chirilsinmi? Akkaunt o'chmaydi — boshqa tashkilotlarda ishlatishi mumkin.`
            : confirm?.kind === "toggle"
            ? confirm.user.is_active
              ? `${confirm.user.email} bu tashkilotda bloklansinmi? Boshqa tashkilotlarda ishi davom etadi.`
              : `${confirm.user.email} qayta faollashtirilsinmi?`
            : ""
        }
        confirmLabel={
          confirm?.kind === "remove"
            ? "O'chirish"
            : confirm?.user.is_active
            ? "Bloklash"
            : "Faollashtirish"
        }
      />
    </div>
  );
}
