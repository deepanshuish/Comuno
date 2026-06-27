import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Comuno — AI-Powered Talent Intelligence",
  description: "End-to-end recruitment: AI resume screening, intelligent interviews, seamless onboarding & training. By Easecruit Technologies.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body style={{ background: '#080a0f' }}>{children}</body>
    </html>
  );
}
