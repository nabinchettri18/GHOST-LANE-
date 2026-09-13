import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GhostLane — Procurement Intelligence",
  description: "Freight capacity realization and ghost-capacity intelligence.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
