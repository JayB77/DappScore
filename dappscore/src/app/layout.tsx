import type { Metadata } from 'next';
import Script from 'next/script';
import './globals.css';
import { Web3Provider } from '@/providers/Web3Provider';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';

export const metadata: Metadata = {
  title: 'DappScore - Community-Driven Crypto Project Vetting',
  description: 'Community-driven crypto project vetting platform. Vote on blockchain projects, expose scams, and gain on-chain reputation for contributing.',
  keywords: ['crypto project vetting', 'blockchain due diligence', 'crypto scam detection', 'DeFi community voting', 'on-chain reputation', 'dapp', 'DeFi', 'rug pull detector'],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-DYGF6T8VE3"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-DYGF6T8VE3');
          `}
        </Script>
      </head>
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
