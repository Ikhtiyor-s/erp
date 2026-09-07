"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Search, Check, X, Clock } from "lucide-react";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/api-error";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Modal, Field, input } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatWidget } from "@/components/ui/stat-widget";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useTranslations } from "next-intl";

type Task = {
  id: string;
  title: string;
  description?: string;
  status: "todo" | "in_progress" | "done" | "cancelled";
  priority: "low" | "normal" | "high" | "urgent";
  due_date?: string;
  completed_at?: string;
  created_at?: string;
  assignee_id?: string;
  assignee_name?: string;
  created_by_name?: string;
};
type Emp = { id: string; full_name: string };

const empty = {
  title: "",
  description: "",
  assignee_id: "",
  priority: "normal",
  due_date: "",
};

type TaskTone = "neutral" | "warning" | "success" | "danger" | "info";

const statusLabel = (s: string) =>
  ({
    todo: "Bajarish uchun",
    in_progress: "Ishda",
    done: "Bajarildi",
    cancelled: "Bekor qilindi",
  }[s] || s);

const statusTone = (s: string): TaskTone =>
  ({
    todo: "neutral",
    in_progress: "warning",
    done: "success",
    cancelled: "danger",
  }[s] as TaskTone) || "neutral";

const priorityLabel = (p: string) =>
  ({ low: "Past", normal: "Oddiy", high: "Yuqori", urgent: "Shoshilinch" }[p] || p);

const priorityTone = (p: string): TaskTone =>
  ({
    low: "neutral",
    normal: "info",
    high: "warning",
    urgent: "danger",
  }[p] as TaskTone) || "neutral";

