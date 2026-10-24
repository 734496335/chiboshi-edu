import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "Chiboshi — Measurement Playground",
  applicationName: "Chiboshi",
  description:
    "An independently maintained educational playground for exploring length, mass, capacity, area, volume, and time through visual comparison. English guides accompany Chinese classroom activities.",
  authors: [{ name: "734496335", url: "https://github.com/734496335" }],
  keywords: ["education", "measurement", "mathematics", "visual learning"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      className="h-full antialiased"
    >
      <head>
        {/* Preload the bundled OFL display font; body text uses system fonts. */}
        <link
          rel="preload"
          as="font"
          type="font/woff2"
          href="/fonts/maoken/MaokenAssortedSans-Lite.woff2"
          crossOrigin="anonymous"
        />
      </head>
      <body className="min-h-full flex flex-col">
        {children}
        <Script src="https://unpkg.com/css-doodle@0.38.3/css-doodle.min.js" strategy="lazyOnload" />
      </body>
    </html>
  );
}
