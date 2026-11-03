import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MarketFlow | Retail operations, beautifully connected",
  description: "Multi-tenant point of sale and business management for ambitious retail teams."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
