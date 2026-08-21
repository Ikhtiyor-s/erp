"use client";

import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import { api } from "@/lib/api";

export type Tag = { id: number; name: string; color: string };

type Props = {
  value: number[];
  onChange: (ids: number[]) => void;
};

export function TagsInput({ value, onChange }: Props) {
  const [tags, setTags] = useState<Tag[]>([]);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#3393cb");

  async function load() {
    try {
      const r = await api.get<Tag[]>("/tags");
      setTags(r.data || []);
    } catch {
      setTags([]);
    }
  }
  useEffect(() => { load(); }, []);

  function toggle(id: number) {
    if (value.includes(id)) onChange(value.filter((v) => v !== id));
    else onChange([...value, id]);
  }

  async function createTag() {
    if (!newName.trim()) return;
    const r = await api.post<{ id: number }>("/tags", { name: newName.trim(), color: newColor });
    setTags([...tags, { id: r.data.id, name: newName.trim(), color: newColor }]);
    onChange([...value, r.data.id]);
    setNewName("");
    setCreating(false);
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {tags.map((t) => {
          const active = value.includes(t.id);
          return (
            <button key={t.id} type="button" onClick={() => toggle(t.id)}
              className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded border ${
                active ? "text-white border-transparent" : "border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300"
              }`}
              style={active ? { backgroundColor: t.color } : {}}>
              {t.name}
              {active && <X size={11} />}
            </button>
          );
        })}
        {!creating && (
          <button type="button" onClick={() => setCreating(true)}
            className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border border-dashed border-slate-300 dark:border-slate-600 text-slate-500 hover:text-slate-700">
            <Plus size={11} /> Yangi tag
          </button>
        )}
      </div>
      {creating && (
        <div className="flex items-center gap-2">
          <input value={newName} onChange={(e) => setNewName(e.target.value)}
            placeholder="Tag nomi" autoFocus
            onKeyDown={(e) => e.key === "Enter" && createTag()}
            className="px-2 py-1 text-xs border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-900" />
          <input type="color" value={newColor} onChange={(e) => setNewColor(e.target.value)}
            className="w-7 h-7 rounded border-none" />
          <button type="button" onClick={createTag}
            className="text-xs px-2 py-1 bg-brand-600 text-white rounded">Saqlash</button>
          <button type="button" onClick={() => setCreating(false)}
            className="text-xs px-2 py-1 text-slate-500">Bekor</button>
        </div>
      )}
    </div>
  );
}
