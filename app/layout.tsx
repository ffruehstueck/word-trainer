import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Word Trainer",
  description: "Train words and phrases",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

