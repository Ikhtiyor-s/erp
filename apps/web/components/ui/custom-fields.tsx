"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Field, input } from "@/components/ui/modal";

type FieldDef = {
  field_id: number;
  name: string;
  field_type: "text" | "number" | "date" | "select" | "bool";
  options: string[];
  value: string | null;
};

type Props = {
  entityType: string;
  entityId?: string | null;
  onChange?: (values: Record<number, string | null>) => void;
};

export function CustomFieldsEditor({ entityType, entityId, onChange }: Props) {
  const [fields, setFields] = useState<FieldDef[]>([]);
  const [values, setValues] = useState<Record<number, string | null>>({});

  useEffect(() => {
    if (entityId) {
      api.get<FieldDef[]>(`/custom-field-values/${entityType}/${entityId}`)
        .then((r) => {
          const list = r.data || [];
          setFields(list);
          const v: Record<number, string | null> = {};
          for (const f of list) v[f.field_id] = f.value;
          setValues(v);
        })
        .catch(() => setFields([]));
    } else {
      api.get<any[]>(`/custom-fields?entity_type=${entityType}`)
        .then((r) => {
          setFields((r.data || []).map((f) => ({
            field_id: f.id, name: f.name, field_type: f.field_type,
            options: f.options || [], value: null,
          })));
        })
        .catch(() => setFields([]));
    }
  }, [entityType, entityId]);

  function update(fid: number, val: string | null) {
    const next = { ...values, [fid]: val };
    setValues(next);
    onChange?.(next);
  }

  async function persist() {
    if (!entityId) return;
    await api.post(`/custom-field-values/${entityType}/${entityId}`, { values });
  }

  if (fields.length === 0) return null;

  return (
    <div className="col-span-2 grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
      <div className="col-span-2 text-xs font-semibold text-slate-500 uppercase">Qo'shimcha maydonlar</div>
      {fields.map((f) => (
        <Field key={f.field_id} label={f.name}>
          {f.field_type === "text" && (
            <input className={input} value={values[f.field_id] || ""}
              onChange={(e) => update(f.field_id, e.target.value)} />
          )}
          {f.field_type === "number" && (
            <input type="number" className={input} value={values[f.field_id] || ""}
              onChange={(e) => update(f.field_id, e.target.value)} />
          )}
          {f.field_type === "date" && (
            <input type="date" className={input} value={values[f.field_id] || ""}
              onChange={(e) => update(f.field_id, e.target.value)} />
          )}
          {f.field_type === "select" && (
            <select className={input} value={values[f.field_id] || ""}
              onChange={(e) => update(f.field_id, e.target.value)}>
              <option value="">—</option>
              {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          )}
          {f.field_type === "bool" && (
            <select className={input} value={values[f.field_id] || ""}
              onChange={(e) => update(f.field_id, e.target.value)}>
              <option value="">—</option>
              <option value="true">Ha</option>
              <option value="false">Yo'q</option>
            </select>
          )}
        </Field>
      ))}
    </div>
  );
}

export { CustomFieldsEditor as default };
