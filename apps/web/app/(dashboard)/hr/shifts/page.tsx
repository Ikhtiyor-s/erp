"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, LogIn, LogOut, Plus, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/api-error";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Modal, Field, input } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { StatWidget } from "@/components/ui/stat-widget";

type Employee = { id: string; full_name: string };

type Shift = {
  id: number;
  employee_id: string;
  employee_name: string;
  work_date: string;
  start_time: string;
  end_time: string;
};

type AttendanceRow = {
  id: string;
  employee_id: string;
  employee_name: string;
  clock_in: string;
  clock_out: string | null;
  shift_id: number | null;
  scheduled_start: string | null;
  scheduled_end: string | null;
  worked_hours: number;
  late_minutes: number | null;
};

const DAY_LABELS = ["Du", "Se", "Ch", "Pa", "Ju", "Sh", "Ya"];

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function mondayOf(d: Date): Date {
  const copy = new Date(d);
  const dow = copy.getDay(); // 0 = Sunday
  const diff = dow === 0 ? -6 : 1 - dow;
  copy.setDate(copy.getDate() + diff);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function addDays(d: Date, n: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  return copy;
}

function hhmm(t: string | null): string {
  if (!t) return "—";
  return t.slice(0, 5);
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

export default function HrShiftsPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [weekStart, setWeekStart] = useState(() => mondayOf(new Date()));
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [shiftsLoading, setShiftsLoading] = useState(true);

  const [editCell, setEditCell] = useState<{
    employeeId: string;
    employeeName: string;
    workDate: string;
    existing: Shift | null;
  } | null>(null);
  const [editForm, setEditForm] = useState({ start_time: "09:00", end_time: "18:00" });
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<Shift | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [attendanceEmployee, setAttendanceEmployee] = useState("");
  const [attendanceFrom, setAttendanceFrom] = useState(toISODate(weekStart));
  const [attendanceTo, setAttendanceTo] = useState(toISODate(addDays(weekStart, 6)));
  const [attendanceItems, setAttendanceItems] = useState<AttendanceRow[]>([]);
  const [attendanceSummary, setAttendanceSummary] = useState({
    days_present: 0,
    total_worked_hours: 0,
    total_late_minutes: 0,
  });
  const [attendanceLoading, setAttendanceLoading] = useState(true);

  const [clockEmployee, setClockEmployee] = useState("");
  const [clockBusy, setClockBusy] = useState(false);

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  const loadShifts = useCallback(async () => {
    setShiftsLoading(true);
    try {
      const res = await api.get<Shift[]>("/hr/shifts", {
        params: { from: toISODate(weekStart), to: toISODate(addDays(weekStart, 6)) },
      });
      setShifts(res.data);
    } catch (e) {
      toast.error(getErrorMessage(e, "Jadvalni yuklashda xatolik"));
    } finally {
      setShiftsLoading(false);
    }
  }, [weekStart]);

  const loadAttendance = useCallback(async () => {
    setAttendanceLoading(true);
    try {
      const params: Record<string, string> = { from: attendanceFrom, to: attendanceTo };
      if (attendanceEmployee) params.employee_id = attendanceEmployee;
      const res = await api.get("/hr/attendance", { params });
      setAttendanceItems(res.data.items);
      setAttendanceSummary(res.data.summary);
    } catch (e) {
      toast.error(getErrorMessage(e, "Kelish-ketish hisobotini yuklashda xatolik"));
    } finally {
      setAttendanceLoading(false);
    }
  }, [attendanceFrom, attendanceTo, attendanceEmployee]);

  useEffect(() => {
    api.get<Employee[]>("/hr/employees").then((r) => setEmployees(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    loadShifts();
  }, [loadShifts]);

  useEffect(() => {
    loadAttendance();
  }, [loadAttendance]);

  function shiftAt(employeeId: string, workDate: string): Shift | null {
    return shifts.find((s) => s.employee_id === employeeId && s.work_date === workDate) ?? null;
  }

  function openCell(employeeId: string, employeeName: string, workDate: string) {
    const existing = shiftAt(employeeId, workDate);
    setEditCell({ employeeId, employeeName, workDate, existing });
    setEditForm({
      start_time: existing ? hhmm(existing.start_time) : "09:00",
      end_time: existing ? hhmm(existing.end_time) : "18:00",
    });
  }

  async function saveShift() {
    if (!editCell) return;
    if (editForm.end_time <= editForm.start_time) {
      toast.error("Tugash vaqti boshlanish vaqtidan keyin bo'lishi kerak");
      return;
    }
    setSaving(true);
    try {
      await api.post("/hr/shifts", {
        employee_id: editCell.employeeId,
        work_date: editCell.workDate,
        start_time: editForm.start_time,
        end_time: editForm.end_time,
      });
      toast.success("Jadval saqlandi");
      setEditCell(null);
      loadShifts();
    } catch (e) {
      toast.error(getErrorMessage(e, "Saqlashda xatolik"));
    } finally {
      setSaving(false);
    }
  }

  async function deleteShift() {
    if (!deleteConfirm) return;
    setDeleting(true);
    try {
      await api.delete(`/hr/shifts/${deleteConfirm.id}`);
      toast.success("Jadval o'chirildi");
      setDeleteConfirm(null);
      setEditCell(null);
      loadShifts();
    } catch (e) {
      toast.error(getErrorMessage(e, "O'chirishda xatolik"));
    } finally {
      setDeleting(false);
    }
  }

  async function doClockIn() {
    if (!clockEmployee) {
      toast.error("Xodimni tanlang");
      return;
    }
    setClockBusy(true);
    try {
      await api.post("/hr/attendance/clock-in", { employee_id: clockEmployee });
      toast.success("Kelish vaqti qayd etildi");
      loadAttendance();
    } catch (e) {
      toast.error(getErrorMessage(e, "Clock-in xatolik"));
    } finally {
      setClockBusy(false);
    }
  }

  async function doClockOut() {
    if (!clockEmployee) {
      toast.error("Xodimni tanlang");
      return;
    }
    setClockBusy(true);
    try {
      await api.post("/hr/attendance/clock-out", { employee_id: clockEmployee });
      toast.success("Ketish vaqti qayd etildi");
      loadAttendance();
    } catch (e) {
      toast.error(getErrorMessage(e, "Clock-out xatolik"));
    } finally {
      setClockBusy(false);
    }
  }

  const attendanceColumns: Column<AttendanceRow>[] = [
    {
      key: "clock_in",
      header: "Sana",
      width: "100px",
      render: (r) => new Date(r.clock_in).toLocaleDateString("ru-RU"),
    },
    { key: "employee_name", header: "Xodim" },
    { key: "scheduled_start", header: "Reja", width: "110px", render: (r) => r.scheduled_start ? `${hhmm(r.scheduled_start)}–${hhmm(r.scheduled_end)}` : "—" },
    { key: "clock_in_time" as any, header: "Keldi", width: "90px", render: (r) => fmtDateTime(r.clock_in) },
    { key: "clock_out_time" as any, header: "Ketdi", width: "90px", render: (r) => fmtDateTime(r.clock_out) },
    {
      key: "worked_hours",
      header: "Soat",
      width: "90px",
      align: "right",
      render: (r) => <span className="font-mono">{Number(r.worked_hours).toFixed(2)}</span>,
    },
    {
      key: "late_minutes",
      header: "Kechikish",
      width: "110px",
      align: "right",
      render: (r) =>
        r.late_minutes === null ? (
          "—"
        ) : (
          <span
            className={`font-mono ${
              Number(r.late_minutes) > 0
                ? "text-danger-700 dark:text-danger-500"
                : "text-success-700 dark:text-success-500"
            }`}
          >
            {Math.round(Number(r.late_minutes))} min
          </span>
        ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ish jadvali va kelish-ketish"
        description="Xodimlar uchun haftalik ish jadvali, clock-in/clock-out va kelish-ketish hisoboti (kassir smenasi emas)"
      />

      <Card>
        <CardHeader
          title="Haftalik jadval"
          description={`${toISODate(weekStart)} — ${toISODate(addDays(weekStart, 6))}`}
          actions={
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" onClick={() => setWeekStart(addDays(weekStart, -7))}>
                <ChevronLeft size={14} />
              </Button>
              <Button variant="outline" size="sm" onClick={() => setWeekStart(mondayOf(new Date()))}>
                Bugun
              </Button>
              <Button variant="outline" size="sm" onClick={() => setWeekStart(addDays(weekStart, 7))}>
                <ChevronRight size={14} />
              </Button>
            </div>
          }
        />
        <CardBody padding="none">
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-ink-500 dark:text-ink-500 text-[11px] uppercase tracking-wider border-b border-ink-200/60 dark:border-ink-800/60">
                  <th className="text-left px-3 py-2 font-medium sticky left-0 bg-white dark:bg-ink-950">Xodim</th>
                  {days.map((d, i) => (
                    <th key={i} className="text-center px-2 py-2 font-medium min-w-[110px]">
                      {DAY_LABELS[i]} {d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" })}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {shiftsLoading ? (
                  <tr>
                    <td colSpan={8} className="text-center py-10 text-ink-400">
                      Yuklanmoqda...
                    </td>
                  </tr>
                ) : employees.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-10 text-ink-400">
                      Xodimlar topilmadi
                    </td>
                  </tr>
                ) : (
                  employees.map((emp) => (
                    <tr key={emp.id} className="border-b border-ink-100 dark:border-ink-800/40 last:border-0">
                      <td className="px-3 py-2 sticky left-0 bg-white dark:bg-ink-950 text-ink-800 dark:text-ink-200 whitespace-nowrap">
                        {emp.full_name}
                      </td>
                      {days.map((d, i) => {
                        const wd = toISODate(d);
                        const shift = shiftAt(emp.id, wd);
                        return (
                          <td key={i} className="px-1.5 py-1.5 text-center">
                            {shift ? (
                              <button
                                onClick={() => openCell(emp.id, emp.full_name, wd)}
                                className="w-full rounded-md px-1.5 py-1 text-[12px] bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300 hover:bg-brand-100 dark:hover:bg-brand-900/30 transition-colors font-mono"
                                title="Tahrirlash"
                              >
                                {hhmm(shift.start_time)}–{hhmm(shift.end_time)}
                              </button>
                            ) : (
                              <button
                                onClick={() => openCell(emp.id, emp.full_name, wd)}
                                className="w-full rounded-md p-1 text-ink-300 dark:text-ink-700 hover:bg-ink-100 dark:hover:bg-ink-800 hover:text-ink-500 transition-colors flex items-center justify-center"
                                title="Jadval qo'shish"
                              >
                                <Plus size={14} />
                              </button>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>

      <Card padding="md">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[220px]">
            <label className="text-xs text-ink-500 dark:text-ink-400 block mb-1">Xodim (clock-in/out)</label>
            <select className={input} value={clockEmployee} onChange={(e) => setClockEmployee(e.target.value)}>
              <option value="">Tanlang...</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.full_name}
                </option>
              ))}
            </select>
          </div>
          <Button variant="success" size="sm" onClick={doClockIn} loading={clockBusy} icon={LogIn}>
            Keldi (clock-in)
          </Button>
          <Button variant="danger" size="sm" onClick={doClockOut} loading={clockBusy} icon={LogOut}>
            Ketdi (clock-out)
          </Button>
        </div>
      </Card>

      <Card padding="md" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div>
          <label className="text-xs text-ink-500 dark:text-ink-400 block mb-1">Xodim</label>
          <select
            className={input}
            value={attendanceEmployee}
            onChange={(e) => setAttendanceEmployee(e.target.value)}
          >
            <option value="">Hammasi</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.full_name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-ink-500 dark:text-ink-400 block mb-1">Dan</label>
          <input
            type="date"
            className={input}
            value={attendanceFrom}
            onChange={(e) => setAttendanceFrom(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs text-ink-500 dark:text-ink-400 block mb-1">Gacha</label>
          <input
            type="date"
            className={input}
            value={attendanceTo}
            onChange={(e) => setAttendanceTo(e.target.value)}
          />
        </div>
        <div className="flex items-end">
          <Button variant="outline" onClick={loadAttendance} fullWidth>
            Filtrlash
          </Button>
        </div>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatWidget label="Kunlar" value={attendanceSummary.days_present} color="ink" />
        <StatWidget label="Jami soat" value={attendanceSummary.total_worked_hours.toFixed(2)} color="info" mono />
        <StatWidget
          label="Jami kechikish (min)"
          value={Math.round(attendanceSummary.total_late_minutes)}
          color={attendanceSummary.total_late_minutes > 0 ? "danger" : "success"}
        />
      </div>

      <DataTable columns={attendanceColumns} rows={attendanceItems} loading={attendanceLoading} emptyText="Yozuvlar topilmadi" />

      <Modal
        open={!!editCell}
        onClose={() => setEditCell(null)}
        size="sm"
        title={editCell ? `${editCell.employeeName} — ${editCell.workDate}` : ""}
      >
        {editCell && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Boshlanish" required>
                <input
                  type="time"
                  className={input}
                  value={editForm.start_time}
                  onChange={(e) => setEditForm({ ...editForm, start_time: e.target.value })}
                />
              </Field>
              <Field label="Tugash" required>
                <input
                  type="time"
                  className={input}
                  value={editForm.end_time}
                  onChange={(e) => setEditForm({ ...editForm, end_time: e.target.value })}
                />
              </Field>
            </div>
            <div className="flex justify-between gap-2 pt-2 border-t border-ink-200 dark:border-ink-800">
              {editCell.existing ? (
                <Button
                  variant="danger"
                  size="sm"
                  icon={Trash2}
                  onClick={() => setDeleteConfirm(editCell.existing)}
                >
                  O'chirish
                </Button>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setEditCell(null)}>
                  Bekor
                </Button>
                <Button size="sm" onClick={saveShift} loading={saving}>
                  Saqlash
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={deleteConfirm !== null}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={deleteShift}
        title="Jadvalni o'chirish"
        message={
          deleteConfirm
            ? `${editCell?.employeeName ?? ""} uchun ${deleteConfirm.work_date} kuni jadval o'chirilsinmi?`
            : ""
        }
        confirmLabel="O'chirish"
        loading={deleting}
      />
    </div>
  );
}
