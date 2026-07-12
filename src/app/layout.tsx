import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { Providers } from "@/components/providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: " Pentest your AI the way a real attacker would",
  description:
    "ToolRegistry puts your system prompt under sustained adversarial pressure, scores it, and hands you back a hardened version — all in minutes.",
  keywords: [
    "ToolRegistry",
    "AI security",
    "prompt pentest",
    "adversarial testing",
    "system prompt",
    "LLM security",
  ],
  authors: [{ name: "ToolRegistry" }],
  icons: {
    icon: "/logo.svg",
  },
  openGraph: {
    title: "ToolRegistry",
    description: "Pentest your AI the way a real attacker would.",
    siteName: "ToolRegistry",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <Providers>
          {children}
          <Toaster />
          <SonnerToaster richColors position="bottom-right" />
        </Providers>
      </body>
    </html>
  );
}
