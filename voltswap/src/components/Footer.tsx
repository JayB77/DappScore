'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  Zap,
  Twitter,
  MessageCircle,
  Github,
  Send,
  Globe,
  Mail,
  FileText
} from 'lucide-react';

const footerLinks = {
  Products: [
    { name: 'AI Trading Bot', href: '/dashboard' },
    { name: 'Campaign Manager', href: '/campaigns' },
    { name: 'Betting Odds AI', href: '/betting' },
    { name: 'Portfolio Tracker', href: '/portfolio' },
  ],
  Platforms: [
    { name: 'Web App', href: '/dashboard' },
    { name: 'Telegram Bot', href: '#' },
    { name: 'Chrome Extension', href: '#' },
    { name: 'Mobile App (Soon)', href: '#' },
  ],
  Resources: [
    { name: 'Documentation', href: '#' },
    { name: 'API Reference', href: '#' },
    { name: 'Tokenomics', href: '#tokenomics' },
    { name: 'Whitepaper', href: '#' },
  ],
  Company: [
    { name: 'About Us', href: '#' },
    { name: 'Careers', href: '#' },
    { name: 'Blog', href: '#' },
    { name: 'Contact', href: '#' },
  ],
};

const socialLinks = [
  { name: 'Twitter', icon: Twitter, href: '#', color: '#1DA1F2' },
  { name: 'Telegram', icon: Send, href: '#', color: '#0088cc' },
  { name: 'Discord', icon: MessageCircle, href: '#', color: '#5865F2' },
  { name: 'GitHub', icon: Github, href: '#', color: '#ffffff' },
];

export default function Footer() {
  return (
    <footer className="relative border-t border-[#00ff88]/20 bg-gradient-to-b from-transparent to-black/50">
      {/* Glow Effect */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#00ff88] to-transparent" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-8 mb-12">
          {/* Logo & Description */}
          <div className="col-span-2">
            <Link href="/" className="flex items-center space-x-3 mb-6">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#00ff88] to-[#00d4ff] flex items-center justify-center">
                <Zap className="w-7 h-7 text-black" />
              </div>
              <span className="text-2xl font-bold gradient-text">VoltSwap</span>
            </Link>
            <p className="text-gray-400 mb-6 max-w-xs">
              The ultimate AI-powered multi-chain trading platform. Trade smarter, not harder.
            </p>

            {/* Social Links */}
            <div className="flex space-x-4">
              {socialLinks.map((social) => (
                <motion.a
                  key={social.name}
                  href={social.href}
                  whileHover={{ scale: 1.1, y: -2 }}
                  className="w-10 h-10 rounded-lg glass flex items-center justify-center hover:border-[#00ff88]/50 transition-colors"
                >
                  <social.icon className="w-5 h-5" style={{ color: social.color }} />
                </motion.a>
              ))}
            </div>
          </div>

          {/* Links */}
          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h4 className="text-white font-semibold mb-4">{category}</h4>
              <ul className="space-y-3">
                {links.map((link) => (
                  <li key={link.name}>
                    <Link
                      href={link.href}
                      className="text-gray-400 hover:text-[#00ff88] transition-colors text-sm"
                    >
                      {link.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Newsletter */}
        <div className="glass-card p-8 mb-12">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <h3 className="text-xl font-bold text-white mb-2">Stay Updated</h3>
              <p className="text-gray-400">Get the latest updates on AI trading and market insights.</p>
            </div>
            <div className="flex w-full md:w-auto">
              <input
                type="email"
                placeholder="Enter your email"
                className="flex-1 md:w-64 px-4 py-3 rounded-l-xl bg-black/50 border border-[#00ff88]/30 focus:border-[#00ff88] focus:outline-none text-white"
              />
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="px-6 py-3 rounded-r-xl bg-gradient-to-r from-[#00ff88] to-[#00d4ff] text-black font-semibold flex items-center space-x-2"
              >
                <Mail className="w-5 h-5" />
                <span>Subscribe</span>
              </motion.button>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="flex flex-col md:flex-row items-center justify-between pt-8 border-t border-white/10">
          <p className="text-gray-500 text-sm mb-4 md:mb-0">
            © 2025 VoltSwap. All rights reserved.
          </p>
          <div className="flex items-center space-x-6">
            <Link href="#" className="text-gray-500 hover:text-[#00ff88] text-sm flex items-center space-x-1">
              <FileText className="w-4 h-4" />
              <span>Privacy Policy</span>
            </Link>
            <Link href="#" className="text-gray-500 hover:text-[#00ff88] text-sm flex items-center space-x-1">
              <FileText className="w-4 h-4" />
              <span>Terms of Service</span>
            </Link>
            <Link href="#" className="text-gray-500 hover:text-[#00ff88] text-sm flex items-center space-x-1">
              <Globe className="w-4 h-4" />
              <span>English</span>
            </Link>
          </div>
        </div>

        {/* Security Badges */}
        <div className="flex justify-center items-center space-x-8 mt-8 pt-8 border-t border-white/5">
          <div className="flex items-center space-x-2 text-gray-500">
            <div className="w-8 h-8 rounded-full bg-[#00ff88]/10 flex items-center justify-center">
              <Zap className="w-4 h-4 text-[#00ff88]" />
            </div>
            <span className="text-xs">Audited by CertiK</span>
          </div>
          <div className="flex items-center space-x-2 text-gray-500">
            <div className="w-8 h-8 rounded-full bg-[#00d4ff]/10 flex items-center justify-center">
              <Zap className="w-4 h-4 text-[#00d4ff]" />
            </div>
            <span className="text-xs">SOC 2 Compliant</span>
          </div>
          <div className="flex items-center space-x-2 text-gray-500">
            <div className="w-8 h-8 rounded-full bg-[#ff00ff]/10 flex items-center justify-center">
              <Zap className="w-4 h-4 text-[#ff00ff]" />
            </div>
            <span className="text-xs">256-bit Encryption</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
