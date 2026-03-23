'use client';

import Link from 'next/link';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';
import { Shield, Menu, X, ChevronDown, Zap, GitCompare, Network, BarChart3 } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { AlertsBell } from './AlertsBell';

const TOOLS = [
  { href: '/tools/rug-monitor',  label: 'Rug Monitor',        icon: <Zap className="h-4 w-4 text-red-400" />,    desc: 'Real-time rug-pull early warning' },
  { href: '/tools/compare',      label: 'Compare Projects',   icon: <GitCompare className="h-4 w-4 text-blue-400" />,   desc: 'Side-by-side project analysis' },
  { href: '/tools/wallet-graph', label: 'Wallet Graph',       icon: <Network className="h-4 w-4 text-purple-400" />,   desc: 'Transaction network visualizer' },
  { href: '/tools/gini',         label: 'Holder Distribution', icon: <BarChart3 className="h-4 w-4 text-green-400" />, desc: 'Token supply concentration' },
];

function ToolsDropdown() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1 text-gray-300 hover:text-yellow-500 transition-colors"
      >
        Tools
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-64 bg-gray-900 border border-gray-700 rounded-xl shadow-xl py-2 z-50">
          {TOOLS.map(tool => (
            <Link
              key={tool.href}
              href={tool.href}
              onClick={() => setOpen(false)}
              className="flex items-start gap-3 px-4 py-2.5 hover:bg-gray-800 transition-colors group"
            >
              <span className="mt-0.5">{tool.icon}</span>
              <span>
                <span className="block text-sm text-white group-hover:text-yellow-400 transition-colors">
                  {tool.label}
                </span>
                <span className="block text-xs text-gray-500">{tool.desc}</span>
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function Header() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const { isConnected: _isConnected, address } = useAccount();
  const isConnected = mounted && _isConnected;
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileToolsOpen, setMobileToolsOpen] = useState(false);

  const navLinks = [
    { href: '/', label: 'Home' },
    { href: '/projects', label: 'Projects' },
    { href: '/wallet', label: 'Wallet Scanner' },
    { href: '/token-sale', label: 'Token Sale' },
    { href: '/submit', label: 'Submit Project' },
  ];

  return (
    <header className="bg-gray-900 border-b border-gray-800 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-2">
            <Shield className="h-8 w-8 text-yellow-500" />
            <span className="text-xl font-bold text-white">
              Dapp<span className="text-yellow-500">Score</span>
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-8">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-gray-300 hover:text-yellow-500 transition-colors"
              >
                {link.label}
              </Link>
            ))}
            <ToolsDropdown />
            {isConnected && (
              <Link
                href="/dashboard"
                className="text-gray-300 hover:text-yellow-500 transition-colors"
              >
                Dashboard
              </Link>
            )}
          </nav>

          {/* Connect Button */}
          <div className="flex items-center space-x-4">
            {isConnected && address && <AlertsBell walletAddress={address} />}
            <ConnectButton
              chainStatus="icon"
              showBalance={false}
              accountStatus={{
                smallScreen: 'avatar',
                largeScreen: 'full',
              }}
            />

            {/* Mobile menu button */}
            <button
              className="md:hidden text-gray-400 hover:text-white"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden pb-4">
            <nav className="flex flex-col space-y-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-gray-300 hover:text-yellow-500 px-2 py-2 transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {link.label}
                </Link>
              ))}

              {/* Tools submenu for mobile */}
              <button
                onClick={() => setMobileToolsOpen(o => !o)}
                className="flex items-center justify-between text-gray-300 hover:text-yellow-500 px-2 py-2 transition-colors"
              >
                <span>Tools</span>
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${mobileToolsOpen ? 'rotate-180' : ''}`} />
              </button>
              {mobileToolsOpen && (
                <div className="pl-4 space-y-1 border-l border-gray-800 ml-2">
                  {TOOLS.map(tool => (
                    <Link
                      key={tool.href}
                      href={tool.href}
                      className="flex items-center gap-2 text-gray-400 hover:text-yellow-500 py-1.5 transition-colors text-sm"
                      onClick={() => { setMobileMenuOpen(false); setMobileToolsOpen(false); }}
                    >
                      {tool.icon}
                      {tool.label}
                    </Link>
                  ))}
                </div>
              )}

              {isConnected && (
                <Link
                  href="/dashboard"
                  className="text-gray-300 hover:text-yellow-500 px-2 py-2 transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Dashboard
                </Link>
              )}
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}
