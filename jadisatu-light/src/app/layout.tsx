import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { JuruWrapper } from "@/components/juru/JuruWrapper";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "Jadisatu - Creator OS",
  description: "Operating system for solo founders and creators",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} font-sans`}>
      <body
        className="bg-[#F8FAFC] text-slate-900 antialiased selection:bg-blue-100 selection:text-blue-900"
        suppressHydrationWarning
      >
        <JuruWrapper>{children}</JuruWrapper>
      </body>
    </html>
  );
}
