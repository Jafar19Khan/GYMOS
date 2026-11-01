"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

type QrResponse = { token?: string; error?: string; expiresInSeconds?: number };

export default function AttendanceQrCard() {
  const [image, setImage] = useState("");
  const [error, setError] = useState("");
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function refreshQr() {
      try {
        const response = await fetch("/api/member/attendance/qr", { cache: "no-store" });
        const result = (await response.json()) as QrResponse;
        if (!response.ok || !result.token) {
          throw new Error(result.error || "QR attendance is currently unavailable.");
        }
        const dataUrl = await QRCode.toDataURL(result.token, {
          errorCorrectionLevel: "M",
          margin: 2,
          width: 280,
          color: { dark: "#090b0a", light: "#ffffff" },
        });
        if (!active) return;
        setImage(dataUrl);
        setExpiresAt(new Date(Date.now() + (result.expiresInSeconds ?? 60) * 1000));
        setError("");
      } catch (reason) {
        if (!active) return;
        setImage("");
        setError(reason instanceof Error ? reason.message : "Could not generate your attendance QR code.");
      } finally {
        if (active) setLoading(false);
      }
    }

    void refreshQr();
    const interval = window.setInterval(() => { void refreshQr(); }, 45000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  return <section className="surface rounded-2xl p-5 md:p-6">
    <p className="eyebrow">Gym check-in</p>
    <h2 className="mt-2 text-lg font-extrabold">My attendance QR</h2>
    <p className="mt-2 text-xs leading-5 text-white/45">Show this rotating code to gym staff at the QR scanner. It expires automatically and is refreshed every 45 seconds.</p>
    <div className="mt-5 flex min-h-[260px] flex-col items-center justify-center rounded-xl border border-white/10 bg-white p-4">
      {image ? <img src={image} alt="Your temporary GYMOS attendance QR code" width={240} height={240} className="h-60 w-60" /> : <p className="max-w-xs text-center text-xs text-slate-600">{loading ? "Generating your QR code…" : error || "QR attendance unavailable."}</p>}
    </div>
    {expiresAt && image && <p className="mt-3 text-center text-[10px] text-white/40">Code generated for a 60-second validity window. Keep this screen open while checking in.</p>}
    {error && <p role="alert" className="mt-3 text-xs text-amber-200">{error}</p>}
  </section>;
}
