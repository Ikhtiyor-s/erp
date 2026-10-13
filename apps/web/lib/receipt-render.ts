export type ReceiptItemInput = {
  name: string;
  qty: number;
  price: number;
  total?: number;
};

export type ReceiptPaymentLine = {
  label: string;
  amount: number;
};

export type ReceiptData = {
  org_name?: string | null;
  org_address?: string | null;
  org_phone?: string | null;
  doc_number?: string | null;
  sale_date?: string | null;
  items: ReceiptItemInput[];
  total: number;
  paid?: number | null;
  currency?: string | null;
  footer?: string | null;
  // RG-3 — only set when the sale was actually split across 2+ payment
  // methods; a single-method sale keeps using the plain {paid} line below.
  payments?: ReceiptPaymentLine[];
  // RG-6 fold-in — only set when loyalty points were redeemed/earned on this sale.
  loyaltyRedeemed?: number;
  loyaltyEarned?: number;
};

export const DEFAULT_RECEIPT_TEMPLATE = [
  "{org_name}",
  "{org_address}",
  "{org_phone}",
  "--------------------------------",
  "Chek: {doc_number}",
  "{sale_date}",
  "--------------------------------",
  "{items}",
  "--------------------------------",
  "JAMI: {total} {currency}",
  "To'landi: {paid} {currency}",
  "{payment_lines}",
  "{loyalty_info}",
  "{footer}",
].join("\n");

function formatAmount(n: number | string | null | undefined): string {
  return Number(n || 0).toLocaleString("ru-RU", { maximumFractionDigits: 2 });
}

function renderPaymentLinesBlock(payments: ReceiptPaymentLine[] | undefined): string {
  if (!payments || payments.length < 2) return "";
  return payments.map((p) => `  ${p.label}: ${formatAmount(p.amount)}`).join("\n");
}

function renderLoyaltyInfoBlock(redeemed?: number, earned?: number): string {
  const lines: string[] = [];
  if (redeemed && redeemed > 0) lines.push(`Ballardan foydalanildi: -${formatAmount(redeemed)}`);
  if (earned && earned > 0) lines.push(`Ball to'plandi: +${formatAmount(earned)}`);
  return lines.join("\n");
}

function renderItemsBlock(items: ReceiptItemInput[]): string {
  if (!items.length) return "";
  return items
    .map((it) => {
      const lineTotal = it.total ?? it.qty * it.price;
      return `${it.name}\n  ${formatAmount(it.qty)} x ${formatAmount(it.price)} = ${formatAmount(lineTotal)}`;
    })
    .join("\n");
}

export function renderReceiptText(data: ReceiptData, template?: string | null): string {
  const body = template && template.trim() ? template : DEFAULT_RECEIPT_TEMPLATE;
  const replacements: Record<string, string> = {
    "{org_name}": data.org_name || "",
    "{org_address}": data.org_address || "",
    "{org_phone}": data.org_phone || "",
    "{doc_number}": data.doc_number || "",
    "{sale_date}": data.sale_date || "",
    "{items}": renderItemsBlock(data.items || []),
    "{total}": formatAmount(data.total),
    "{paid}": formatAmount(data.paid ?? data.total),
    "{currency}": data.currency || "UZS",
    "{payment_lines}": renderPaymentLinesBlock(data.payments),
    "{loyalty_info}": renderLoyaltyInfoBlock(data.loyaltyRedeemed, data.loyaltyEarned),
    "{footer}": data.footer || "",
  };

  let out = body;
  for (const [key, value] of Object.entries(replacements)) {
    out = out.split(key).join(value);
  }
  return out.replace(/\n{3,}/g, "\n\n").trim();
}

export type ShiftReportPaymentBreakdown = {
  payment_type: string | null;
  direction: "in" | "out";
  total: number | string;
};

export type ShiftReportData = {
  report_type: "X" | "Z";
  org_name?: string | null;
  cashbox_name?: string | null;
  opened_at?: string | null;
  opened_by_name?: string | null;
  opened_balance?: number | string | null;
  closed_at?: string | null;
  closed_by_name?: string | null;
  closed_balance?: number | string | null;
  closed_diff?: number | string | null;
  total_income: number | string;
  total_expense: number | string;
  sale_count?: number | null;
  by_payment_type?: ShiftReportPaymentBreakdown[];
  currency?: string | null;
};

function formatDateTime(v?: string | null): string {
  if (!v) return "-";
  const d = new Date(v);
  if (isNaN(d.getTime())) return "-";
  return d.toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" });
}

export function renderShiftReportText(data: ShiftReportData): string {
  const cur = data.currency || "UZS";
  const isZ = data.report_type === "Z";
  const lines: string[] = [];

  lines.push(isZ ? "Z-HISOBOT (smena yopildi)" : "X-HISOBOT (joriy holat)");
  if (data.org_name) lines.push(data.org_name);
  lines.push("--------------------------------");
  lines.push(`Kassa: ${data.cashbox_name || "-"}`);
  lines.push(`Ochildi: ${formatDateTime(data.opened_at)}`);
  if (data.opened_by_name) lines.push(`Ochdi: ${data.opened_by_name}`);
  lines.push(`Boshlang'ich qoldiq: ${formatAmount(data.opened_balance)} ${cur}`);
  if (isZ) {
    lines.push(`Yopildi: ${formatDateTime(data.closed_at)}`);
    if (data.closed_by_name) lines.push(`Yopdi: ${data.closed_by_name}`);
  }
  lines.push("--------------------------------");
  lines.push(`Kirim: ${formatAmount(data.total_income)} ${cur}`);
  lines.push(`Chiqim: ${formatAmount(data.total_expense)} ${cur}`);
  lines.push(`Sotuvlar soni: ${data.sale_count ?? 0}`);

  if (data.by_payment_type && data.by_payment_type.length > 0) {
    lines.push("--------------------------------");
    lines.push("To'lov turlari bo'yicha:");
    for (const row of data.by_payment_type) {
      const label = row.payment_type || "Noma'lum";
      const sign = row.direction === "out" ? "-" : "+";
      lines.push(`  ${label}: ${sign}${formatAmount(row.total)} ${cur}`);
    }
  }

  if (isZ) {
    lines.push("--------------------------------");
    lines.push(`Yakuniy qoldiq (hisoblangan): ${formatAmount(data.closed_balance)} ${cur}`);
    lines.push(`Farq (kam/ortiq): ${formatAmount(data.closed_diff)} ${cur}`);
  }
  lines.push("--------------------------------");

  return lines.join("\n");
}
