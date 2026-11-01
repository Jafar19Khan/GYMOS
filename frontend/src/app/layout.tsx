import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "GYMOS | Train with intent", template: "%s | GYMOS" },
  description: "A premium fitness experience and smarter gym management platform.",
  applicationName: "GYMOS",
  robots: { index: true, follow: true },
};

export const viewport: Viewport = { themeColor: "#090B0A", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
