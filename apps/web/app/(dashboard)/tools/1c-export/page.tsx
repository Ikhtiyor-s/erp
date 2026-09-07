"use client";

import { useState } from "react";
import { Download, Eye, FileText, FileCode } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/api-error";
import { PageHeader } from "@/components/ui/page-header";
import { Field, input } from "@/components/ui/modal";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";

type ExportType = "sales" | "cash" | "counterparties" | "all";
type ExportFormat = "csv" | "xml";

const MAX_RANGE_DAYS = 366;

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function buildFilename(type: ExportType, format: ExportFormat, dateFrom: string): string {
  return `1c-${type}-${dateFrom}.${format}`;
}

function daysBetween(a: string, b: string): number {
  return (new Date(b).getTime() - new Date(a).getTime()) / 86_400_000;
}

function getFilenameFromHeaders(headers: Record<string, string>, fallback: string): string {
  const cd = headers["content-disposition"] ?? "";
  const match = cd.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
  if (match) return match[1].replace(/['"]/g, "");
  return fallback;
}

export default function OnecExportPage() {
  const t = useTranslations("tools.onec_export");

  const [exportType, setExportType] = useState<ExportType>("sales");
  const [dateFrom, setDateFrom] = useState(daysAgo(30));
  const [dateTo, setDateTo] = useState(today());
  const [format, setFormat] = useState<ExportFormat>("csv");
  const [downloading, setDownloading] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [previewRows, setPreviewRows] = useState<string[] | null>(null);

  function validate(): boolean {
    if (!dateFrom || !dateTo) {
      toast.error(t("error_date_range"));
      return false;
    }
    if (dateFrom > dateTo) {
      toast.error(t("error_date_range"));
      return false;
    }
    if (daysBetween(dateFrom, dateTo) > MAX_RANGE_DAYS) {
      toast.error(t("error_date_range"));
      return false;
    }
    return true;
  }

  async function handleDownload() {
    if (!validate()) return;
    setDownloading(true);
    try {
      const resp = await api.get(`/finance/export/1c-${format}`, {
        params: { type: exportType, date_from: dateFrom, date_to: dateTo },
        responseType: "blob",
      });
      const filename = getFilenameFromHeaders(
        resp.headers as Record<string, string>,
        buildFilename(exportType, format, dateFrom)
      );
      const url = URL.createObjectURL(resp.data as Blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`${t("success")}: ${filename}`);
      setPreviewRows(null);
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, t("error_date_range")));
    } finally {
      setDownloading(false);
    }
  }

  async function handlePreview() {
    if (!validate()) return;
    setPreviewing(true);
    try {
      const resp = await api.get(`/finance/export/1c-${format}`, {
        params: { type: exportType, date_from: dateFrom, date_to: dateTo, limit: 10 },
        responseType: "text",
      });
      const text = typeof resp.data === "string" ? resp.data : await (resp.data as Blob).text();
      const rows = text.split("\n").slice(0, 11).filter(Boolean);
      setPreviewRows(rows);
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, t("error_date_range")));
    } finally {
      setPreviewing(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("description")} />

      <Card padding="lg" className="max-w-2xl">
        <div className="space-y-5">
          <Field label={t("type")}>
            <select
              className={input}
              value={exportType}
              onChange={(e) => setExportType(e.target.value as ExportType)}
            >
              <option value="sales">{t("type_sales")}</option>
              <option value="cash">{t("type_cash")}</option>
              <option value="counterparties">{t("type_counterparties")}</option>
              <option value="all">{t("type_all")}</option>
            </select>
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label={t("date_from")}>
              <input
                type="date"
                className={input}
                value={dateFrom}
                max={dateTo}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </Field>
            <Field label={t("date_to")}>
              <input
                type="date"
                className={input}
                value={dateTo}
                min={dateFrom}
                max={today()}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </Field>
          </div>

          <div>
            <p className="text-sm font-medium text-ink-700 dark:text-ink-300 mb-2">
              {t("format")}
            </p>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="format"
                  value="csv"
                  checked={format === "csv"}
                  onChange={() => setFormat("csv")}
                  className="accent-brand-600"
                />
                <FileText size={16} className="text-ink-500" />
                <span className="text-sm text-ink-700 dark:text-ink-200">CSV</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="format"
                  value="xml"
                  checked={format === "xml"}
                  onChange={() => setFormat("xml")}
                  className="accent-brand-600"
                />
                <FileCode size={16} className="text-ink-500" />
                <span className="text-sm text-ink-700 dark:text-ink-200">XML</span>
              </label>
            </div>
          </div>

          <div className="pt-4 border-t border-ink-200 dark:border-ink-700 flex flex-wrap gap-3">
            <Button variant="primary" icon={Download} loading={downloading} onClick={handleDownload}>
              {downloading ? t("loading") : t("download")}
            </Button>
            <Button
              variant="outline"
              icon={Eye}
              loading={previewing}
              disabled={downloading}
              onClick={handlePreview}
            >
              {previewing ? t("loading") : t("preview")}
            </Button>
          </div>
        </div>
      </Card>

      {previewRows !== null && (
        <Card padding="md" className="max-w-2xl">
          <p className="text-xs font-semibold text-ink-500 dark:text-ink-400 uppercase tracking-wide mb-3">
            {t("preview")}
          </p>
          <div className="overflow-x-auto">
            <pre className="text-xs text-ink-700 dark:text-ink-200 whitespace-pre leading-5">
              {previewRows.length > 0 ? previewRows.join("\n") : "—"}
            </pre>
          </div>
        </Card>
      )}
    </div>
  );
}
