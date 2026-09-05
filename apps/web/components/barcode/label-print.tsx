"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Modal, Field, input } from "@/components/ui/modal";
import { Printer, Download, Loader2 } from "lucide-react";

export interface LabelData {
  name: string;
  barcode: string;
  price?: number;
  unit?: string;
}

export type LabelFormat = "A4" | "58mm" | "80mm";
export type BarcodeType = "CODE128" | "EAN13" | "QR";

interface LabelPrintProps {
  items: LabelData[];
  format?: LabelFormat;
  open: boolean;
  onClose: () => void;
}

export interface LabelPrintButtonProps {
  labels: LabelData[];
  format?: LabelFormat;
  copiesPerLabel?: number;
  barcodeType?: BarcodeType;
}

const COPIES_MIN = 1;
const COPIES_MAX = 100;

const A4_COLS = 4;
const A4_ROWS = 8;
const A4_PER_PAGE = A4_COLS * A4_ROWS;

function useBarcodeRefs(count: number) {
  const refs = useRef<(SVGSVGElement | null)[]>([]);
  refs.current = Array.from({ length: count }, (_, i) => refs.current[i] ?? null);
  return refs;
}

function renderBarcode(
  el: SVGSVGElement | HTMLCanvasElement,
  value: string,
  type: BarcodeType,
  height: number
) {
  if (type === "QR") {
    return;
  }
  const format = type === "EAN13" ? "EAN13" : "CODE128";
  return import("jsbarcode").then(({ default: JsBarcode }) => {
    try {
      JsBarcode(el, value, {
        format,
        width: 1.2,
        height,
        displayValue: false,
        margin: 0,
      });
    } catch {
      // invalid barcode — leave empty
    }
  });
}

function SingleLabel({
  item,
  svgRef,
  width,
}: {
  item: LabelData;
  svgRef: (el: SVGSVGElement | null) => void;
  width: number;
}) {
  return (
    <div
      style={{
        width,
        boxSizing: "border-box",
        padding: "4px 6px",
        border: "0.5px solid #ccc",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 2,
        background: "#fff",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          fontSize: 9,
          fontWeight: 700,
          textAlign: "center",
          width: "100%",
          lineHeight: 1.2,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          color: "#000",
        }}
      >
        {item.name}
      </div>
      <svg ref={svgRef} style={{ width: "100%", maxHeight: 40 }} />
      <div
        style={{
          fontSize: 8,
          color: "#333",
          display: "flex",
          justifyContent: "space-between",
          width: "100%",
        }}
      >
        <span>{item.barcode}</span>
        {item.price != null && (
          <span style={{ fontWeight: 700 }}>
            {item.price.toLocaleString()} {item.unit ?? ""}
          </span>
        )}
      </div>
    </div>
  );
}

