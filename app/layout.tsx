import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
  metadataBase: new URL("https://tokenoptics.vercel.app"),
  title: "Tokenoptics",
  description:
    "Transparency for Claude Code spend — see token, cost, and waste across your conversations.",
  openGraph: {
    title: "Tokenoptics",
    description:
      "Transparency for Claude Code spend — see token, cost, and waste across your conversations.",
    url: "/",
    siteName: "Tokenoptics",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Tokenoptics",
    description:
      "Transparency for Claude Code spend — see token, cost, and waste across your conversations.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-screen bg-bg text-fg">{children}</body>
    </html>
  );
}
