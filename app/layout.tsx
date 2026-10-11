import type { Metadata, Viewport } from "next";
import { Inter, Instrument_Serif } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const serif = Instrument_Serif({ subsets: ["latin"], weight: "400", variable: "--font-instrument" });

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export const metadata: Metadata = {
  title: "Comuno — AI-Powered Talent Intelligence",
  description: "End-to-end recruitment: AI resume screening, intelligent interviews, seamless onboarding & training. By Easecruit Technologies.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${serif.variable}`}>
      <body style={{ background: '#080a0f' }}>{children}</body>
    </html>
  );
}
