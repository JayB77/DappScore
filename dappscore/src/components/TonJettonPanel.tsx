'use client';

import { useEffect, useState } from 'react';
import { Coins, Loader2, AlertTriangle, HelpCircle, CheckCircle, ExternalLink } from 'lucide-react';
import { getChainConfig } from '@/lib/chainAdapters';

// ── TONAPI response (free, no key required) ────────────────────────────────────
// https://tonapi.io/v2/jettons/{address}

interface TonApiJetton {
  mintable:    boolean;
  total_supply?: string;
  admin?:      { address: string; name?: string } | null;
  metadata?: {
    name?:   string;
    symbol?: string;
    image?:  string;
    description?: string;
  };
  verification?: 'whitelist' | 'blacklist' | 'none';
  holders_count?: number;
}

interface JettonInfo {
  name:         string | null;
  symbol:       string | null;
  mintable:     boolean;
  adminAddress: string | null;
  adminName:    string | null;
  holderCount:  number | null;
  verified:     boolean;
  blacklisted:  boolean;
}

async function fetchTonJetton(address: string): Promise<JettonInfo> {
  const res = await fetch(
    `https://tonapi.io/v2/jettons/${encodeURIComponent(address)}`,
    { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(15_000) },
  );
  if (!res.ok) throw new Error(`TONAPI ${res.status}`);
  const j = await res.json() as TonApiJetton;
  return {
    name:         j.metadata?.name   ?? null,
    symbol:       j.metadata?.symbol ?? null,
    mintable:     j.mintable,
    adminAddress: j.admin?.address ?? null,
    adminName:    j.admin?.name    ?? null,
    holderCount:  j.holders_count  ?? null,
    verified:     j.verification === 'whitelist',
    blacklisted:  j.verification === 'blacklist',
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function shortAddr(addr: string): string {
  if (addr.length <= 16) return addr;
  return `${addr.slice(0, 8)}…${addr.slice(-6)}`;
}

function RiskRow({
  label,
  active,
  activeText,
  clearText,
  severity,
}: {
  label:      string;
  active:     boolean;
  activeText: string;
  clearText:  string;
  severity:   'critical' | 'high' | 'medium';
}) {
  const cfg = {
    critical: { bg: 'bg-red-500/15',    border: 'border-red-500/30',    text: 'text-red-400',    dot: 'bg-red-400'    },
    high:     { bg: 'bg-orange-500/15', border: 'border-orange-500/30', text: 'text-orange-400', dot: 'bg-orange-400' },
    medium:   { bg: 'bg-yellow-500/15', border: 'border-yellow-500/30', text: 'text-yellow-400', dot: 'bg-yellow-400' },
  }[severity];

  return (
    <div className={`rounded-lg border p-2.5 flex items-center gap-2.5 ${
      active ? `${cfg.bg} ${cfg.border}` : 'bg-gray-700/20 border-gray-700'
    }`}>
      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${active ? cfg.dot : 'bg-green-500'}`} />
      <div className="min-w-0 flex-1">
        <span className={`text-xs font-semibold ${active ? cfg.text : 'text-green-400'}`}>{label}</span>
        <p className={`text-xs mt-0.5 ${active ? cfg.text + ' opacity-70' : 'text-gray-500'}`}>
          {active ? activeText : clearText}
        </p>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface ContractAddress { chain: string; address: string }

interface Props {
  contractAddresses: ContractAddress[];
}

type State =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ok'; data: JettonInfo }
  | { status: 'error'; message?: string };

function JettonRow({ address }: { address: string }) {
  const [state, setState] = useState<State>({ status: 'idle' });

  useEffect(() => {
    setState({ status: 'loading' });
    fetchTonJetton(address)
      .then(data => setState({ status: 'ok', data }))
      .catch((e: unknown) => setState({ status: 'error', message: e instanceof Error ? e.message : undefined }));
  }, [address]);

  const tonscanUrl = `https://tonscan.org/address/${address}`;

  return (
    <div className="border border-gray-700 rounded-lg p-3 space-y-3">
      {/* Address header */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">TON Jetton</span>
        <a
          href={tonscanUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto text-gray-600 hover:text-gray-400 transition-colors"
          title="View on Tonscan"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>

      {state.status === 'loading' && (
        <div className="flex items-center gap-1.5 text-gray-500 text-sm">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          <span>Fetching jetton info…</span>
        </div>
      )}

      {state.status === 'error' && (
        <div className="flex items-center gap-1.5 text-gray-500 text-xs">
          <AlertTriangle className="h-3.5 w-3.5" />
          <span>Unable to load jetton data</span>
        </div>
      )}

      {state.status === 'ok' && (() => {
        const d = state.data;
        const hasAdmin = !!d.adminAddress;
        const overallRisk = d.blacklisted
          ? 'critical'
          : hasAdmin || d.mintable
            ? 'high'
            : null;

        return (
          <>
            {/* Token name + verification badge */}
            {(d.name || d.symbol) && (
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-gray-200">
                  {d.name ?? d.symbol}
                  {d.symbol && d.name && d.name !== d.symbol && (
                    <span className="text-gray-500 font-normal ml-1">({d.symbol})</span>
                  )}
                </span>
                {d.blacklisted ? (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30 font-bold">
                    SCAM
                  </span>
                ) : d.verified ? (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-green-500/15 text-green-400 border border-green-500/25 font-semibold">
                    Verified
                  </span>
                ) : (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-gray-700/50 text-gray-500 border border-gray-600/50">
                    Unverified
                  </span>
                )}
              </div>
            )}

            {/* Overall risk summary */}
            {overallRisk && (
              <div className={`rounded-lg p-2.5 text-xs font-semibold ${
                overallRisk === 'critical'
                  ? 'bg-red-500/15 border border-red-500/30 text-red-400'
                  : 'bg-orange-500/15 border border-orange-500/30 text-orange-400'
              }`}>
                {d.blacklisted
                  ? 'This jetton is flagged as a scam by TONAPI.'
                  : hasAdmin && d.mintable
                    ? 'Active admin + mintable supply — high rug risk.'
                    : hasAdmin
                      ? 'Active jetton admin can modify or rug this token.'
                      : 'Mintable supply — admin can dilute all holders.'}
              </div>
            )}

            {/* Risk rows */}
            <div className="space-y-1.5">
              <RiskRow
                label="Jetton Admin"
                active={hasAdmin}
                activeText={d.adminName
                  ? `${d.adminName} (${shortAddr(d.adminAddress!)})`
                  : shortAddr(d.adminAddress!)}
                clearText="No admin — fully decentralised"
                severity="critical"
              />
              <RiskRow
                label="Mintable Supply"
                active={d.mintable}
                activeText="Admin can mint unlimited new tokens"
                clearText="Supply is fixed — minting disabled"
                severity="high"
              />
              <RiskRow
                label="Verified on TONAPI"
                active={!d.verified && !d.blacklisted}
                activeText="Not in TONAPI whitelist — exercise caution"
                clearText="Listed in TONAPI verified whitelist"
                severity="medium"
              />
            </div>

            {/* Holder count */}
            {d.holderCount != null && (
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>Unique holders</span>
                <span className={`font-semibold ${
                  d.holderCount > 1000 ? 'text-green-400' :
                  d.holderCount > 100  ? 'text-yellow-400' :
                                         'text-orange-400'
                }`}>
                  {d.holderCount.toLocaleString()}
                </span>
              </div>
            )}

            {/* All clear */}
            {!hasAdmin && !d.mintable && !d.blacklisted && d.verified && (
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0" />
                <span className="text-sm text-green-400">No admin, fixed supply, verified — low risk</span>
              </div>
            )}
          </>
        );
      })()}
    </div>
  );
}

export default function TonJettonPanel({ contractAddresses }: Props) {
  const tonAddresses = contractAddresses.filter(({ chain }) => {
    const cfg = getChainConfig(chain);
    return cfg?.family === 'ton';
  });

  if (tonAddresses.length === 0) return null;

  return (
    <div className="bg-gray-800 rounded-xl p-6">
      <div className="flex items-center space-x-2 mb-4">
        <Coins className="h-4 w-4 text-gray-400" />
        <h3 className="font-bold text-sm uppercase tracking-wider text-gray-400">TON Jetton Analysis</h3>
      </div>

      <p className="text-xs text-gray-500 mb-3">
        Checks jetton admin control, mintability, and TONAPI verification status.
        An active admin address is the primary rug risk on TON.
      </p>

      <div className="space-y-3">
        {tonAddresses.map(({ address }) => (
          <JettonRow key={address} address={address} />
        ))}
      </div>

      <p className="text-xs text-gray-600 mt-4">
        Data via{' '}
        <a
          href="https://tonapi.io"
          target="_blank"
          rel="noopener noreferrer"
          className="text-gray-500 hover:text-gray-400"
        >
          TONAPI
        </a>
        {' '}· Not financial advice
      </p>
    </div>
  );
}
