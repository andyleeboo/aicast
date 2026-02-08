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
  metadataBase: new URL("https://aicast.vercel.app"),
  title: "AICast — The World's First AI Streamer",
  description:
    "Bob is LIVE! An AI that streams, chats, and talks — just like a real Twitch streamer. Powered by Gemini 3.",
  openGraph: {
    title: "AICast — The World's First AI Streamer",
    description:
      "Bob is LIVE! An AI that streams, chats, and talks — just like a real Twitch streamer. Powered by Gemini 3.",
    images: [{ url: "/og-bob.png", width: 1200, height: 630, alt: "Bob — AI Streamer" }],
    type: "website",
    siteName: "AICast",
  },
  twitter: {
    card: "summary_large_image",
    title: "AICast — The World's First AI Streamer",
    description:
      "Bob is LIVE! An AI that streams, chats, and talks — just like a real Twitch streamer. Powered by Gemini 3.",
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
