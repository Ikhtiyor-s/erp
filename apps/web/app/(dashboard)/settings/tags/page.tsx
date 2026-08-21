"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/ui/page-header";

type Tag = { id: number; name: string; color: string };

export default function TagsAdminPage() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#3393cb");
  const [loading, setLoading] = useState(true);

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

  async function del(id: number) {
    if (!confirm("O'chirilsinmi?")) return;
    await api.delete(`/tags/${id}`);
    load();
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Teglar" description="Mahsulot, mijoz, sotuv va boshqalarga qo'shish uchun teglar" />

      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
        <div className="flex items-center gap-2">
          <input value={newName} onChange={(e) => setNewName(e.target.value)}
            placeholder="Yangi teg nomi"
            onKeyDown={(e) => e.key === "Enter" && create()}
            className="flex-1 px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 rounded-md text-sm" />
          <input type="color" value={newColor} onChange={(e) => setNewColor(e.target.value)}
            className="w-10 h-10 rounded border border-slate-300 dark:border-slate-600" />
          <button onClick={create} className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-md text-sm flex items-center gap-1">
            <Plus size={14} /> Qo'shish
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
        {loading ? (
          <div className="py-10 text-center text-slate-400">Yuklanmoqda...</div>
        ) : tags.length === 0 ? (
          <div className="py-10 text-center text-slate-400 text-sm">Teglar yo'q</div>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-700">
            {tags.map((t) => (
              <li key={t.id} className="px-4 py-3 flex items-center justify-between">
                <span className="inline-flex items-center px-2.5 py-1 rounded text-xs text-white font-medium"
                  style={{ backgroundColor: t.color }}>
                  {t.name}
                </span>
                <button onClick={() => del(t.id)} className="text-rose-600 hover:text-rose-700 p-1">
                  <Trash2 size={16} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
