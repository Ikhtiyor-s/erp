"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import {
  Lock, Pencil, RotateCw, Ban, Copy, Check, AlertTriangle, MonitorSmartphone,
} from "lucide-react";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/api-error";
import { usePermissions } from "@/lib/permissions";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Modal, Field, input } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

type KioskDevice = {
  id: string;
  name: string;
  cashbox_id: number;
  cashbox_name?: string | null;
  warehouse_name?: string | null;
  token_prefix: string;
  status: "active" | "revoked";
  last_used_at: string | null;
  created_at: string;
};

type Cashbox = { id: number; name: string };

type TokenReveal = { token: string; token_prefix: string } | null;

const emptyForm = { name: "", cashbox_id: "" as number | "" };

function CopyField({ value, t }: { value: string; t: (k: string) => string }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="relative">
      <input
        readOnly
        value={value}
        onFocus={(e) => e.target.select()}
        className={`${input} pr-9 font-mono text-[12px]`}
      />
      <button
        type="button"
        onClick={copy}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-600 dark:hover:text-ink-300"
        tabIndex={-1}
        title={copied ? t("copied") : t("copy")}
      >
        {copied ? (
          <Check size={15} className="text-success-600 dark:text-success-500" />
        ) : (
          <Copy size={15} />
        )}
      </button>
    </div>
  );
}

function TokenRevealModal({
  reveal,
  onClose,
  t,
}: {
  reveal: TokenReveal;
  onClose: () => void;
  t: (k: string) => string;
}) {
  return (
    <Modal open={!!reveal} onClose={onClose} title={t("token_modal_title")} size="sm">
      {reveal && (
        <div className="space-y-4">
          <div className="flex gap-3">
            <div className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center bg-warn-50 text-warn-600 dark:bg-warn-500/15 dark:text-warn-500">
              <AlertTriangle size={18} aria-hidden="true" />
            </div>
            <p className="text-sm text-ink-700 dark:text-ink-300 leading-relaxed">
              {t("token_warning")}
            </p>
          </div>
          <CopyField value={reveal.token} t={t} />
          <Button type="button" fullWidth onClick={onClose}>
            {t("token_ack")}
          </Button>
        </div>
      )}
    </Modal>
  );
}

function RestrictedAccess({ t, tc }: { t: (k: string) => string; tc: (k: string) => string }) {
  return (
    <Card className="p-12 text-center">
      <Lock size={40} className="mx-auto text-ink-400 mb-4" />
      <h2 className="text-lg font-semibold mb-2 text-ink-900 dark:text-ink-100">
        {tc("no_permission")}
      </h2>
      <p className="text-sm text-ink-500 dark:text-ink-400 max-w-md mx-auto">
        {t("restricted_desc")}
      </p>
    </Card>
  );
}

function fmtDate(v: string | null) {
  if (!v) return null;
  return new Date(v).toLocaleString("ru-RU");
}

