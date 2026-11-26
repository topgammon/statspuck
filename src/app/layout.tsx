import type { Metadata } from "next";
import { Barlow, Oswald } from "next/font/google";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { siteUrl } from "@/lib/site";
import "./globals.css";

const barlow = Barlow({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-barlow",
});

const oswald = Oswald({
  subsets: ["latin", "latin-ext"],
  weight: ["500", "700"],
  variable: "--font-oswald",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "StatsPuck", template: "%s · StatsPuck" },
  description: "Hockey intelligence, boiled down to clear, math-backed answers.",
  openGraph: {
    siteName: "StatsPuck",
    type: "website",
    images: [{ url: "/draft-rater/og/home.png", width: 1200, height: 630 }],
  },
  twitter: { card: "summary_large_image", images: ["/draft-rater/og/home.png"] },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${barlow.variable} ${oswald.variable}`} data-scroll-behavior="smooth">
      <body className="min-h-svh antialiased">
        <SiteHeader />
        <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
