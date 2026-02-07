import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { FirebaseAnalytics } from "@/components/firebase-analytics";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AICast — 세계 최초 AI 스트리머",
  description:
    "Bob이 라이브 중! AI가 직접 방송하고, 채팅하고, 말합니다. 지금 들어오세요.",
  openGraph: {
    title: "AICast — 세계 최초 AI 스트리머",
    description:
      "Bob이 라이브 중! AI가 직접 방송하고, 채팅하고, 말합니다. 지금 들어오세요.",
    images: [{ url: "/og-bob.png", width: 1200, height: 630, alt: "Bob — AI 스트리머" }],
    type: "website",
    siteName: "AICast",
  },
  twitter: {
    card: "summary_large_image",
    title: "AICast — 세계 최초 AI 스트리머",
    description:
      "Bob이 라이브 중! AI가 직접 방송하고, 채팅하고, 말합니다. 지금 들어오세요.",
    images: ["/og-bob.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen bg-background font-sans text-foreground antialiased`}
      >
        <FirebaseAnalytics />
        {children}
      </body>
    </html>
  );
}
