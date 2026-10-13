/**
 * Web Bluetooth thermal printer (ESC/POS) for Android Chrome.
 * Supports 58mm and 80mm thermal printers.
 * Tested with Goojprt PT-210, Xprinter XP-P323B, etc.
 */

import { renderShiftReportText, type ShiftReportData } from "./receipt-render";

const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

// Common BLE thermal printer service/characteristic UUIDs
const SERVICE_UUIDS = [
  "000018f0-0000-1000-8000-00805f9b34fb",  // most common
  "0000ff00-0000-1000-8000-00805f9b34fb",
  "e7810a71-73ae-499d-8c15-faa9aef0c3f2",
];

export type EscPos = {
  text: (s: string) => EscPos;
  feed: (n?: number) => EscPos;
  align: (a: "left" | "center" | "right") => EscPos;
  bold: (on: boolean) => EscPos;
  size: (w: number, h: number) => EscPos; // 1-8
  cut: () => EscPos;
  build: () => Uint8Array;
};

export function buildEscPos(): EscPos {
  const parts: number[] = [ESC, 0x40]; // init

  const enc = new TextEncoder();
  const writer: EscPos = {
    text(s: string) {
      for (const b of enc.encode(s)) parts.push(b);
      return writer;
    },
    feed(n = 1) {
      for (let i = 0; i < n; i++) parts.push(LF);
      return writer;
    },
    align(a) {
      parts.push(ESC, 0x61, a === "left" ? 0 : a === "center" ? 1 : 2);
      return writer;
    },
    bold(on) {
      parts.push(ESC, 0x45, on ? 1 : 0);
      return writer;
    },
    size(w, h) {
      const n = ((Math.max(1, Math.min(8, w)) - 1) << 4) | (Math.max(1, Math.min(8, h)) - 1);
      parts.push(GS, 0x21, n);
      return writer;
    },
    cut() {
      parts.push(GS, 0x56, 0x42, 0); // partial cut
      return writer;
    },
    build() {
      return new Uint8Array(parts);
    },
  };
  return writer;
}

let cachedDevice: any | null = null;
let cachedCharacteristic: any | null = null;

export function isWebBluetoothSupported(): boolean {
  return typeof navigator !== "undefined" && "bluetooth" in navigator;
}

export function isPrinterConnected(): boolean {
  return !!(cachedCharacteristic && cachedDevice?.gatt?.connected);
}

async function ensureConnected(): Promise<void> {
  if (!isWebBluetoothSupported()) {
    throw new Error("Web Bluetooth bu brauzerda qo'llab-quvvatlanmaydi");
  }
  if (cachedCharacteristic && cachedDevice?.gatt?.connected) return;

  const nav = navigator as any;
  cachedDevice = await nav.bluetooth.requestDevice({
    filters: [{ services: SERVICE_UUIDS }],
    optionalServices: SERVICE_UUIDS,
  }) as any;
  const server = await cachedDevice.gatt!.connect();
  // Find a writable characteristic
  const services = await server.getPrimaryServices();
  for (const s of services) {
    const chars = await s.getCharacteristics();
    for (const ch of chars) {
      if (ch.properties.write || ch.properties.writeWithoutResponse) {
        cachedCharacteristic = ch;
        break;
      }
    }
    if (cachedCharacteristic) break;
  }
  if (!cachedCharacteristic) throw new Error("Yozish mumkin bo'lgan xarakteristika topilmadi");
}

/**
 * Explicitly pair/connect to a Bluetooth printer (requires a user gesture,
 * e.g. a button click, per Web Bluetooth security policy).
 */
export async function connectPrinter(): Promise<void> {
  await ensureConnected();
}

export async function btPrint(data: Uint8Array): Promise<void> {
  await ensureConnected();

  // Send in 100-byte chunks (most BLE printers have small MTU)
  const chunk = 100;
  for (let i = 0; i < data.length; i += chunk) {
    const slice = data.slice(i, i + chunk);
    if (cachedCharacteristic.properties.writeWithoutResponse) {
      await cachedCharacteristic.writeValueWithoutResponse(slice);
    } else {
      await cachedCharacteristic.writeValue(slice);
    }
  }
}

// ESC p m t1 t2 — pulse on connector 1 (pin 2), 50ms on / 500ms off
const ESC_POS_DRAWER_OPEN = new Uint8Array([ESC, 0x70, 0x00, 0x19, 0xfa]);

/**
 * Open the cash drawer wired to the connected receipt printer's DK port,
 * by sending the ESC/POS pulse command over the same Bluetooth channel.
 */
export async function openCashDrawer(): Promise<void> {
  await btPrint(ESC_POS_DRAWER_OPEN);
}

export function disconnectPrinter() {
  cachedDevice?.gatt?.disconnect();
  cachedDevice = null;
  cachedCharacteristic = null;
}

/**
 * Print pre-rendered receipt text (see lib/receipt-render.ts) on a connected
 * Bluetooth ESC/POS thermal printer.
 */
export async function printReceipt(text: string): Promise<void> {
  const w = buildEscPos();
  w.align("left").bold(false).size(1, 1);
  for (const line of text.split("\n")) {
    w.text(line).feed();
  }
  w.feed(3).cut();
  await btPrint(w.build());
}

export type ShiftSessionInput = Omit<
  ShiftReportData,
  "report_type" | "total_income" | "total_expense" | "sale_count" | "by_payment_type"
> & { status?: "open" | "closed" | string };

export type ShiftTotalsInput = Pick<
  ShiftReportData,
  "total_income" | "total_expense" | "sale_count" | "by_payment_type"
>;

/**
 * Print an internal cash-control shift report (X = active snapshot,
 * Z = final totals on close) — NOT a fiscal/government Z-report.
 * Reuses the same ESC/POS pipeline as printReceipt.
 */
export async function printShiftReport(
  session: ShiftSessionInput,
  totals: ShiftTotalsInput
): Promise<void> {
  const reportType: "X" | "Z" = session.status === "closed" ? "Z" : "X";
  const { status: _status, ...sessionFields } = session;
  const text = renderShiftReportText({ report_type: reportType, ...sessionFields, ...totals });
  await printReceipt(text);
}

/**
 * Web Bluetooth electronic scale reader.
 * Common protocol: scale broadcasts weight as text "1.234 kg\r\n"
 */
export async function readScale(onWeight: (kg: number) => void): Promise<() => void> {
  if (!isWebBluetoothSupported()) {
    throw new Error("Web Bluetooth qo'llab-quvvatlanmaydi");
  }
  const nav = navigator as any;
  const device = await nav.bluetooth.requestDevice({
    filters: [{ services: SERVICE_UUIDS }],
    optionalServices: SERVICE_UUIDS,
  }) as any;
  const server = await device.gatt!.connect();
  const services = await server.getPrimaryServices();

  let notifChar: any | null = null;
  for (const s of services) {
    const chars = await s.getCharacteristics();
    for (const c of chars) {
      if (c.properties.notify) { notifChar = c; break; }
    }
    if (notifChar) break;
  }
  if (!notifChar) throw new Error("Notify xarakteristika topilmadi");

  const dec = new TextDecoder();
  await notifChar.startNotifications();
  const handler = (e: any) => {
    const text = dec.decode(e.target.value);
    const m = text.match(/[\d.]+/);
    if (m) onWeight(parseFloat(m[0]));
  };
  notifChar.addEventListener("characteristicvaluechanged", handler);

  return () => {
    notifChar?.removeEventListener("characteristicvaluechanged", handler);
    device.gatt?.disconnect();
  };
}