function BarcodeGrid({
  rows,
  format,
  barcodeType,
}: {
  rows: LabelData[];
  format: LabelFormat;
  barcodeType: BarcodeType;
}) {
  const isThermal = format === "58mm" || format === "80mm";
  const colWidth = format === "80mm" ? 302 : format === "58mm" ? 220 : 237;
  const refs = useBarcodeRefs(rows.length);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (barcodeType === "QR") return;
      const JsBarcode = (await import("jsbarcode")).default;
      if (cancelled) return;
      const jsFormat = barcodeType === "EAN13" ? "EAN13" : "CODE128";
      refs.current.forEach((el, i) => {
        if (!el || !rows[i]?.barcode) return;
        try {
          JsBarcode(el, rows[i].barcode, {
            format: jsFormat,
            width: 1.2,
            height: 32,
            displayValue: false,
            margin: 0,
          });
        } catch {
          // invalid barcode value
        }
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [rows, barcodeType]);

  if (isThermal) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {rows.map((item, i) => (
          <SingleLabel
            key={i}
            item={item}
            width={colWidth}
            svgRef={(el) => {
              refs.current[i] = el;
            }}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${A4_COLS}, ${colWidth}px)`,
        gap: 2,
      }}
    >
      {rows.map((item, i) => (
        <SingleLabel
          key={i}
          item={item}
          width={colWidth}
          svgRef={(el) => {
            refs.current[i] = el;
          }}
        />
      ))}
    </div>
  );
}

function expandWithCopies(items: LabelData[], copies: number): LabelData[] {
  const out: LabelData[] = [];
  for (const item of items) {
    for (let c = 0; c < copies; c++) out.push(item);
  }
  return out;
}

export function LabelPrint({
  items,
  format: defaultFormat = "A4",
  open,
  onClose,
}: LabelPrintProps) {
  const t = useTranslations("barcode");
  const [format, setFormat] = useState<LabelFormat>(defaultFormat);
  const [barcodeType, setBarcodeType] = useState<BarcodeType>("CODE128");
  const [copies, setCopies] = useState(1);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  const expanded = expandWithCopies(items, copies);

  async function handlePrint() {
    if (!printRef.current) return;
    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) return;

    win.document.write(`
      <html>
        <head>
          <title>Labels</title>
          <style>
            body { margin: 0; padding: 0; background: #fff; }
            @media print {
              @page {
                size: ${format === "58mm" ? "58mm auto" : format === "80mm" ? "80mm auto" : "A4 portrait"};
                margin: ${format === "A4" ? "8mm" : "2mm"};
              }
            }
          </style>
        </head>
        <body>
          ${printRef.current.innerHTML}
        </body>
      </html>
    `);
    win.document.close();
    win.focus();
    win.onload = () => {
      win.print();
      win.close();
    };
  }

  async function handleDownloadPdf() {
    setPdfError(null);
    setPdfLoading(true);
    try {
      const [{ jsPDF }, JsBarcodeModule] = await Promise.all([
        import("jspdf"),
        import("jsbarcode"),
      ]);
      const JsBarcode = JsBarcodeModule.default;

      const isA4 = format === "A4";
      const is80 = format === "80mm";
      const pageW = isA4 ? 210 : is80 ? 80 : 58;
      const pageH = isA4 ? 297 : undefined;
      const labelW = isA4 ? pageW / A4_COLS : pageW - 4;
      const labelH = isA4 ? (pageH! - 16) / A4_ROWS : 25;
      const marginX = isA4 ? 0 : 2;
      const marginY = isA4 ? 8 : 2;

      const pdfFormat: [number, number] | "a4" = isA4
        ? "a4"
        : is80
        ? [80, 200]
        : [58, 200];

      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: pdfFormat,
      });

      const jsFormat = barcodeType === "EAN13" ? "EAN13" : "CODE128";

      let page = 0;
      for (let i = 0; i < expanded.length; i++) {
        const item = expanded[i];
        const col = isA4 ? i % A4_COLS : 0;
        const row = isA4 ? Math.floor(i / A4_COLS) % A4_ROWS : i;
        const pageIdx = isA4 ? Math.floor(i / A4_PER_PAGE) : i;

        if (pageIdx > page) {
          pdf.addPage(pdfFormat, "portrait");
          page = pageIdx;
        }

        const x = marginX + col * labelW;
        const y = marginY + (isA4 ? row * labelH : 0);

        pdf.setFontSize(6);
        pdf.setFont("helvetica", "bold");
        pdf.text(item.name.slice(0, 40), x + labelW / 2, y + 3, {
          align: "center",
          maxWidth: labelW - 2,
        });

        if (item.barcode && barcodeType !== "QR") {
          try {
            const canvas = document.createElement("canvas");
            JsBarcode(canvas, item.barcode, {
              format: jsFormat,
              width: 1.2,
              height: 40,
              displayValue: false,
              margin: 0,
            });
            const dataUrl = canvas.toDataURL("image/png");
            pdf.addImage(dataUrl, "PNG", x + 1, y + 4.5, labelW - 2, 10);
          } catch {
            // barcode invalid
          }
        }

        pdf.setFontSize(5);
        pdf.setFont("helvetica", "normal");
        pdf.text(item.barcode || "", x + 1, y + 16);
        if (item.price != null) {
          pdf.setFont("helvetica", "bold");
          pdf.text(
            `${item.price.toLocaleString()} ${item.unit ?? ""}`,
            x + labelW - 1,
            y + 16,
            { align: "right" }
          );
        }

        if (isA4) {
          pdf.setDrawColor(200);
          pdf.rect(x, y, labelW, labelH);
        }
      }

      pdf.save("labels.pdf");
    } catch {
      setPdfError(t("error_pdf"));
    } finally {
      setPdfLoading(false);
    }
  }

  if (!open) return null;

  return (
    <Modal open={open} onClose={onClose} title={t("title")} size="xl">
      <div className="space-y-4">
        <div className="flex flex-wrap gap-4 items-end">
          <Field label={t("format")}>
            <select
              className={input}
              value={format}
              onChange={(e) => setFormat(e.target.value as LabelFormat)}
            >
              <option value="A4">{t("format_a4")}</option>
              <option value="58mm">{t("format_58mm")}</option>
              <option value="80mm">{t("print.format_80mm")}</option>
            </select>
          </Field>

          <Field label={t("print.barcode_type")}>
            <select
              className={input}
              value={barcodeType}
              onChange={(e) => setBarcodeType(e.target.value as BarcodeType)}
            >
              <option value="CODE128">CODE128</option>
              <option value="EAN13">EAN-13</option>
            </select>
          </Field>

          <Field label={t("copies")} hint={t("copies_hint")}>
            <input
              type="number"
              className={input}
              style={{ width: 80 }}
              min={COPIES_MIN}
              max={COPIES_MAX}
              value={copies}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                if (!isNaN(v))
                  setCopies(Math.min(COPIES_MAX, Math.max(COPIES_MIN, v)));
              }}
            />
          </Field>

          <div className="flex gap-2 pb-0.5">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-brand-600 hover:bg-brand-700 text-white text-[13px] font-medium transition-colors"
            >
              <Printer size={14} />
              {t("print")}
            </button>
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={pdfLoading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-ink-300 dark:border-ink-700 bg-white dark:bg-ink-900 text-ink-700 dark:text-ink-200 text-[13px] font-medium hover:bg-ink-50 dark:hover:bg-ink-800 transition-colors disabled:opacity-50"
            >
              {pdfLoading ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Download size={14} />
              )}
              {t("download_pdf")}
            </button>
          </div>
        </div>

        {pdfError && (
          <p className="text-[12px] text-rose-600 dark:text-rose-400">
            {pdfError}
          </p>
        )}

        {items.length === 0 ? (
          <p className="text-[13px] text-ink-500 py-8 text-center">
            {t("no_items")}
          </p>
        ) : (
          <div className="overflow-auto max-h-[55vh] border border-ink-200 dark:border-ink-800 rounded-md p-2 bg-ink-50 dark:bg-ink-950">
            <div ref={printRef}>
              <BarcodeGrid
                rows={expanded}
                format={format}
                barcodeType={barcodeType}
              />
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

export function LabelPrintButton({
  labels,
  format = "A4",
  copiesPerLabel = 1,
  barcodeType: _barcodeType = "CODE128",
}: LabelPrintButtonProps) {
  const t = useTranslations("barcode");
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-brand-600 hover:bg-brand-700 text-white text-[13px] font-medium transition-colors"
      >
        <Printer size={14} />
        {t("print")}
      </button>
      <LabelPrint
        items={labels}
        format={format}
        open={open}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

export function openLabelPrint(
  items: LabelData[],
  options?: { format?: LabelFormat }
): Promise<void> {
  return new Promise((resolve) => {
    const container = document.createElement("div");
    document.body.appendChild(container);

    function cleanup() {
      import("react-dom/client").then(({ createRoot }) => {
        root.unmount();
        document.body.removeChild(container);
        resolve();
      });
    }

    let root: ReturnType<typeof import("react-dom/client")["createRoot"]>;
    import("react-dom/client").then(({ createRoot }) => {
      root = createRoot(container);
      root.render(
        <LabelPrint
          items={items}
          format={options?.format ?? "A4"}
          open
          onClose={cleanup}
        />
      );
    });
  });
}
