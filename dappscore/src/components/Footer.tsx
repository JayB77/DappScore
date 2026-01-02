'use client';

import Link from 'next/link';
import { Shield, Twitter, Github, MessageCircle } from 'lucide-react';

export function Footer() {
  return (
    <footer className="bg-gray-900 border-t border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="col-span-1 md:col-span-2">
            <Link href="/" className="flex items-center space-x-2 mb-4">
              <Shield className="h-8 w-8 text-yellow-500" />
              <span className="text-xl font-bold text-white">
                Dapp<span className="text-yellow-500">Score</span>
              </span>
            </Link>
            <p className="text-gray-400 mb-4 max-w-md">
              Community-driven crypto project vetting platform. Vote, comment, and help separate
              legitimate projects from scams. Earn $SCORE tokens for contributing.
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

          {/* Links */}
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
                <Link href="/token-sale" className="text-gray-400 hover:text-yellow-500 transition-colors">
                  Token Sale
                </Link>
              </li>
              <li>
                <Link href="/dashboard" className="text-gray-400 hover:text-yellow-500 transition-colors">
                  Dashboard
                </Link>
              </li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h3 className="text-white font-semibold mb-4">Resources</h3>
            <ul className="space-y-2">
              <li>
                <a href="#" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-yellow-500 transition-colors">
                  Documentation
                </a>
              </li>
              <li>
                <a href="#" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-yellow-500 transition-colors">
                  Tokenomics
                </a>
              </li>
              <li>
                <a href="#" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-yellow-500 transition-colors">
                  Whitepaper
                </a>
              </li>
              <li>
                <a href="#" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-yellow-500 transition-colors">
                  Smart Contracts
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-800 mt-8 pt-8 flex flex-col md:flex-row justify-between items-center">
          <p className="text-gray-500 text-sm">
            © 2024 DappScore. Built on Base.
          </p>
          <p className="text-gray-500 text-sm mt-2 md:mt-0">
            Powered by community trust.
          </p>
        </div>
      </div>
    </footer>
  );
}
