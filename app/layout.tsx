import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://nothing-pedometer.vercel.app"),
  title: "Nothing Pedometer — Interaction Concept",
  description:
    "Concept interaction study: a Nothing Phone pedometer widget that expands into Apple-style detail with a Strava-like dot-matrix run trace.",
  openGraph: {
    title: "Nothing Pedometer — Interaction Concept",
    description:
      "A morning run, told in Nothing's dot-matrix language. Unofficial concept, not affiliated with Nothing.",
    images: ["/opengraph-image"],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Nothing Pedometer — Interaction Concept",
    description:
      "A morning run, told in Nothing's dot-matrix language. Unofficial concept.",
    images: ["/opengraph-image"],
  },
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
