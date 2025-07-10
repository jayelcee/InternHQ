/**
 * Root layout for the InternHQ Next.js application.
 * - Applies global fonts (Geist Sans & Mono) and styles.
 * - Sets up HTML structure and metadata.
 */

import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

// Configure Geist Sans font with CSS variable
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

// Configure Geist Mono font with CSS variable
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Application metadata for SEO and browser context
export const metadata: Metadata = {
  title: "InternHQ",
  description: "A time tracking and management system for interns.",
};

/**
 * RootLayout component wraps all pages with global fonts and styles.
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
