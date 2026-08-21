"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Barcode scanner hook — detects HID keyboard-wedge scanners.
 *
 * Most barcode scanners emulate a keyboard: they type the barcode characters
 * very fast (typically <50ms between keys), then press Enter.
 *
 * Heuristic: if more than `minLength` characters arrive within `gap` ms
 * each, followed by Enter (or auto-flush after timeout), treat as a scan.
 *
 * Usage:
 *   useBarcodeScanner((barcode) => {
 *     // handle scanned barcode
 *   });
 */
type Options = {
  minLength?: number;
  maxGapMs?: number;
  enabled?: boolean;
  /** If true, ignore scans when focus is in input/textarea (default false) */
  ignoreInInputs?: boolean;
};

export function useBarcodeScanner(
  onScan: (barcode: string) => void,
  options: Options = {}
) {
  const {
    minLength = 4,
    maxGapMs = 50,
    enabled = true,
    ignoreInInputs = false,
  } = options;

  const bufferRef = useRef("");
  const lastTimeRef = useRef(0);
  const onScanRef = useRef(onScan);

  // Keep latest callback without re-binding listener
  useEffect(() => { onScanRef.current = onScan; }, [onScan]);

  useEffect(() => {
    if (!enabled) return;

    function flush() {
      const buf = bufferRef.current.trim();
      bufferRef.current = "";
      if (buf.length >= minLength) {
        onScanRef.current(buf);
      }
    }

    function onKeyDown(e: KeyboardEvent) {
      // Optionally ignore when focus is in an input
      if (ignoreInInputs) {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      }

      // Enter = end-of-scan
      if (e.key === "Enter") {
        if (bufferRef.current.length >= minLength) {
          e.preventDefault();
          flush();
        }
        return;
      }

      // Only accept printable chars
      if (e.key.length !== 1) return;

      const now = performance.now();
      const gap = now - lastTimeRef.current;

      // If too slow → start fresh buffer (human typing, not scanner)
      if (gap > maxGapMs && bufferRef.current.length > 0) {
        bufferRef.current = "";
      }
      bufferRef.current += e.key;
      lastTimeRef.current = now;
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled, minLength, maxGapMs, ignoreInInputs]);
}


// =========================================================
// WebSerial scanner (advanced — for USB-Serial / RS-232 scanners)
// =========================================================

type WebSerialPort = any;

export type WebSerialOptions = {
  baudRate?: number;
  dataBits?: number;
  stopBits?: number;
  parity?: "none" | "even" | "odd";
};

export function isWebSerialSupported(): boolean {
  if (typeof navigator === "undefined") return false;
  return "serial" in navigator;
}

/**
 * Open a WebSerial port and stream lines (terminated by \r or \n).
 * Returns disconnect function.
 *
 * Note: requires HTTPS or localhost. Triggers a browser permission prompt.
 */
export async function openSerialScanner(
  onLine: (line: string) => void,
  options: WebSerialOptions = {}
): Promise<() => void> {
  if (!isWebSerialSupported()) {
    throw new Error("WebSerial qo'llab-quvvatlanmaydi (Chrome/Edge 89+ kerak)");
  }

  // @ts-ignore
  const port: WebSerialPort = await navigator.serial.requestPort();
  await port.open({
    baudRate: options.baudRate ?? 9600,
    dataBits: options.dataBits ?? 8,
    stopBits: options.stopBits ?? 1,
    parity: options.parity ?? "none",
  });

  const reader = port.readable!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let aborted = false;

  (async () => {
    while (!aborted) {
      try {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        // Split on \r or \n
        const lines = buffer.split(/[\r\n]+/);
        buffer = lines.pop() || "";
        for (const ln of lines) {
          const trimmed = ln.trim();
          if (trimmed) onLine(trimmed);
        }
      } catch {
        break;
      }
    }
    try {
      await reader.releaseLock();
      await port.close();
    } catch {}
  })();

  return () => {
    aborted = true;
    try { reader.cancel(); } catch {}
  };
}


// =========================================================
// Scale reader (electronic scale via WebSerial)
// Most scales (CAS PD-II, Mertech 326) output weight as text via RS-232
// =========================================================

export type WeightReading = {
  weight: number; // in kilograms
  unit: string;   // "kg" | "g"
  raw: string;
};

export function parseScaleReading(line: string): WeightReading | null {
  // Common formats:
  //   "ST,GS,+   0.245 kg"   (CAS)
  //   "+0.123 kg"
  //   "0.500"  (raw grams)
  const m = line.match(/[+-]?\s*(\d+\.?\d*)\s*(kg|g)?/i);
  if (!m) return null;
  let weight = parseFloat(m[1]);
  const unit = (m[2] || "kg").toLowerCase();
  if (unit === "g") weight = weight / 1000; // normalize to kg
  return { weight, unit: "kg", raw: line };
}

export async function openSerialScale(
  onReading: (r: WeightReading) => void,
  options: WebSerialOptions = {}
): Promise<() => void> {
  return openSerialScanner((line) => {
    const r = parseScaleReading(line);
    if (r) onReading(r);
  }, { baudRate: 9600, ...options });
}
