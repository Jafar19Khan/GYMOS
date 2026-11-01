import Link from "next/link";
import { Role } from "@prisma/client";
import AppShell from "@/app/components/app-shell";
import AttendanceQrScanner from "../qr-scanner";
import { requireRole } from "@/lib/auth/guards";
import { hasGymPermission } from "@/lib/auth/permissions";

export default async function AttendanceQrScanPage() {
  const user = await requireRole(Role.OWNER);
  if (!user.gymId || !(await hasGymPermission(user.id, user.gymId, "attendance.manage"))) {
    return <AppShell eyebrow="Gym operations / Attendance" title="QR scanner" description="You do not have permission to manage gym attendance." userName={user.name} roleLabel="Gym staff" />;
  }
  const configured = Boolean(process.env.ATTENDANCE_QR_SECRET && Buffer.byteLength(process.env.ATTENDANCE_QR_SECRET, "utf8") >= 32);
  return <AppShell eyebrow="Gym operations / Attendance" title="QR check-in" description="Scan a member's current signed QR code. Each member can check in once per gym-local day." userName={user.name} roleLabel="Owner / Staff">
    {!configured && <p role="alert" className="mb-5 rounded-xl border border-amber-300/20 bg-amber-300/5 px-4 py-3 text-xs leading-5 text-amber-100">QR attendance is disabled. Set ATTENDANCE_QR_SECRET to a random value of at least 32 bytes in .env, then restart the web container.</p>}
    {configured && <AttendanceQrScanner />}
    <Link href="/owner/attendance" className="mt-5 inline-flex text-xs font-bold text-white/55 hover:text-[#b6f36a]">← Back to attendance</Link>
  </AppShell>;
}
