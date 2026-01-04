import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Word Trainer",
  description: "Train words and phrases",
  other: {
    "google": "notranslate",
    "googlebot": "notranslate",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" translate="no">
      <body>{children}</body>
    </html>
  );
}

