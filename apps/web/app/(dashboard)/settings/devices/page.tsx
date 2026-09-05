"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Printer, ScanLine, Scale, Monitor } from "lucide-react";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/api-error";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Modal, Field, input } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { useTranslations } from "next-intl";

type Device = {
  id: number; name: string; kind: string;
  connection?: string; address?: string; is_active: boolean;
};

const kindIcon = (k: string) => ({
  printer: <Printer size={14} />, scanner: <ScanLine size={14} />,
  scale: <Scale size={14} />, cash_drawer: <Monitor size={14} />,
}[k] || <Monitor size={14} />);
const kindLabel = (k: string) => ({
  printer: "Printer", scanner: "Skaner", scale: "Tarozi",
  cash_drawer: "Pul qutisi", monitor: "Monitor",
}[k] || k);

export default function DevicesPage() {
  const t = useTranslations("ui");
  const [rows, setRows] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const empty = { name: "", kind: "printer", connection: "usb", address: "", config: {} };
  const [form, setForm] = useState<any>(empty);
  const [editId, setEditId] = useState<number | null>(null);

  async function load() {
    setLoading(true);
    try { setRows((await api.get<Device[]>("/settings/devices")).data); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function save() {
    if (!form.name) { toast.error(t("ui__введите_название_74a8590b")); return; }
    try {
      if (editId) await api.put(`/settings/devices/${editId}`, form);
      else await api.post("/settings/devices", form);
      toast.success(t("ui__сохранено_54a59b19")); setOpen(false); setForm(empty); setEditId(null); load();
    } catch (e: any) { toast.error(getErrorMessage(e, "Xato")); }
  }
  async function del(r: Device) {
    if (!confirm(`��${r.name}�� o'chirilsinmi?`)) return;
    await api.delete(`/settings/devices/${r.id}`);
    toast.success(t("ui__удалено_0c450c40")); load();
  }

  const cols: Column<Device>[] = [
    { key: "kind", header: t("ui__тип_345805b8"), width: "140px",
      render: (r) => <span className="inline-flex items-center gap-1.5">{kindIcon(r.kind)} {kindLabel(r.kind)}</span> },
    { key: "name", header: t("ui__название_602680ed") },
    { key: "connection", header: t("ui__подключение_ffa9d591"), width: "140px", render: (r) => r.connection || "���" },
    { key: "address", header: t("ui__адрес_порт_2c1023f4"), render: (r) => r.address || "���" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={t("ui__устройства_5172b9d5")} description={t("ui__принтеры_сканеры_весы_и_т_д_2faaa419")}
        onCreate={() => { setForm(empty); setEditId(null); setOpen(true); }} />
      <DataTable columns={cols} rows={rows} loading={loading}
        onEdit={(r) => { setForm({ ...r, config: (r as any).config || {} }); setEditId(r.id); setOpen(true); }}
        onDelete={del} />

      <Modal open={open} onClose={() => setOpen(false)} title={editId ? "Qurilmani tahrirlash" : "Yangi qurilma"}>
        <div className="space-y-3">
          <Field label={t("ui__название_602680ed")} required>
            <input className={input} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("ui__тип_345805b8")} required>
              <select className={input} value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
                <option value="printer">{t("ui__принтер_f6bf3878")}</option>
                <option value="scanner">{t("ui__сканер_49d0f370")}</option>
                <option value="scale">{t("ui__весы_01729404")}</option>
                <option value="cash_drawer">{t("ui__денежный_ящик_ec2ec2d0")}</option>
                <option value="monitor">{t("ui__монитор_покупателя_52f8f61e")}</option>
              </select>
            </Field>
            <Field label={t("ui__подключение_ffa9d591")}>
              <select className={input} value={form.connection || ""}
                onChange={(e) => setForm({ ...form, connection: e.target.value })}>
                <option value="usb">USB</option>
                <option value="network">{t("ui__сеть_ip_34026f0e")}</option>
                <option value="bluetooth">Bluetooth</option>
                <option value="serial">Serial / COM</option>
              </select>
            </Field>
          </div>
          <Field label={t("ui__адрес_порт_2c1023f4")}>
            <input className={input} placeholder="COM1, 192.168.1.10, /dev/usb..."
              value={form.address || ""} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setOpen(false)} className="px-4 py-2 text-sm rounded-md border hover:bg-slate-50 dark:bg-slate-900/40">{t("ui__отмена_987b33c6")}</button>
            <button onClick={save} className="px-4 py-2 text-sm rounded-md bg-brand-600 text-white hover:bg-brand-700">{t("ui__сохранить_74ea58b6")}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
