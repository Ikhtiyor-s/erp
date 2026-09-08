"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ChevronRight, ChevronDown, Plus, Trash2, Pencil } from "lucide-react";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/api-error";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal, Field, input } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

type Account = {
  id: number;
  code: string;
  name: string;
  type: "asset" | "liability" | "equity" | "income" | "expense";
  parent_id: number | null;
  linked_cashbox_id: number | null;
  is_system: boolean;
  is_active: boolean;
};

const TYPE_LABEL: Record<Account["type"], string> = {
  asset: "Aktiv",
  liability: "Majburiyat",
  equity: "Kapital",
  income: "Daromad",
  expense: "Xarajat",
};

const TYPE_TONE: Record<Account["type"], "success" | "danger" | "info" | "primary" | "warning"> = {
  asset: "success",
  liability: "danger",
  equity: "primary",
  income: "info",
  expense: "warning",
};

type TreeNode = Account & { children: TreeNode[] };

function buildTree(accounts: Account[]): TreeNode[] {
  const byId = new Map<number, TreeNode>();
  accounts.forEach((a) => byId.set(a.id, { ...a, children: [] }));
  const roots: TreeNode[] = [];
  byId.forEach((node) => {
    if (node.parent_id && byId.has(node.parent_id)) {
      byId.get(node.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  });
  return roots;
}

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [form, setForm] = useState({ code: "", name: "", type: "asset", parent_id: "" });
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Account | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const { data } = await api.get<Account[]>("/accounting/accounts");
      setAccounts(data);
      setExpanded(new Set(data.filter((a) => !a.parent_id).map((a) => a.id)));
    } catch (e) {
      toast.error(getErrorMessage(e, "Yuklashda xato"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function toggle(id: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function openCreate() {
    setEditing(null);
    setForm({ code: "", name: "", type: "asset", parent_id: "" });
    setOpen(true);
  }

  function openEdit(a: Account) {
    setEditing(a);
    setForm({ code: a.code, name: a.name, type: a.type, parent_id: a.parent_id ? String(a.parent_id) : "" });
    setOpen(true);
  }

  async function save() {
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/accounting/accounts/${editing.id}`, { name: form.name });
      } else {
        await api.post("/accounting/accounts", {
          code: form.code,
          name: form.name,
          type: form.type,
          parent_id: form.parent_id ? Number(form.parent_id) : null,
        });
      }
      toast.success("Saqlandi");
      setOpen(false);
      load();
    } catch (e) {
      toast.error(getErrorMessage(e, "Saqlashda xato"));
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/accounting/accounts/${deleteTarget.id}`);
      toast.success("O'chirildi");
      setDeleteTarget(null);
      load();
    } catch (e) {
      toast.error(getErrorMessage(e, "O'chirishda xato"));
    } finally {
      setDeleting(false);
    }
  }

  const tree = buildTree(accounts);

  function Row({ node, depth }: { node: TreeNode; depth: number }) {
    const hasChildren = node.children.length > 0;
    const isExpanded = expanded.has(node.id);
    return (
      <>
        <div
          className="flex items-center gap-2 px-4 py-2 border-b border-ink-100 dark:border-ink-800/60 last:border-0 hover:bg-ink-50/60 dark:hover:bg-ink-900/30"
          style={{ paddingLeft: `${16 + depth * 24}px` }}
        >
          {hasChildren ? (
            <button
              onClick={() => toggle(node.id)}
              className="text-ink-400 hover:text-ink-700 dark:hover:text-ink-200 shrink-0"
            >
              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
          ) : (
            <span className="w-3.5 shrink-0" />
          )}
          <span className="font-mono text-[12px] text-ink-500 dark:text-ink-400 w-16 shrink-0">{node.code}</span>
          <span className="flex-1 min-w-0 truncate text-ink-800 dark:text-ink-100">{node.name}</span>
          <Badge tone={TYPE_TONE[node.type]} soft>
            {TYPE_LABEL[node.type]}
          </Badge>
          {node.is_system && <Badge tone="neutral">Standart</Badge>}
          <div className="flex items-center gap-1 shrink-0">
            <Button variant="ghost" size="xs" icon={Pencil} onClick={() => openEdit(node)} />
            {!node.is_system && (
              <Button variant="ghost" size="xs" icon={Trash2} onClick={() => setDeleteTarget(node)} />
            )}
          </div>
        </div>
        {isExpanded && node.children.map((c) => <Row key={c.id} node={c} depth={depth + 1} />)}
      </>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Hisoblar rejasi"
        description="Buxgalteriya hisoblari — aktiv, majburiyat, kapital, daromad, xarajat"
        actions={<Button icon={Plus} onClick={openCreate}>Yangi hisob</Button>}
      />

      <Card padding="none">
        {loading ? (
          <div className="p-8 text-center text-sm text-ink-400">Yuklanmoqda...</div>
        ) : tree.length === 0 ? (
          <div className="p-8 text-center text-sm text-ink-400">Hisoblar yo'q</div>
        ) : (
          tree.map((n) => <Row key={n.id} node={n} depth={0} />)
        )}
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Hisobni tahrirlash" : "Yangi hisob"} size="sm">
        <div className="space-y-4">
          {!editing && (
            <>
              <Field label="Kod" required>
                <input className={input} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
              </Field>
              <Field label="Turi" required>
                <select
                  className={input}
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                >
                  {Object.entries(TYPE_LABEL).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </Field>
              <Field label="Yuqori hisob" hint="Ixtiyoriy — sub-hisob yaratish uchun">
                <select
                  className={input}
                  value={form.parent_id}
                  onChange={(e) => setForm({ ...form, parent_id: e.target.value })}
                >
                  <option value="">— Yo'q —</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
                  ))}
                </select>
              </Field>
            </>
          )}
          <Field label="Nomi" required>
            <input className={input} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Bekor</Button>
            <Button onClick={save} loading={saving}>Saqlash</Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="Hisobni o'chirish"
        message={`«${deleteTarget?.name}» hisobini o'chirishni tasdiqlaysizmi?`}
        loading={deleting}
      />
    </div>
  );
}
