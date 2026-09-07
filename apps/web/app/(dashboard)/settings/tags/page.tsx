"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { input } from "@/components/ui/modal";
import { DataTable, type Column } from "@/components/ui/data-table";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

type Tag = { id: number; name: string; color: string };

export default function TagsAdminPage() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#3393cb");
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<Tag | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const r = await api.get<Tag[]>("/tags");
      setTags(r.data || []);
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function create() {
    if (!newName.trim()) return;
    await api.post("/tags", { name: newName.trim(), color: newColor });
    toast.success("Yaratildi");
    setNewName("");
    load();
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/tags/${deleteTarget.id}`);
      setDeleteTarget(null);
      load();
    } finally {
      setDeleting(false);
    }
  }

  const cols: Column<Tag>[] = [
    {
      key: "name",
      header: "Nomi",
      render: (r) => (
        <span
          className="inline-flex items-center px-2.5 py-1 rounded text-xs text-white font-medium"
          style={{ backgroundColor: r.color }}
        >
          {r.name}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader title="Teglar" description="Mahsulot, mijoz, sotuv va boshqalarga qo'shish uchun teglar" />

      <Card padding="md">
        <div className="flex items-center gap-2">
          <input value={newName} onChange={(e) => setNewName(e.target.value)}
            placeholder="Yangi teg nomi"
            onKeyDown={(e) => e.key === "Enter" && create()}
            className={`flex-1 ${input}`} />
          <input type="color" value={newColor} onChange={(e) => setNewColor(e.target.value)}
            className="w-10 h-10 rounded border border-ink-300 dark:border-ink-700" />
          <Button onClick={create} icon={Plus}>
            Qo'shish
          </Button>
        </div>
      </Card>

      <DataTable
        columns={cols}
        rows={tags}
        loading={loading}
        onDelete={(r) => setDeleteTarget(r)}
        emptyText="Teglar yo'q"
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="Tegni o'chirish"
        message={`"${deleteTarget?.name ?? ""}" tegini o'chirishni tasdiqlaysizmi?`}
        loading={deleting}
      />
    </div>
  );
}
