import type { Metadata, Viewport } from "next";
import { Assistant } from "next/font/google";
import "./globals.css";

const assistant = Assistant({
  subsets: ["latin", "hebrew"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
  variable: "--font-assistant",
  preload: false,
});

export const metadata: Metadata = {
  title: "Meta Ads Dashboard",
  description:
    "דשבורד מעקב הוצאות פרסום ממומן והחזר השקעה — סנכרון אוטומטי מ-Meta Ads ואינסטגרם",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#0f172a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="he"
      dir="rtl"
      className={assistant.variable}
      suppressHydrationWarning
    >
      <body className="antialiased">{children}</body>
    </html>
  );
}
