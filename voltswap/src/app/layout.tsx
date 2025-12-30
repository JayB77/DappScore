import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "VoltSwap | AI-Powered Multi-Chain Trading Platform",
  description: "The ultimate AI-powered trading bot that works across ERC-20, Solana, BTC, and all major chains. Automated trading, investment campaigns, and AI betting odds.",
  keywords: "crypto trading, AI trading bot, multi-chain, DeFi, Arbitrum, Solana, Bitcoin, automated trading",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased bg-[#0a0a0f] text-white font-sans">
        <div className="cyber-grid fixed inset-0 pointer-events-none opacity-50" />
        <Navbar />
        <main className="relative z-10">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
