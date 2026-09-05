"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { BarcodeScanner } from "@/components/barcode/scanner";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function ScanDemoPage() {
  const t = useTranslations("barcode");
  const [lastCode, setLastCode] = useState<string | null>(null);
  const [lastFormat, setLastFormat] = useState<string | null>(null);

  function handleScan(code: string, format?: string) {
    setLastCode(code);
    setLastFormat(format ?? null);
    toast.success(t("scan.found", { code }));
  }

  function handleError(err: Error) {
    const isDenied = err.name === "NotAllowedError" || err.name === "PermissionDeniedError";
    toast.error(isDenied ? t("scan.permission_denied") : t("scanner_camera_error"));
  }

  return (
    <div className="flex flex-col min-h-screen bg-zinc-950">
      <header className="flex items-center gap-3 px-4 py-3 bg-zinc-900 text-white">
        <Link href="/m" className="p-2 -ml-2 rounded-full hover:bg-white/10">
          <ArrowLeft size={20} />
        </Link>
        <span className="font-medium text-sm">{t("scan.scanning")}</span>
      </header>

      <div className="flex-1 flex flex-col gap-4 p-4">
        <BarcodeScanner
          onScan={handleScan}
          onError={handleError}
          className="w-full rounded-2xl overflow-hidden"
        />

        {lastCode && (
          <div className="bg-zinc-800 rounded-xl p-4 text-white space-y-1">
            <p className="text-xs text-zinc-400">{lastFormat}</p>
            <p className="font-mono text-lg font-semibold tracking-widest">{lastCode}</p>
          </div>
        )}
      </div>
    </div>
  );
}
