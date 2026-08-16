import type { Metadata } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter"
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono"
});

export const metadata: Metadata = {
  title: "SessionX | Global Market Sessions. Smarter Alerts.",
  description: "Global Market Sessions. Smarter Alerts.",
  applicationName: "SessionX",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icons/icon.svg", apple: "/icons/icon.svg" },
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "SessionX" }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${geistMono.variable}`}>
        {children}
      </body>
    </html>
  );
}
