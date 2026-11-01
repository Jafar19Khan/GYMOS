"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";

type ScanResult = { ok?: boolean; memberName?: string; checkedInAt?: string; error?: string };

export default function AttendanceQrScanner() {
  const generatedId = useId().replace(/:/g, "");
  const elementId = `gymos-qr-reader-${generatedId}`;
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const processingRef = useRef(false);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState("Start the camera and scan a member's current QR code.");
  const [tone, setTone] = useState<"neutral" | "success" | "error">("neutral");

  useEffect(() => {
    return () => {
      const scanner = scannerRef.current;
      if (scanner?.isScanning) {
        void scanner.stop().catch(() => undefined);
      }
      scannerRef.current = null;
    };
  }, []);

  async function stopScanner() {
    const scanner = scannerRef.current;
    if (scanner?.isScanning) {
      try { await scanner.stop(); } catch { /* camera may already have stopped */ }
    }
    setRunning(false);
  }

  async function startScanner() {
    setMessage("Requesting camera access…");
    setTone("neutral");
    try {
      const scanner = new Html5Qrcode(elementId, {
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
        verbose: false,
      });
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 240, height: 240 }, aspectRatio: 1 },
        async (decodedText) => {
          if (processingRef.current) return;
          processingRef.current = true;
          await scanner.pause(true);
          setMessage("Verifying QR code and recording attendance…");
          try {
            const response = await fetch("/api/owner/attendance/qr", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ token: decodedText }),
            });
            const result = (await response.json()) as ScanResult;
            if (!response.ok || !result.ok) throw new Error(result.error || "Attendance could not be recorded.");
            setTone("success");
            setMessage(`Check-in recorded for ${result.memberName ?? "member"}.`);
            await stopScanner();
          } catch (reason) {
            setTone("error");
            setMessage(reason instanceof Error ? reason.message : "QR scan failed. Try again with a fresh code.");
            processingRef.current = false;
            try { await scanner.resume(); } catch { await stopScanner(); }
          }
        },
        () => undefined,
      );
      setRunning(true);
      setMessage("Camera active. Align a member QR code inside the frame.");
    } catch (reason) {
      setTone("error");
      setMessage(reason instanceof Error ? reason.message : "Camera access failed. Use HTTPS or localhost and allow camera permission.");
      await stopScanner();
    }
  }

  return <section className="surface rounded-2xl p-5 md:p-6">
    <p className="eyebrow">QR check-in</p>
    <h2 className="mt-2 text-lg font-extrabold">Member QR scanner</h2>
    <p className="mt-2 text-xs leading-5 text-white/45">Camera access is required. Use HTTPS in production or localhost during local testing. Only signed, unexpired codes from this gym are accepted.</p>
    <div id={elementId} className="mt-5 min-h-[260px] overflow-hidden rounded-xl border border-white/10 bg-black" />
    <div className="mt-4 flex flex-wrap items-center gap-3">
      {!running ? <button type="button" onClick={() => { processingRef.current = false; void startScanner(); }} className="rounded-full bg-[#b6f36a] px-5 py-3 text-xs font-black text-[#090b0a]">Start camera</button> : <button type="button" onClick={() => void stopScanner()} className="rounded-full border border-white/20 px-5 py-3 text-xs font-bold text-white/70">Stop camera</button>}
      <span className="text-[10px] text-white/40">{running ? "Camera active" : "Camera stopped"}</span>
    </div>
    <p role="status" aria-live="polite" className={tone === "success" ? "mt-4 text-sm font-semibold text-emerald-300" : tone === "error" ? "mt-4 text-sm text-amber-200" : "mt-4 text-sm text-white/55"}>{message}</p>
  </section>;
}
