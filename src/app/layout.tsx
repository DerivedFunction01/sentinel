import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { Providers } from "@/components/providers";
import { APP_NAME } from "@/lib/constants";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: `Pentest your AI the way a real attacker would | ${APP_NAME}`,
  description:
    `${APP_NAME} puts your system prompt under sustained adversarial pressure, scores it, and hands you back a hardened version — all in minutes.`,
  keywords: [
    APP_NAME,
    "AI security",
    "prompt pentest",
    "adversarial testing",
    "system prompt",
    "LLM security",
  ],
  authors: [{ name: APP_NAME }],
  icons: {
    icon: "/logo.svg",
  },
  openGraph: {
    title: APP_NAME,
    description: "Pentest your AI the way a real attacker would.",
    siteName: APP_NAME,
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