export default function TasksPage() {
  const t = useTranslations("ui");
  const [rows, setRows] = useState<Task[]>([]);
  const [employees, setEmployees] = useState<Emp[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    q: "",
    status: "",
    assignee_id: "",
    priority: "",
  });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(empty);
  const [editId, setEditId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Task | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      if (filters.q) p.set("q", filters.q);
      if (filters.status) p.set("status", filters.status);
      if (filters.assignee_id) p.set("assignee_id", filters.assignee_id);
      if (filters.priority) p.set("priority", filters.priority);
      const qs = p.toString();
      setRows((await api.get<Task[]>(`/tasks${qs ? "?" + qs : ""}`)).data);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    api
      .get<Emp[]>("/hr/employees")
      .then((r) => setEmployees(r.data))
      .catch(() => {});
    load();
  }, []);

  async function save() {
    if (!form.title) {
      toast.error(t("ui__введите_название_задачи_893950ea"));
      return;
    }
    try {
      const payload = {
        ...form,
        assignee_id: form.assignee_id || null,
        due_date: form.due_date || null,
      };
      if (editId) await api.put(`/tasks/${editId}`, payload);
      else await api.post("/tasks", payload);
      toast.success(t("ui__сохранено_54a59b19"));
      setOpen(false);
      load();
    } catch (e: any) {
      toast.error(getErrorMessage(e, "Xato"));
    }
  }
  async function setStatus(r: Task, status: string) {
    try {
      await api.put(`/tasks/${r.id}/status?status=${status}`);
      toast.success(t("ui__статус_обновлён_60431b86"));
      load();
    } catch (e: any) {
      toast.error(getErrorMessage(e, "Xato"));
    }
  }
  async function doDelete() {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await api.delete(`/tasks/${confirmDelete.id}`);
      toast.success(t("ui__удалено_0c450c40"));
      setConfirmDelete(null);
      load();
    } catch (e: any) {
      toast.error(getErrorMessage(e, "Xato"));
    } finally {
      setDeleting(false);
    }
  }

  const stats = useMemo(() => {
    const todo = rows.filter((r) => r.status === "todo").length;
    const inProgress = rows.filter((r) => r.status === "in_progress").length;
    const done = rows.filter((r) => r.status === "done").length;
    return { todo, inProgress, done, total: rows.length };
  }, [rows]);

  const cols: Column<Task>[] = [
    {
      key: "priority",
      header: t("ui__приор_18774995"),
      width: "100px",
      render: (r) => (
        <Badge tone={priorityTone(r.priority)}>{priorityLabel(r.priority)}</Badge>
      ),
    },
    { key: "title", header: t("ui__задача_fb65f812") },
    {
      key: "assignee_name",
      header: t("ui__исполнитель_1d3ab78a"),
      width: "160px",
      render: (r) => r.assignee_name || "—",
    },
    {
      key: "due_date",
      header: t("ui__срок_bae913f6"),
      width: "120px",
      render: (r) =>
        r.due_date ? new Date(r.due_date).toLocaleDateString("ru-RU") : "—",
    },
    {
      key: "status",
      header: t("ui__статус_7203f7a4"),
      width: "130px",
      render: (r) => <Badge tone={statusTone(r.status)}>{statusLabel(r.status)}</Badge>,
    },
    {
      key: "id" as any,
      header: "",
      width: "120px",
      align: "center",
      render: (r) =>
        r.status !== "done" && r.status !== "cancelled" ? (
          <div className="flex gap-1 justify-center">
            {r.status === "todo" && (
              <button
                onClick={() => setStatus(r, "in_progress")}
                className="p-1 text-warn-600 dark:text-warn-500 hover:bg-warn-50 dark:hover:bg-warn-500/15 rounded"
                title={t("ui__в_работу_e8f15a73")}
              >
                <Clock size={14} />
              </button>
            )}
            <button
              onClick={() => setStatus(r, "done")}
              className="p-1 text-success-600 dark:text-success-500 hover:bg-success-50 dark:hover:bg-success-500/15 rounded"
              title={t("ui__завершить_b0e3a5e0")}
            >
              <Check size={14} />
            </button>
            <button
              onClick={() => setStatus(r, "cancelled")}
              className="p-1 text-danger-600 dark:text-danger-500 hover:bg-danger-50 dark:hover:bg-danger-500/15 rounded"
              title={t("ui__отменить_ecdbdc8b")}
            >
              <X size={14} />
            </button>
          </div>
        ) : null,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("ui__задачи_73f223a4")}
        description={t("ui__управление_задачами_и_поручени_b6533e28")}
        onCreate={() => {
          setForm(empty);
          setEditId(null);
          setOpen(true);
        }}
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatWidget label={t("ui__всего_e7ffde0e")} value={stats.total} color="ink" />
        <StatWidget label={t("ui__к_выполнению_cef53737")} value={stats.todo} color="ink" />
        <StatWidget label={t("ui__в_работе_8c92e34f")} value={stats.inProgress} color="warn" />
        <StatWidget label={t("ui__выполнено_c665d401")} value={stats.done} color="success" />
      </div>

      <Card className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="sm:col-span-2 relative">
          <label className="text-xs text-ink-500 dark:text-ink-400 block mb-1">
            {t("ui__поиск_название_описание_3176a313")}
          </label>
          <Search
            size={14}
            className="absolute left-2.5 top-[34px] text-ink-400"
          />
          <input
            className={`${input} pl-8`}
            placeholder={t("ui__поиск_b84a8f87")}
            value={filters.q}
            onChange={(e) => setFilters({ ...filters, q: e.target.value })}
            onKeyDown={(e) => e.key === "Enter" && load()}
          />
        </div>
        <div>
          <label className="text-xs text-ink-500 dark:text-ink-400 block mb-1">
            {t("ui__статус_7203f7a4")}
          </label>
          <select
            className={input}
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
          >
            <option value="">{t("ui__все_a07b234e")}</option>
            <option value="todo">{t("ui__к_выполнению_cef53737")}</option>
            <option value="in_progress">{t("ui__в_работе_8c92e34f")}</option>
            <option value="done">{t("ui__выполнено_c665d401")}</option>
            <option value="cancelled">{t("ui__отменено_81a04dab")}</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-ink-500 dark:text-ink-400 block mb-1">
            {t("ui__приоритет_a0f9f1af")}
          </label>
          <select
            className={input}
            value={filters.priority}
            onChange={(e) =>
              setFilters({ ...filters, priority: e.target.value })
            }
          >
            <option value="">{t("ui__все_a07b234e")}</option>
            <option value="urgent">{t("ui__срочно_bb71eea6")}</option>
            <option value="high">{t("ui__высокий_bd128910")}</option>
            <option value="normal">{t("ui__обычный_cc13e933")}</option>
            <option value="low">{t("ui__низкий_32e31524")}</option>
          </select>
        </div>
        <div className="flex items-end">
          <Button onClick={load} fullWidth>
            {t("ui__фильтр_2f884b41")}
          </Button>
        </div>
      </Card>

      <DataTable
        columns={cols}
        rows={rows}
        loading={loading}
        onEdit={(r) => {
          setForm({
            title: r.title,
            description: r.description || "",
            assignee_id: r.assignee_id || "",
            priority: r.priority,
            due_date: r.due_date?.slice(0, 10) || "",
          });
          setEditId(r.id);
          setOpen(true);
        }}
        onDelete={(r) => setConfirmDelete(r)}
      />

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editId ? "Vazifani tahrirlash" : "Yangi vazifa"}
        size="lg"
      >
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Field label={t("ui__название_602680ed")} required>
              <input
                className={input}
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </Field>
          </div>
          <Field label={t("ui__исполнитель_1d3ab78a")}>
            <select
              className={input}
              value={form.assignee_id}
              onChange={(e) =>
                setForm({ ...form, assignee_id: e.target.value })
              }
            >
              <option value="">{t("ui__не_назначен_f0752b3a")}</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.full_name}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("ui__приоритет_a0f9f1af")}>
            <select
              className={input}
              value={form.priority}
              onChange={(e) => setForm({ ...form, priority: e.target.value })}
            >
              <option value="low">{t("ui__низкий_32e31524")}</option>
              <option value="normal">{t("ui__обычный_cc13e933")}</option>
              <option value="high">{t("ui__высокий_bd128910")}</option>
              <option value="urgent">{t("ui__срочно_bb71eea6")}</option>
            </select>
          </Field>
          <Field label={t("ui__срок_выполнения_ec430713")}>
            <input
              type="date"
              className={input}
              value={form.due_date}
              onChange={(e) => setForm({ ...form, due_date: e.target.value })}
            />
          </Field>
          <div className="col-span-2">
            <Field label={t("ui__описание_38ca0af8")}>
              <textarea
                className={input}
                rows={3}
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
              />
            </Field>
          </div>
          <div className="col-span-2 flex justify-end gap-2 pt-2 border-t border-ink-200 dark:border-ink-800">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {t("ui__отмена_987b33c6")}
            </Button>
            <Button type="button" onClick={save}>
              {t("ui__сохранить_74ea58b6")}
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        onConfirm={doDelete}
        loading={deleting}
        variant="danger"
        title="Vazifani o'chirish"
        message={`"${confirmDelete?.title}" vazifasi o'chirilsinmi?`}
        confirmLabel="O'chirish"
      />
    </div>
  );
}
