'use client';

import { useEffect, useState } from 'react';
import {
  Users, Loader2, ExternalLink, MessageCircle, Radio,
} from 'lucide-react';
import { useFeatureFlag } from '@/lib/featureFlags';

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseDiscordCode(url: string): string | null {
  if (!url || url === '#') return null;
  const m = url.match(/discord(?:\.gg|\.com\/invite)\/([A-Za-z0-9-]+)/);
  return m ? m[1] : null;
}

function parseTelegramUsername(url: string): string | null {
  if (!url || url === '#') return null;
  // https://t.me/username  or  t.me/username
  const m = url.match(/(?:t\.me|telegram\.me)\/([A-Za-z0-9_]+)/);
  return m ? m[1] : null;
}

function fmtCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

// ── Discord invite API (public, no auth required) ─────────────────────────────

interface DiscordData {
  memberCount: number;
  onlineCount: number;
  guildName: string;
  inviteCode: string;
}

async function fetchDiscordInvite(code: string): Promise<DiscordData> {
  const res = await fetch(
    `https://discord.com/api/v9/invites/${code}?with_counts=true`,
    { headers: { Accept: 'application/json' } },
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json() as {
    approximate_member_count?: number;
    approximate_presence_count?: number;
    guild?: { name?: string };
  };
  return {
    memberCount: data.approximate_member_count ?? 0,
    onlineCount: data.approximate_presence_count ?? 0,
    guildName: data.guild?.name ?? 'Discord Server',
    inviteCode: code,
  };
}

// ── Types ─────────────────────────────────────────────────────────────────────

type LoadState = 'idle' | 'loading' | 'ok' | 'error';

interface SocialLinks {
  discord?: string;
  telegram?: string;
  [key: string]: string | undefined;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function DiscordCard({ url }: { url: string }) {
  const code = parseDiscordCode(url);
  const [state, setState] = useState<LoadState>('idle');
  const [data, setData] = useState<DiscordData | null>(null);

  useEffect(() => {
    if (!code) return;
    let cancelled = false;
    setState('loading');
    fetchDiscordInvite(code)
      .then((d) => { if (!cancelled) { setData(d); setState('ok'); } })
      .catch(() => { if (!cancelled) setState('error'); });
    return () => { cancelled = true; };
  }, [code]);

  if (!code) return null;

  return (
    <div className="bg-[#5865F2]/10 border border-[#5865F2]/30 rounded-lg p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {/* Discord logo approximation */}
          <div className="w-10 h-10 rounded-full bg-[#5865F2] flex items-center justify-center shrink-0">
            <MessageCircle className="h-5 w-5 text-white" />
          </div>
          <div className="min-w-0">
            <p className="font-medium text-white truncate">
              {state === 'ok' && data ? data.guildName : 'Discord'}
            </p>
            {state === 'loading' && (
              <p className="text-xs text-gray-400 flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" /> Fetching stats…
              </p>
            )}
            {state === 'ok' && data && (
              <div className="flex items-center gap-3 mt-0.5">
                <span className="text-xs text-gray-300 flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {fmtCount(data.memberCount)} members
                </span>
                <span className="text-xs text-green-400 flex items-center gap-1">
                  <Radio className="h-3 w-3" />
                  {fmtCount(data.onlineCount)} online
                </span>
              </div>
            )}
            {state === 'error' && (
              <p className="text-xs text-gray-500">Could not load stats</p>
            )}
          </div>
        </div>
        <a
          href={`https://discord.gg/${code}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#5865F2] hover:text-[#7289da] shrink-0"
        >
          <ExternalLink className="h-4 w-4" />
        </a>
      </div>
    </div>
  );
}

function TelegramCard({ url }: { url: string }) {
  const username = parseTelegramUsername(url);
  if (!username) return null;

  return (
    <div className="bg-[#229ED9]/10 border border-[#229ED9]/30 rounded-lg p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-full bg-[#229ED9] flex items-center justify-center shrink-0">
            <MessageCircle className="h-5 w-5 text-white" />
          </div>
          <div className="min-w-0">
            <p className="font-medium text-white truncate">Telegram</p>
            <p className="text-xs text-gray-400">@{username}</p>
          </div>
        </div>
        <a
          href={`https://t.me/${username}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#229ED9] hover:text-[#4fc3e8] shrink-0"
        >
          <ExternalLink className="h-4 w-4" />
        </a>
      </div>
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

interface Props {
  socialLinks: SocialLinks;
}

export default function SocialProofPanel({ socialLinks }: Props) {
  const enabled = useFeatureFlag('socialProof', true);
  if (!enabled) return null;

  const hasDiscord = !!(socialLinks.discord && socialLinks.discord !== '#' && parseDiscordCode(socialLinks.discord));
  const hasTelegram = !!(socialLinks.telegram && socialLinks.telegram !== '#' && parseTelegramUsername(socialLinks.telegram));

  if (!hasDiscord && !hasTelegram) return null;

  return (
    <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-6">
      <div className="flex items-center gap-3 mb-4">
        <Users className="h-5 w-5 text-blue-400" />
        <h3 className="font-semibold text-white">Community</h3>
        <span className="ml-auto text-xs bg-green-500/20 text-green-400 border border-green-500/30 rounded-full px-2 py-0.5">
          +Signal
        </span>
      </div>

      <div className="space-y-3">
        {hasDiscord && <DiscordCard url={socialLinks.discord!} />}
        {hasTelegram && <TelegramCard url={socialLinks.telegram!} />}
      </div>

      <p className="text-xs text-gray-500 mt-3">
        Active community channels are a positive trust signal. Discord member counts via Discord&apos;s public invite API.
      </p>
    </div>
  );
}
