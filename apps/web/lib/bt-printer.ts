/**
 * Web Bluetooth thermal printer (ESC/POS) for Android Chrome.
 * Supports 58mm and 80mm thermal printers.
 * Tested with Goojprt PT-210, Xprinter XP-P323B, etc.
 */

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

export async function btPrint(data: Uint8Array): Promise<void> {
  if (typeof navigator === "undefined" || !(navigator as any).bluetooth) {
    throw new Error("Web Bluetooth bu brauzerda qo'llab-quvvatlanmaydi");
  }

  if (!cachedCharacteristic || !cachedDevice?.gatt?.connected) {
    const nav = navigator as any;
    cachedDevice = await nav.bluetooth.requestDevice({
      acceptAllDevices: true,
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

export function disconnectPrinter() {
  cachedDevice?.gatt?.disconnect();
  cachedDevice = null;
  cachedCharacteristic = null;
}

/**
 * Quick helper: print a thermal receipt
 */
export async function printReceipt(receipt: {
  org_name?: string;
  doc_number?: string;
  date?: string;
  items: { name: string; qty: number; price: number; total: number }[];
  total: number;
  paid?: number;
  payment_method?: string;
  customer?: string;
  footer?: string;
}): Promise<void> {
  const w = buildEscPos();
  if (receipt.org_name) {
    w.align("center").bold(true).size(2, 2).text(receipt.org_name).feed(2);
  }
  w.bold(false).size(1, 1).align("left");
  if (receipt.doc_number) w.text(`Chek: ${receipt.doc_number}`).feed();
  if (receipt.date) w.text(receipt.date).feed();
  if (receipt.customer) w.text(`Mijoz: ${receipt.customer}`).feed();
  w.text("--------------------------------").feed();
  for (const it of receipt.items) {
    w.text(it.name).feed();
    w.text(`  ${it.qty} x ${it.price.toFixed(0)} = ${it.total.toFixed(0)}`).feed();
  }
  w.text("--------------------------------").feed();
  w.bold(true).size(2, 1).text(`JAMI: ${receipt.total.toFixed(0)}`).feed().size(1, 1).bold(false);
  if (receipt.paid != null) w.text(`To'landi: ${receipt.paid.toFixed(0)} (${receipt.payment_method || ""})`).feed();
  if (receipt.footer) w.feed().align("center").text(receipt.footer).feed();
  w.feed(3).cut();
  await btPrint(w.build());
}

/**
 * Web Bluetooth electronic scale reader.
 * Common protocol: scale broadcasts weight as text "1.234 kg\r\n"
 */
export async function readScale(onWeight: (kg: number) => void): Promise<() => void> {
  if (typeof navigator === "undefined" || !(navigator as any).bluetooth) {
    throw new Error("Web Bluetooth qo'llab-quvvatlanmaydi");
  }
  const nav = navigator as any;
  const device = await nav.bluetooth.requestDevice({
    acceptAllDevices: true,
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
