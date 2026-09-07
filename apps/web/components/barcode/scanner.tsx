"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { X, Flashlight, FlashlightOff } from "lucide-react";
import { useTranslations } from "next-intl";

const DEFAULT_FORMATS = ["ean_13", "ean_8", "code_128", "qr_code"];

interface BarcodeDetectorResult {
  rawValue: string;
  format: string;
}

declare class BarcodeDetector {
  constructor(options?: { formats: string[] });
  detect(
    source: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement,
  ): Promise<BarcodeDetectorResult[]>;
}

export interface BarcodeScannerProps {
  onScan: (code: string, format?: string) => void;
  onError?: (err: Error) => void;
  className?: string;
  formats?: string[];
}

type Engine = "native" | "zxing";
type PermissionState = "pending" | "granted" | "denied" | "error";

export function BarcodeScanner({
  onScan,
  onError,
  className,
  formats = DEFAULT_FORMATS,
}: BarcodeScannerProps) {
  const t = useTranslations("barcode");
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const cancelledRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const zxingStopRef = useRef<(() => void) | null>(null);

  const [engine, setEngine] = useState<Engine | null>(null);
  const [permission, setPermission] = useState<PermissionState>("pending");
  const [torch, setTorch] = useState(false);
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [flash, setFlash] = useState(false);

  const handleDetected = useCallback(
    (code: string, format: string) => {
      setFlash(true);
      setTimeout(() => setFlash(false), 250);
      if (navigator.vibrate) navigator.vibrate(60);
      onScan(code, format);
    },
    [onScan],
  );

  const runNativeLoop = useCallback(
    (video: HTMLVideoElement, detector: BarcodeDetector) => {
      const loop = async () => {
        if (cancelledRef.current) return;
        try {
          const results = await detector.detect(video);
          if (results.length > 0 && results[0].rawValue) {
            handleDetected(results[0].rawValue, results[0].format);
            return;
          }
        } catch {
          /* ignore per-frame errors */
        }
        rafRef.current = requestAnimationFrame(loop);
      };
      rafRef.current = requestAnimationFrame(loop);
    },
    [handleDetected],
  );

  const runZxingLoop = useCallback(
    async (video: HTMLVideoElement) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const zxing = await import("@zxing/library" as any);
      const reader = new zxing.BrowserMultiFormatReader();

      zxingStopRef.current = () => {
        reader.reset();
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await reader.decodeFromVideoElementContinuously(video, (result: any, err: any) => {
        if (cancelledRef.current) return;
        if (result) {
          handleDetected(result.getText(), result.getBarcodeFormat().toString());
        } else if (err && err.name !== "NotFoundException") {
          /* ignore per-frame not-found */
        }
      });
    },
    [handleDetected],
  );

  const stopAll = useCallback(() => {
    cancelledRef.current = true;
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    zxingStopRef.current?.();
    zxingStopRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    cancelledRef.current = false;

    async function init() {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        const isDenied =
          error.name === "NotAllowedError" || error.name === "PermissionDeniedError";
        setPermission(isDenied ? "denied" : "error");
        onError?.(error);
        return;
      }

      if (cancelledRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      streamRef.current = stream;
      setPermission("granted");

      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      await video.play();

      const videoTrack = stream.getVideoTracks()[0];
      const caps = videoTrack.getCapabilities?.() as Record<string, unknown> | undefined;
      if (caps && "torch" in caps) {
        setTorchAvailable(true);
      }

      if ("BarcodeDetector" in window) {
        try {
          const detector = new BarcodeDetector({ formats });
          setEngine("native");
          runNativeLoop(video, detector);
        } catch (err) {
          const error = err instanceof Error ? err : new Error(String(err));
          onError?.(error);
        }
        return;
      }

      try {
        setEngine("zxing");
        await runZxingLoop(video);
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        onError?.(error);
      }
    }

    init();

    return () => {
      stopAll();
    };
  }, [formats, onError, runNativeLoop, runZxingLoop, stopAll]);

  const toggleTorch = useCallback(async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    const next = !torch;
    try {
      await (
        track as MediaStreamTrack & {
          applyConstraints(c: object): Promise<void>;
        }
      ).applyConstraints({ advanced: [{ torch: next }] });
      setTorch(next);
    } catch {
      /* torch not supported */
    }
  }, [torch]);

  if (permission === "denied") {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-ink-900 text-white p-8 rounded-xl min-h-[300px] ${className ?? ""}`}
      >
        <X size={40} className="mb-4 text-danger-500" />
        <p className="text-center text-sm font-medium mb-2">{t("scanner_permission_denied")}</p>
        <p className="text-center text-xs text-ink-400 mb-4">{t("scanner_permission_hint")}</p>
        <a
          href="app-settings:"
          className="text-xs underline text-ink-300 flex items-center min-h-[44px]"
        >
          {t("scanner_open_settings")}
        </a>
      </div>
    );
  }

  if (permission === "error") {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-ink-900 text-white p-8 rounded-xl min-h-[300px] ${className ?? ""}`}
      >
        <X size={40} className="mb-4 text-danger-500" />
        <p className="text-center text-sm">{t("scanner_camera_error")}</p>
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden rounded-xl bg-black ${className ?? ""}`}>
      <video
        ref={videoRef}
        className="w-full h-full object-cover"
        playsInline
        muted
        aria-label={t("scanner_video_label")}
      />

      <div className="absolute inset-0 pointer-events-none">
        <div
          aria-hidden
          className={`absolute inset-0 transition-opacity duration-150 ${flash ? "opacity-25 bg-success-500" : "opacity-0"}`}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className={`border-2 rounded-2xl w-64 h-32 transition-colors duration-150 ${flash ? "border-success-500" : "border-white/70"}`}
          />
        </div>
      </div>

      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/60 to-transparent">
        <span className="text-white text-xs">
          {permission === "pending"
            ? t("scanner_starting")
            : engine === "native"
              ? t("scanner_active_native")
              : engine === "zxing"
                ? t("scanner_active_zxing")
                : t("scanner_aim_at_barcode")}
        </span>

        {torchAvailable && (
          <button
            onClick={toggleTorch}
            className="p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full bg-white/20 text-white"
            aria-label={torch ? t("scanner_torch_off") : t("scanner_torch_on")}
          >
            {torch ? <FlashlightOff size={18} /> : <Flashlight size={18} />}
          </button>
        )}
      </div>
    </div>
  );
}
