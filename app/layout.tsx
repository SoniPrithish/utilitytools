import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "UtilityTools - Free Online File Tools",
  description: "Fast, free browser-based utility tools. Compress images, convert PDFs, merge files, and more. All processing happens locally for maximum privacy.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} font-sans antialiased bg-gray-50`}>
        <Header />
        <main>{children}</main>
      </body>
    </html>
  );
}
