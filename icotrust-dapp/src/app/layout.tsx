import type { Metadata } from 'next';
import './globals.css';
import { Web3Provider } from '@/providers/Web3Provider';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';

export const metadata: Metadata = {
  title: 'ICOTrust - Community-Driven Crypto Project Vetting',
  description: 'Vote, comment, and help separate legitimate crypto projects from scams. Earn $TRUST tokens for contributing to the community.',
  keywords: ['ICO', 'crypto', 'blockchain', 'trust', 'voting', 'DeFi', 'token sale'],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="font-sans bg-gray-950 text-white min-h-screen flex flex-col">
        <Web3Provider>
          <Header />
          <main className="flex-grow">{children}</main>
          <Footer />
        </Web3Provider>
      </body>
    </html>
  );
}
