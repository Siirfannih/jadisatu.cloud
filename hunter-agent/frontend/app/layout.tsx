import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
    title: "Hunter Agent - Jadisatu Pain Point Monitor",
    description: "Real-time monitoring of business pain points from Reddit and LinkedIn",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
            <body>{children}</body>
        </html>
    );
}
