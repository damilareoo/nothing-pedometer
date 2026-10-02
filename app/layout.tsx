import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nothing Pedometer — Interaction Concept",
  description:
    "Concept interaction study: a Nothing Phone pedometer widget that expands into Apple-style detail with a Strava-like dot-matrix run trace.",
};

export const viewport: Viewport = {
  themeColor: "#000000",
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-black text-white antialiased">{children}</body>
    </html>
  );
}
