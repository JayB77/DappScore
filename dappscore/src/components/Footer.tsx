'use client';

import Link from 'next/link';
import { Shield, Twitter, Github, MessageCircle, Chrome, Rocket } from 'lucide-react';

export function Footer() {
  return (
    <footer className="bg-gray-900 border-t border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-8">
          {/* Brand */}
          <div className="col-span-1 md:col-span-2">
            <Link href="/" className="flex items-center space-x-2 mb-4">
              <Shield className="h-8 w-8 text-yellow-500" />
              <span className="text-xl font-bold text-white">
                Dapp<span className="text-yellow-500">Score</span>
              </span>
            </Link>
            <p className="text-gray-400 mb-4 max-w-md">
              Community-driven crypto project vetting platform. Vote on blockchain projects,
              expose scams, and gain on-chain reputation for contributing.
            </p>
            <div className="flex space-x-4">
              <a href="#" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-yellow-500 transition-colors">
                <Twitter className="h-5 w-5" />
              </a>
              <a href="#" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-yellow-500 transition-colors">
                <MessageCircle className="h-5 w-5" />
              </a>
              <a href="#" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-yellow-500 transition-colors">
                <Github className="h-5 w-5" />
              </a>
            </div>
          </div>

          {/* Platform */}
          <div>
            <h3 className="text-white font-semibold mb-4">Platform</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/projects" className="text-gray-400 hover:text-yellow-500 transition-colors">
                  Browse Projects
                </Link>
              </li>
              <li>
                <Link href="/submit" className="text-gray-400 hover:text-yellow-500 transition-colors">
                  Submit Project
                </Link>
              </li>
              <li>
                <Link href="/report-scam" className="text-gray-400 hover:text-yellow-500 transition-colors">
                  Report a Scam
                </Link>
              </li>
              <li>
                <Link href="/dashboard" className="text-gray-400 hover:text-yellow-500 transition-colors">
                  Dashboard
                </Link>
              </li>
              <li>
                <Link href="/token-sale" className="text-gray-400 hover:text-yellow-500 transition-colors">
                  Token Sale
                </Link>
              </li>
              <li>
                <Link href="/extension" className="text-gray-400 hover:text-yellow-500 transition-colors inline-flex items-center gap-1.5">
                  <Chrome className="h-3.5 w-3.5" />
                  Chrome Extension
                </Link>
              </li>
            </ul>
          </div>

          {/* Developers */}
          <div>
            <h3 className="text-white font-semibold mb-4">Developers</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/developer" className="text-gray-400 hover:text-yellow-500 transition-colors">
                  B2B Scam API
                </Link>
              </li>
              <li>
                <Link href="/developer#pricing" className="text-gray-400 hover:text-yellow-500 transition-colors">
                  API Pricing
                </Link>
              </li>
              <li>
                <a href="https://docs.dappscore.io/api" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-yellow-500 transition-colors">
                  API Reference
                </a>
              </li>
              <li>
                <a href="https://docs.dappscore.io" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-yellow-500 transition-colors">
                  Documentation
                </a>
              </li>
              <li>
                <Link href="/status" className="text-gray-400 hover:text-yellow-500 transition-colors">
                  System Status
                </Link>
              </li>
            </ul>
          </div>

          {/* Coming Soon */}
          <div>
            <h3 className="text-white font-semibold mb-4">Coming Soon</h3>
            <ul className="space-y-2">
              <li>
                <span className="inline-flex items-center gap-2 text-gray-500 cursor-default">
                  <Rocket className="h-3.5 w-3.5" />
                  Launchpad
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 font-semibold">
                    Soon
                  </span>
                </span>
              </li>
              <li>
                <a href="https://docs.dappscore.io/token/tokenomics" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-yellow-500 transition-colors">
                  Tokenomics
                </a>
              </li>
              <li>
                <a href="https://docs.dappscore.io/resources/wallets" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-yellow-500 transition-colors">
                  Official Wallets
                </a>
              </li>
              <li>
                <a href="https://docs.dappscore.io/faq" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-yellow-500 transition-colors">
                  FAQ
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-800 mt-8 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-gray-500 text-sm">
            © 2026 DappScore. Built on Base.
          </p>
          <div className="flex items-center gap-6">
            <Link href="/developer" className="text-xs text-gray-500 hover:text-yellow-500 transition-colors">
              B2B API
            </Link>
            <Link href="/report-scam" className="text-xs text-gray-500 hover:text-yellow-500 transition-colors">
              Report Scam
            </Link>
            <p className="text-gray-500 text-sm">
              Powered by community trust.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
