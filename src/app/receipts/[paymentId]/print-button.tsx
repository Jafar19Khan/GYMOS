"use client";

export default function PrintButton() {
  return <button type="button" onClick={() => window.print()} className="print:hidden rounded-full bg-[#b6f36a] px-4 py-2.5 text-xs font-black text-[#090b0a]">
    Print / Save PDF
  </button>;
}