export default function KioskDevicesPage() {
  const t = useTranslations("kiosk");
  const tc = useTranslations("common");
  const { can, loading: permLoading } = usePermissions();

  const canView = can("kiosk.view");
  const canCreate = can("kiosk.create");
  const canUpdate = can("kiosk.update");
  const canDelete = can("kiosk.delete");

  const [rows, setRows] = useState<KioskDevice[]>([]);
  const [cashboxes, setCashboxes] = useState<Cashbox[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<KioskDevice | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [tokenReveal, setTokenReveal] = useState<TokenReveal>(null);

  const [rotateTarget, setRotateTarget] = useState<KioskDevice | null>(null);
  const [rotating, setRotating] = useState(false);

  const [revokeTarget, setRevokeTarget] = useState<KioskDevice | null>(null);
  const [revoking, setRevoking] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    Promise.all([
      api.get<KioskDevice[]>("/kiosk-devices"),
      api.get<Cashbox[]>("/finance/cashboxes"),
    ])
      .then(([devicesRes, cashboxesRes]) => {
        setRows(Array.isArray(devicesRes.data) ? devicesRes.data : []);
        setCashboxes(Array.isArray(cashboxesRes.data) ? cashboxesRes.data : []);
      })
      .catch((e) => setLoadError(getErrorMessage(e, t("load_error"))))
      .finally(() => setLoading(false));
  }, [t]);

  useEffect(() => {
    if (!permLoading && canView) load();
  }, [permLoading, canView, load]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setFormError(null);
    setFormOpen(true);
  }

  function openEdit(row: KioskDevice) {
    setEditing(row);
    setForm({ name: row.name, cashbox_id: row.cashbox_id });
    setFormError(null);
    setFormOpen(true);
  }

  async function submitForm() {
    if (!form.name.trim()) {
      setFormError(t("validation_name_required"));
      return;
    }
    if (!form.cashbox_id) {
      setFormError(t("validation_cashbox_required"));
      return;
    }
    setFormError(null);
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/kiosk-devices/${editing.id}`, {
          name: form.name.trim(),
          cashbox_id: form.cashbox_id,
        });
        toast.success(t("updated_toast"));
        setFormOpen(false);
        load();
      } else {
        const r = await api.post<{ token: string; token_prefix: string }>("/kiosk-devices", {
          name: form.name.trim(),
          cashbox_id: form.cashbox_id,
        });
        toast.success(t("created_toast"));
        setFormOpen(false);
        setTokenReveal({ token: r.data.token, token_prefix: r.data.token_prefix });
        load();
      }
    } catch (e) {
      setFormError(getErrorMessage(e, tc("error")));
    } finally {
      setSaving(false);
    }
  }

  async function confirmRotate() {
    if (!rotateTarget) return;
    setRotating(true);
    try {
      const r = await api.post<{ token: string; token_prefix: string }>(
        `/kiosk-devices/${rotateTarget.id}/rotate`,
      );
      toast.success(t("rotated_toast"));
      setRotateTarget(null);
      setTokenReveal({ token: r.data.token, token_prefix: r.data.token_prefix });
      load();
    } catch (e) {
      toast.error(getErrorMessage(e, tc("error")));
    } finally {
      setRotating(false);
    }
  }

  async function confirmRevoke() {
    if (!revokeTarget) return;
    setRevoking(true);
    try {
      await api.delete(`/kiosk-devices/${revokeTarget.id}`);
      toast.success(t("revoked_toast"));
      const revokedId = revokeTarget.id;
      setRows((prev) =>
        prev.map((r) => (r.id === revokedId ? { ...r, status: "revoked" } : r)),
      );
      setRevokeTarget(null);
      load();
    } catch (e) {
      toast.error(getErrorMessage(e, tc("error")));
    } finally {
      setRevoking(false);
    }
  }

  const cols: Column<KioskDevice>[] = [
    { key: "name", header: t("col_name") },
    { key: "cashbox_name", header: t("col_cashbox"), render: (r) => r.cashbox_name || "—" },
    { key: "warehouse_name", header: t("col_warehouse"), render: (r) => r.warehouse_name || "—" },
    {
      key: "token_prefix",
      header: t("col_token"),
      render: (r) => <code className="text-[12px] text-ink-500 dark:text-ink-400">{r.token_prefix}…</code>,
    },
    {
      key: "status",
      header: t("col_status"),
      render: (r) => (
        <Badge tone={r.status === "active" ? "success" : "neutral"} dot>
          {r.status === "active" ? t("status_active") : t("status_revoked")}
        </Badge>
      ),
    },
    {
      key: "last_used_at",
      header: t("col_last_used"),
      render: (r) => fmtDate(r.last_used_at) || <span className="text-ink-400">{t("never_used")}</span>,
    },
    { key: "created_at", header: t("col_created"), render: (r) => fmtDate(r.created_at) || "—" },
    ...(canUpdate || canDelete
      ? [
          {
            key: "actions",
            header: "",
            align: "right" as const,
            render: (r: KioskDevice) => (
              <div className="inline-flex items-center gap-0.5">
                {canUpdate && (
                  <button
                    type="button"
                    onClick={() => openEdit(r)}
                    className="p-1 rounded hover:bg-ink-200/70 dark:hover:bg-ink-800 text-ink-500 dark:text-ink-400 hover:text-ink-900 dark:hover:text-ink-100 transition-colors"
                    title={tc("edit")}
                    aria-label={tc("edit")}
                  >
                    <Pencil size={13} />
                  </button>
                )}
                {canUpdate && r.status === "active" && (
                  <button
                    type="button"
                    onClick={() => setRotateTarget(r)}
                    className="p-1 rounded hover:bg-ink-200/70 dark:hover:bg-ink-800 text-ink-500 dark:text-ink-400 hover:text-ink-900 dark:hover:text-ink-100 transition-colors"
                    title={t("rotate_action")}
                    aria-label={t("rotate_action")}
                  >
                    <RotateCw size={13} />
                  </button>
                )}
                {canDelete && r.status === "active" && (
                  <button
                    type="button"
                    onClick={() => setRevokeTarget(r)}
                    className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/30 text-ink-500 dark:text-ink-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                    title={t("revoke_action")}
                    aria-label={t("revoke_action")}
                  >
                    <Ban size={13} />
                  </button>
                )}
              </div>
            ),
          },
        ]
      : []),
  ];

  if (permLoading) {
    return <div className="text-ink-400 dark:text-ink-500 text-center py-16 text-sm">{tc("loading")}</div>;
  }

  if (!canView) {
    return (
      <div className="space-y-6">
        <PageHeader title={t("title")} description={t("description")} />
        <RestrictedAccess t={t} tc={tc} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        description={t("description")}
        onCreate={canCreate ? openCreate : undefined}
        createLabel={t("create_button")}
      />

      {loadError ? (
        <Card className="p-8 text-center">
          <MonitorSmartphone size={32} className="mx-auto text-ink-400 mb-3" />
          <p className="text-sm text-danger-600 dark:text-danger-500 mb-3">{loadError}</p>
          <Button type="button" variant="outline" size="sm" onClick={load}>
            {t("retry")}
          </Button>
        </Card>
      ) : (
        <DataTable
          columns={cols}
          rows={rows}
          loading={loading}
          emptyText={t("empty_title")}
          emptyHint={canCreate ? t("empty_hint") : undefined}
        />
      )}

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? t("edit_modal_title") : t("create_modal_title")}
      >
        <div className="space-y-3">
          <Field label={t("field_name")} required>
            <input
              className={input}
              value={form.name}
              placeholder={t("field_name_placeholder")}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              autoFocus
            />
          </Field>
          <Field label={t("field_cashbox")} required>
            <select
              className={input}
              value={form.cashbox_id}
              onChange={(e) => setForm({ ...form, cashbox_id: e.target.value ? Number(e.target.value) : "" })}
              disabled={cashboxes.length === 0}
            >
              <option value="">{t("cashbox_placeholder")}</option>
              {cashboxes.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </Field>
          {cashboxes.length === 0 && (
            <p className="text-[12px] text-ink-500 dark:text-ink-400">{t("no_cashboxes")}</p>
          )}
          {formError && <p className="text-[12px] text-danger-600 dark:text-danger-500">{formError}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
              {tc("cancel")}
            </Button>
            <Button type="button" onClick={submitForm} loading={saving}>
              {tc("save")}
            </Button>
          </div>
        </div>
      </Modal>

      <TokenRevealModal reveal={tokenReveal} onClose={() => setTokenReveal(null)} t={t} />

      <ConfirmDialog
        open={!!rotateTarget}
        onClose={() => setRotateTarget(null)}
        onConfirm={confirmRotate}
        loading={rotating}
        variant="warning"
        title={t("rotate_confirm_title")}
        message={t("rotate_confirm_message")}
        confirmLabel={t("rotate_confirm_label")}
      />

      <ConfirmDialog
        open={!!revokeTarget}
        onClose={() => setRevokeTarget(null)}
        onConfirm={confirmRevoke}
        loading={revoking}
        variant="danger"
        title={t("revoke_confirm_title")}
        message={t("revoke_confirm_message")}
        confirmLabel={t("revoke_confirm_label")}
      />
    </div>
  );
}
