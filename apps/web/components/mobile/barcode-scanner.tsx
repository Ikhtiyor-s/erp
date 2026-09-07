"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

type Props = {
  open: boolean;
  onClose: () => void;
  onDetect: (code: string) => void;
};

export function BarcodeScanner({ open, onClose, onDetect }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [usingBarcodeDetector, setUsingBarcodeDetector] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    let stream: MediaStream | null = null;
    let cancelled = false;

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } }, audio: false,
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        // Native BarcodeDetector (Chrome Android)
        const BD = (window as any).BarcodeDetector;
        if (BD) {
          setUsingBarcodeDetector(true);
          const detector = new BD({ formats: ["ean_13", "ean_8", "qr_code", "code_128", "code_39", "upc_a", "upc_e"] });
          const loop = async () => {
            if (cancelled || !videoRef.current) return;
            try {
              const codes = await detector.detect(videoRef.current);
              if (codes.length > 0 && codes[0].rawValue) {
                if (navigator.vibrate) navigator.vibrate(50);
                onDetect(codes[0].rawValue);
                return;
              }
            } catch {}
            requestAnimationFrame(loop);
          };
          loop();
          return;
        }

        setError("BarcodeDetector qo'llab-quvvatlanmaydi — qo'lda kiriting yoki Chrome Android'dan oching");
      } catch (e: any) {
        setError(e?.message || "Kamerani ochib bo'lmadi");
      }
    }
    start();

    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [open, onDetect]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black">
      <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
      <div className="absolute inset-0 flex flex-col">
        <div className="flex items-center justify-between p-4 bg-black/60 text-white">
          <span className="text-sm">{usingBarcodeDetector ? "Skaner aktiv" : "Kamerani mahsulotga to'g'rilang"}</span>
          <button onClick={onClose} className="p-2 rounded-full bg-white/20"><X size={20} /></button>
        </div>
        <div className="flex-1 flex items-center justify-center pointer-events-none">
          <div className="border-2 border-white/70 rounded-2xl w-64 h-32" />
        </div>
        {error && (
          <div className="p-3 bg-danger-600 text-white text-sm text-center">{error}</div>
        )}
      </div>
    </div>
  );
}
