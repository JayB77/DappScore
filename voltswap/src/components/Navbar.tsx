'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import {
  Zap,
  Menu,
  X,
  Wallet,
  ChevronDown,
  BarChart3,
  Bot,
  Trophy,
  Coins,
  MessageSquare,
  Chrome,
  Send
} from 'lucide-react';

const navItems = [
  {
    name: 'Products',
    href: '#',
    submenu: [
      { name: 'AI Trading Bot', href: '/dashboard', icon: Bot },
      { name: 'Campaign Manager', href: '/campaigns', icon: Trophy },
      { name: 'Betting Odds AI', href: '/betting', icon: BarChart3 },
      { name: 'Portfolio Tracker', href: '/portfolio', icon: Coins },
    ]
  },
  {
    name: 'Platforms',
    href: '#',
    submenu: [
      { name: 'Web App', href: '/dashboard', icon: BarChart3 },
      { name: 'Telegram Bot', href: '#telegram', icon: Send },
      { name: 'Chrome Extension', href: '#chrome', icon: Chrome },
      { name: 'AI Chat', href: '/chat', icon: MessageSquare },
    ]
  },
  { name: 'Tokenomics', href: '#tokenomics' },
  { name: 'Docs', href: '#docs' },
];

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeSubmenu, setActiveSubmenu] = useState<string | null>(null);

  return (
    <motion.nav
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.5 }}
      className="fixed top-0 left-0 right-0 z-50 glass border-b border-[#00ff88]/20"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-3 group">
            <motion.div
              whileHover={{ rotate: 180 }}
              transition={{ duration: 0.3 }}
              className="relative"
            >
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#00ff88] to-[#00d4ff] flex items-center justify-center">
                <Zap className="w-7 h-7 text-black" />
              </div>
              <div className="absolute inset-0 rounded-xl bg-[#00ff88] blur-lg opacity-50 group-hover:opacity-75 transition-opacity" />
            </motion.div>
            <div>
              <span className="text-2xl font-bold gradient-text">VoltSwap</span>
              <span className="block text-xs text-gray-400">AI Trading Engine</span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center space-x-8">
            {navItems.map((item) => (
              <div
                key={item.name}
                className="relative"
                onMouseEnter={() => item.submenu && setActiveSubmenu(item.name)}
                onMouseLeave={() => setActiveSubmenu(null)}
              >
                <Link
                  href={item.href}
                  className="flex items-center space-x-1 text-gray-300 hover:text-[#00ff88] transition-colors font-medium"
                >
                  <span>{item.name}</span>
                  {item.submenu && <ChevronDown className="w-4 h-4" />}
                </Link>

                {/* Submenu */}
                <AnimatePresence>
                  {item.submenu && activeSubmenu === item.name && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      transition={{ duration: 0.2 }}
                      className="absolute top-full left-0 mt-2 w-56 glass-card p-2"
                    >
                      {item.submenu.map((subitem) => (
                        <Link
                          key={subitem.name}
                          href={subitem.href}
                          className="flex items-center space-x-3 px-4 py-3 rounded-lg hover:bg-[#00ff88]/10 transition-colors group"
                        >
                          <subitem.icon className="w-5 h-5 text-[#00ff88] group-hover:text-[#00d4ff]" />
                          <span className="text-gray-300 group-hover:text-white">{subitem.name}</span>
                        </Link>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>

          {/* CTA Buttons */}
          <div className="hidden lg:flex items-center space-x-4">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="flex items-center space-x-2 px-6 py-3 rounded-xl border-2 border-[#00ff88]/50 text-[#00ff88] font-semibold hover:bg-[#00ff88]/10 transition-all"
            >
              <Wallet className="w-5 h-5" />
              <span>Connect Wallet</span>
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="btn-primary flex items-center space-x-2"
            >
              <Bot className="w-5 h-5" />
              <span>Launch App</span>
            </motion.button>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="lg:hidden p-2 rounded-lg hover:bg-white/5"
          >
            {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="lg:hidden glass border-t border-[#00ff88]/20"
          >
            <div className="px-4 py-6 space-y-4">
              {navItems.map((item) => (
                <div key={item.name}>
                  <Link
                    href={item.href}
                    className="block py-2 text-lg font-medium text-gray-300 hover:text-[#00ff88]"
                    onClick={() => !item.submenu && setIsOpen(false)}
                  >
                    {item.name}
                  </Link>
                  {item.submenu && (
                    <div className="pl-4 mt-2 space-y-2">
                      {item.submenu.map((subitem) => (
                        <Link
                          key={subitem.name}
                          href={subitem.href}
                          className="flex items-center space-x-2 py-2 text-gray-400 hover:text-[#00ff88]"
                          onClick={() => setIsOpen(false)}
                        >
                          <subitem.icon className="w-4 h-4" />
                          <span>{subitem.name}</span>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              <div className="pt-4 space-y-3">
                <button className="w-full flex items-center justify-center space-x-2 px-6 py-3 rounded-xl border-2 border-[#00ff88]/50 text-[#00ff88] font-semibold">
                  <Wallet className="w-5 h-5" />
                  <span>Connect Wallet</span>
                </button>
                <button className="w-full btn-primary flex items-center justify-center space-x-2">
                  <Bot className="w-5 h-5" />
                  <span>Launch App</span>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
}
