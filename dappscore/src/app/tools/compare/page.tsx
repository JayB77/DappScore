'use client';

import { useState } from 'react';
import {
  GitCompare, Loader2, Search, AlertTriangle, CheckCircle,
  XCircle, Info, ShieldAlert, Shield,
} from 'lucide-react';
import { getChainConfig } from '@/lib/chainAdapters';

// ── Types (mirrored from TokenSecurityPanel) ──────────────────────────────────

interface ParsedFlag {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  name: string;
  label: string;
  why: string;
}

interface Heuristic {
  key: string;
  label: string;
  active: boolean;
  severity: 'critical' | 'high' | 'medium';
  detail: string;
  why: string;
}

interface TokenSecurity {
  flags: ParsedFlag[];
  heuristics: Heuristic[];
  riskScore: number;
  name: string | null;
  symbol: string | null;
  buyTaxPct: number;
  sellTaxPct: number;
  allClear: boolean;
}

// ── GoPlus raw types ──────────────────────────────────────────────────────────

interface GoPlusEVMRaw {
  is_honeypot?: '0' | '1';
  honeypot_with_same_creator?: '0' | '1';
  cannot_buy?: '0' | '1';
  cannot_sell_all?: '0' | '1';
  is_mintable?: '0' | '1';
  can_be_minted?: '0' | '1';
  slippage_modifiable?: '0' | '1';
  personal_slippage_modifiable?: '0' | '1';
  transfer_pausable?: '0' | '1';
  is_blacklisted?: '0' | '1';
  hidden_owner?: '0' | '1';
  owner_change_balance?: '0' | '1';
  is_contract_renounced?: '0' | '1';
  owner_address?: string;
  is_open_source?: '0' | '1';
  is_proxy?: '0' | '1';
  trading_cooldown?: '0' | '1';
  buy_tax?: string;
  sell_tax?: string;
  total_supply?: string;
  holders?: Array<{ percent: string }>;
  lp_holders?: Array<{ percent: string; is_locked: number }>;
  lp_total_supply?: string;
  dex?: Array<{ name: string }>;
  token_name?: string;
  token_symbol?: string;
}

interface GoPlusSolanaRaw {
  mint_authority?: string | null;
  freeze_authority?: string | null;
  is_mintable?: '0' | '1';
  can_freeze_account?: '0' | '1';
  is_closable?: '0' | '1';
  metadata_mutable?: '0' | '1';
  token_name?: string;
  token_symbol?: string;
}

// ── Flag catalogue (subset) ────────────────────────────────────────────────────

const FLAG_DEFS: Record<string, { name: string; severity: 'critical' | 'high' | 'medium' | 'low'; label: string; why: string }> = {
  honeypot:                  { name: 'Honeypot Detected',              severity: 'critical', label: 'Honeypot',         why: 'You can buy but cannot sell. Your funds would be permanently trapped.' },
  'cannot-buy':              { name: 'Buying Disabled',                severity: 'critical', label: 'Buy Disabled',     why: 'The contract is blocking all buy transactions.' },
  'cannot-sell-all':         { name: 'Cannot Sell All Tokens',         severity: 'high',     label: 'Partial Sell Lock',why: 'Holders cannot sell their full balance.' },
  'honeypot-creator-history':{ name: 'Creator Deployed Honeypots Before', severity: 'high', label: 'Scam Deployer',    why: 'The deployer has previously deployed confirmed honeypot tokens.' },
  mintable:                  { name: 'Unlimited Minting',              severity: 'high',     label: 'Unlimited Mint',   why: 'Owner can create unlimited new tokens at any time.' },
  'slippage-modifiable':     { name: 'Adjustable Taxes',               severity: 'high',     label: 'Tax Adjustable',   why: 'Owner can raise buy/sell taxes to any value including 100%.' },
  'tax-over-20':             { name: 'Tax Currently >20%',             severity: 'critical', label: 'Tax >20%',         why: 'Buy or sell tax exceeds 20%. You lose 1-in-5 on every trade.' },
  'exclude-from-fee':        { name: 'excludeFromFee() Present',       severity: 'medium',   label: 'Fee Exclusion',    why: 'Specific wallets can be made tax-exempt while regular buyers pay full fees.' },
  'transfer-pausable':       { name: 'Trading Lock',                   severity: 'high',     label: 'Trading Lock',     why: 'Owner can disable all trading at any time.' },
  'blacklist-function':      { name: 'Blacklist',                      severity: 'medium',   label: 'Blacklist',        why: 'Owner can block any wallet from buying or selling.' },
  'hidden-owner':            { name: 'Hidden Owner',                   severity: 'critical', label: 'Hidden Owner',     why: 'A concealed owner retains full admin control even after apparent renouncement.' },
  'owner-can-change-balance':{ name: 'Owner Can Modify Balances',      severity: 'critical', label: 'Balance Manip.',   why: 'Owner can set any wallet\'s balance to zero without a transaction.' },
  'ownership-not-renounced': { name: 'Ownership Not Renounced',        severity: 'medium',   label: 'Active Owner',     why: 'An active owner can invoke any privileged function at any time.' },
  'unverified-contract':     { name: 'Unverified Contract',            severity: 'high',     label: 'Unverified',       why: 'Source code is not verified — malicious logic could be hidden in bytecode.' },
  'proxy-contract':          { name: 'Proxy Contract',                 severity: 'low',      label: 'Proxy',            why: 'Logic can be upgraded by the owner silently.' },
  'whale-concentration':     { name: 'High Whale Concentration',       severity: 'high',     label: 'Whale Risk',       why: 'A small number of wallets control a large share of supply.' },
  'lp-not-locked':           { name: 'LP Not Locked',                  severity: 'high',     label: 'LP Unlocked',      why: 'Deployer can remove all liquidity at any time (rug pull).' },
  'lp-lock-unknown':         { name: 'LP Lock Status Unknown',         severity: 'medium',   label: 'LP Unknown',       why: 'LP lock status cannot be confirmed. Unlocked LP is a rug pull risk.' },
  'trading-cooldown':        { name: 'Trading Cooldown',               severity: 'low',      label: 'Cooldown',         why: 'A delay is enforced between consecutive trades.' },
  'mint-authority-active':   { name: 'Mint Authority Active',          severity: 'critical', label: 'Mint Active',      why: 'Mint authority can create unlimited new tokens at any time.' },
  'freeze-authority-active': { name: 'Freeze Authority Active',        severity: 'high',     label: 'Freeze Risk',      why: 'Freeze authority can lock any token account without consent.' },
  'mutable-metadata':        { name: 'Mutable Token Metadata',         severity: 'medium',   label: 'Mutable Meta',     why: 'Token name, symbol, and image URI can be changed at any time.' },
  'closeable-mint':          { name: 'Mint Account Closeable',         severity: 'high',     label: 'Closeable Mint',   why: 'The mint account can be destroyed by the authority.' },
};

const WEIGHTS: Record<string, number> = {
  honeypot: 50, 'cannot-buy': 50, 'cannot-sell-all': 40,
  'honeypot-creator-history': 30,
  mintable: 20, 'slippage-modifiable': 25, 'tax-over-20': 35,
  'exclude-from-fee': 10,
  'transfer-pausable': 25, 'blacklist-function': 15,
  'hidden-owner': 40, 'owner-can-change-balance': 40,
  'ownership-not-renounced': 10,
  'unverified-contract': 20, 'proxy-contract': 5,
  'whale-concentration': 20, 'lp-not-locked': 25, 'lp-lock-unknown': 10,
  'trading-cooldown': 5,
  'mint-authority-active': 50, 'freeze-authority-active': 25,
  'mutable-metadata': 10, 'closeable-mint': 20,
};

function f1(v?: '0' | '1'): boolean { return v === '1'; }

function resolveFlag(id: string): ParsedFlag {
  const def = FLAG_DEFS[id];
  return { id, severity: def?.severity ?? 'medium', name: def?.name ?? id, label: def?.label ?? id, why: def?.why ?? '' };
}

// ── EVM parser ────────────────────────────────────────────────────────────────

function parseEvmSecurity(raw: GoPlusEVMRaw): TokenSecurity {
  const flagIds: string[] = [];

  if (f1(raw.is_honeypot))                flagIds.push('honeypot');
  if (f1(raw.cannot_buy))                 flagIds.push('cannot-buy');
  if (f1(raw.cannot_sell_all))            flagIds.push('cannot-sell-all');
  if (f1(raw.honeypot_with_same_creator)) flagIds.push('honeypot-creator-history');
  if (f1(raw.is_mintable) || f1(raw.can_be_minted)) flagIds.push('mintable');
  if (f1(raw.slippage_modifiable))        flagIds.push('slippage-modifiable');
  if (f1(raw.personal_slippage_modifiable)) flagIds.push('exclude-from-fee');
  if (f1(raw.transfer_pausable))          flagIds.push('transfer-pausable');
  if (f1(raw.is_blacklisted))             flagIds.push('blacklist-function');
  if (f1(raw.hidden_owner))               flagIds.push('hidden-owner');
  if (f1(raw.owner_change_balance))       flagIds.push('owner-can-change-balance');
  if (!f1(raw.is_open_source))            flagIds.push('unverified-contract');
  if (f1(raw.is_proxy))                   flagIds.push('proxy-contract');
  if (f1(raw.trading_cooldown))           flagIds.push('trading-cooldown');

  const buyTaxPct  = raw.buy_tax  ? parseFloat(raw.buy_tax)  * 100 : 0;
  const sellTaxPct = raw.sell_tax ? parseFloat(raw.sell_tax) * 100 : 0;
  if (buyTaxPct > 20 || sellTaxPct > 20) flagIds.push('tax-over-20');

  if (!f1(raw.is_contract_renounced) && raw.owner_address && raw.owner_address !== '0x0000000000000000000000000000000000000000') {
    flagIds.push('ownership-not-renounced');
  }
  if (raw.holders?.length) {
    const top10pct = raw.holders.slice(0, 10).reduce((s, h) => s + parseFloat(h.percent || '0') * 100, 0);
    if (top10pct > 50) flagIds.push('whale-concentration');
  }
  if (raw.lp_holders?.length) {
    const lockedPct = raw.lp_holders.filter(h => h.is_locked === 1).reduce((s, h) => s + parseFloat(h.percent || '0') * 100, 0);
    if (lockedPct < 80 && raw.lp_total_supply && parseFloat(raw.lp_total_supply) > 0) flagIds.push('lp-not-locked');
  } else if (raw.dex?.length) {
    flagIds.push('lp-lock-unknown');
  }

  const flags = flagIds.map(resolveFlag);
  const riskScore = Math.min(flags.reduce((s, f) => s + (WEIGHTS[f.id] ?? 0), 0), 100);
  const flagSet = new Set(flagIds);

  const taxDetail =
    buyTaxPct > 0 || sellTaxPct > 0
      ? `${buyTaxPct.toFixed(1)}% buy / ${sellTaxPct.toFixed(1)}% sell`
      : flagSet.has('slippage-modifiable') ? 'Can be raised' : 'Appears fixed';

  const heuristics: Heuristic[] = [
    { key: 'honeypot',          label: 'Honeypot',         active: flagSet.has('honeypot'),                                           severity: 'critical', detail: flagSet.has('honeypot') ? 'Honeypot detected' : 'No honeypot detected',                                           why: FLAG_DEFS['honeypot']?.why ?? '' },
    { key: 'unlimited-minting', label: 'Unlimited Minting',active: flagSet.has('mintable'),                                           severity: 'high',     detail: flagSet.has('mintable') ? 'mint() detected' : 'No mint function',                                                 why: FLAG_DEFS['mintable']?.why ?? '' },
    { key: 'trading-lock',      label: 'Trading Lock',     active: flagSet.has('transfer-pausable') || flagSet.has('cannot-buy'),     severity: 'high',     detail: flagSet.has('cannot-buy') ? 'Trading disabled' : flagSet.has('transfer-pausable') ? 'pause() present' : 'None',   why: FLAG_DEFS['transfer-pausable']?.why ?? '' },
    { key: 'blacklist',         label: 'Blacklist',        active: flagSet.has('blacklist-function'),                                  severity: 'medium',   detail: flagSet.has('blacklist-function') ? 'blacklist() present' : 'No blacklist',                                       why: FLAG_DEFS['blacklist-function']?.why ?? '' },
    { key: 'adjustable-taxes',  label: 'Taxes',            active: flagSet.has('slippage-modifiable') || flagSet.has('tax-over-20'), severity: flagSet.has('tax-over-20') ? 'critical' : 'high', detail: taxDetail, why: FLAG_DEFS['slippage-modifiable']?.why ?? '' },
  ];

  return { flags, heuristics, riskScore, buyTaxPct, sellTaxPct, name: raw.token_name ?? null, symbol: raw.token_symbol ?? null, allClear: flags.length === 0 };
}

// ── Solana parser ─────────────────────────────────────────────────────────────

function parseSolanaSecurity(raw: GoPlusSolanaRaw): TokenSecurity {
  const flagIds: string[] = [];
  const hasMintAuth = raw.mint_authority && raw.mint_authority !== '' && raw.mint_authority !== null;
  if (hasMintAuth || f1(raw.is_mintable)) flagIds.push('mint-authority-active');
  if (raw.freeze_authority && raw.freeze_authority !== '' && raw.freeze_authority !== null) flagIds.push('freeze-authority-active');
  if (f1(raw.is_closable))       flagIds.push('closeable-mint');
  if (f1(raw.metadata_mutable))  flagIds.push('mutable-metadata');

  const flags = flagIds.map(resolveFlag);
  const riskScore = Math.min(flags.reduce((s, f) => s + (WEIGHTS[f.id] ?? 0), 0), 100);
  const flagSet = new Set(flagIds);

  const heuristics: Heuristic[] = [
    { key: 'mint-authority',  label: 'Mint Authority',   active: flagSet.has('mint-authority-active'),   severity: 'critical', detail: flagSet.has('mint-authority-active')   ? 'Active' : 'Revoked',          why: FLAG_DEFS['mint-authority-active']?.why ?? '' },
    { key: 'freeze-authority',label: 'Freeze Authority', active: flagSet.has('freeze-authority-active'), severity: 'high',     detail: flagSet.has('freeze-authority-active') ? 'Active' : 'Not present',      why: FLAG_DEFS['freeze-authority-active']?.why ?? '' },
    { key: 'mutable-metadata',label: 'Mutable Metadata', active: flagSet.has('mutable-metadata'),        severity: 'medium',   detail: flagSet.has('mutable-metadata')        ? 'Can be changed' : 'Immutable', why: FLAG_DEFS['mutable-metadata']?.why ?? '' },
    { key: 'closeable-mint',  label: 'Closeable Mint',   active: flagSet.has('closeable-mint'),          severity: 'high',     detail: flagSet.has('closeable-mint')          ? 'Closeable' : 'Permanent',      why: FLAG_DEFS['closeable-mint']?.why ?? '' },
  ];

  return { flags, heuristics, riskScore, buyTaxPct: 0, sellTaxPct: 0, name: raw.token_name ?? null, symbol: raw.token_symbol ?? null, allClear: flags.length === 0 };
}

// ── GoPlus fetchers ───────────────────────────────────────────────────────────

async function fetchEvmSecurity(chainId: number, address: string): Promise<TokenSecurity> {
  const res = await fetch(
    `https://api.gopluslabs.io/api/v1/token_security/${chainId}?contract_addresses=${address.toLowerCase()}`,
    { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(15_000) },
  );
  if (!res.ok) throw new Error(`GoPlus ${res.status}`);
  const json = await res.json() as { code: number; result: Record<string, GoPlusEVMRaw> };
  if (json.code !== 1) throw new Error(`GoPlus code ${json.code}`);
  const raw = json.result[address.toLowerCase()];
  if (!raw) throw new Error('No data returned from GoPlus');
  return parseEvmSecurity(raw);
}

async function fetchSolanaSecurity(address: string): Promise<TokenSecurity> {
  const res = await fetch(
    `https://api.gopluslabs.io/api/v1/solana/token_security?contract_addresses=${address}`,
    { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(15_000) },
  );
  if (!res.ok) throw new Error(`GoPlus ${res.status}`);
  const json = await res.json() as { code: number; result: Record<string, GoPlusSolanaRaw> };
  if (json.code !== 1) throw new Error(`GoPlus code ${json.code}`);
  const raw = json.result[address] ?? json.result[address.toLowerCase()];
  if (!raw) throw new Error('No data returned from GoPlus');
  return parseSolanaSecurity(raw);
}

async function fetchSecurity(chain: string, address: string): Promise<TokenSecurity> {
  const cfg = getChainConfig(chain);
  if (!cfg) throw new Error(`Unsupported chain: ${chain}`);
  if (cfg.family === 'solana') return fetchSolanaSecurity(address);
  if (cfg.family === 'evm' && cfg.goplusId) return fetchEvmSecurity(cfg.goplusId, address);
  throw new Error(`GoPlus security data not available for ${chain}`);
}

// ── Chain options ──────────────────────────────────────────────────────────────

const CHAIN_OPTIONS = [
  { value: 'base',     label: 'Base' },
  { value: 'ethereum', label: 'Ethereum' },
  { value: 'bsc',      label: 'BNB Chain' },
  { value: 'polygon',  label: 'Polygon' },
  { value: 'arbitrum', label: 'Arbitrum' },
  { value: 'optimism', label: 'Optimism' },
  { value: 'avalanche',label: 'Avalanche' },
  { value: 'solana',   label: 'Solana' },
];

// ── Severity styles ────────────────────────────────────────────────────────────

const SEV_CONFIG = {
  critical: { dot: 'bg-red-400',    text: 'text-red-400',    bg: 'bg-red-500/15',    border: 'border-red-500/30'    },
  high:     { dot: 'bg-orange-400', text: 'text-orange-400', bg: 'bg-orange-500/15', border: 'border-orange-500/30' },
  medium:   { dot: 'bg-yellow-400', text: 'text-yellow-400', bg: 'bg-yellow-500/15', border: 'border-yellow-500/30' },
  low:      { dot: 'bg-blue-400',   text: 'text-blue-400',   bg: 'bg-blue-500/15',   border: 'border-blue-500/30'   },
};

// ── Token slot (one side of the comparison) ────────────────────────────────────

interface Slot {
  address: string;
  chain: string;
}

type SlotState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ok'; data: TokenSecurity }
  | { status: 'error'; message: string };

// ── Score colour ──────────────────────────────────────────────────────────────

function scoreColor(score: number): string {
  if (score >= 60) return 'text-red-400';
  if (score >= 30) return 'text-orange-400';
  if (score >= 10) return 'text-yellow-400';
  return 'text-green-400';
}

function scoreBarColor(score: number): string {
  if (score >= 60) return 'bg-red-500';
  if (score >= 30) return 'bg-orange-500';
  if (score >= 10) return 'bg-yellow-500';
  return 'bg-green-500';
}

function scoreLabel(score: number): string {
  if (score >= 60) return 'Critical';
  if (score >= 30) return 'High';
  if (score >= 10) return 'Medium';
  return 'Low';
}

// ── Column card ───────────────────────────────────────────────────────────────

function TokenColumn({
  slot,
  state,
  label,
  isWinner,
}: {
  slot: Slot;
  state: SlotState;
  label: string;
  isWinner: boolean;
}) {
  return (
    <div className={`flex-1 min-w-0 rounded-xl border ${isWinner ? 'border-green-500/40 bg-green-500/5' : 'border-gray-700 bg-gray-900'} p-5 space-y-5`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</span>
        {isWinner && (
          <span className="flex items-center gap-1 text-xs font-semibold text-green-400 bg-green-500/15 px-2 py-0.5 rounded-full border border-green-500/30">
            <CheckCircle className="h-3 w-3" /> Safer
          </span>
        )}
      </div>

      {/* Token identity */}
      {state.status === 'ok' && (
        <div>
          <p className="text-lg font-bold text-white truncate">
            {state.data.name ?? 'Unknown Token'}
            {state.data.symbol && <span className="text-gray-400 font-normal text-sm ml-2">{state.data.symbol}</span>}
          </p>
          <p className="text-xs text-gray-500 font-mono truncate mt-0.5">{slot.address}</p>
        </div>
      )}
      {state.status !== 'ok' && (
        <div>
          <p className="text-xs text-gray-500 font-mono truncate">{slot.address || '—'}</p>
        </div>
      )}

      {/* Loading */}
      {state.status === 'loading' && (
        <div className="flex items-center gap-2 text-gray-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Fetching security data…</span>
        </div>
      )}

      {/* Error */}
      {state.status === 'error' && (
        <div className="flex items-center gap-2 text-red-400">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          <span className="text-sm">{state.message}</span>
        </div>
      )}

      {/* Results */}
      {state.status === 'ok' && (() => {
        const { data } = state;
        return (
          <div className="space-y-4">
            {/* Risk score */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-gray-500">Risk Score</span>
                <span className={`text-sm font-bold ${scoreColor(data.riskScore)}`}>
                  {data.riskScore}/100 — {scoreLabel(data.riskScore)}
                </span>
              </div>
              <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${scoreBarColor(data.riskScore)}`} style={{ width: `${data.riskScore}%` }} />
              </div>
            </div>

            {/* Taxes */}
            {(data.buyTaxPct > 0 || data.sellTaxPct > 0) && (
              <div className="flex gap-3">
                <div className="flex-1 bg-gray-800 rounded-lg p-2.5">
                  <p className="text-xs text-gray-500 mb-0.5">Buy Tax</p>
                  <p className={`text-sm font-bold ${data.buyTaxPct > 20 ? 'text-red-400' : data.buyTaxPct > 5 ? 'text-yellow-400' : 'text-green-400'}`}>
                    {data.buyTaxPct.toFixed(1)}%
                  </p>
                </div>
                <div className="flex-1 bg-gray-800 rounded-lg p-2.5">
                  <p className="text-xs text-gray-500 mb-0.5">Sell Tax</p>
                  <p className={`text-sm font-bold ${data.sellTaxPct > 20 ? 'text-red-400' : data.sellTaxPct > 5 ? 'text-yellow-400' : 'text-green-400'}`}>
                    {data.sellTaxPct.toFixed(1)}%
                  </p>
                </div>
              </div>
            )}

            {/* Heuristics grid */}
            <div className="space-y-1.5">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Key Indicators</p>
              {data.heuristics.map(h => {
                const cfg = SEV_CONFIG[h.severity];
                return (
                  <div
                    key={h.key}
                    className={`flex items-center justify-between rounded-lg border px-2.5 py-2 ${
                      h.active ? `${cfg.bg} ${cfg.border}` : 'bg-gray-800/50 border-gray-700'
                    }`}
                    title={h.why}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${h.active ? cfg.dot : 'bg-green-500'}`} />
                      <span className={`text-xs font-medium truncate ${h.active ? cfg.text : 'text-green-400'}`}>
                        {h.label}
                      </span>
                    </div>
                    <span className={`text-xs flex-shrink-0 ml-2 ${h.active ? cfg.text : 'text-gray-500'}`}>
                      {h.detail}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Flag list */}
            {data.flags.length > 0 ? (
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-1.5">
                  Flags ({data.flags.length})
                </p>
                <div className="space-y-1">
                  {data.flags.map(flag => {
                    const cfg = SEV_CONFIG[flag.severity];
                    return (
                      <div key={flag.id} className={`flex items-center gap-2 rounded px-2 py-1 ${cfg.bg} border ${cfg.border}`} title={flag.why}>
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
                        <span className={`text-xs font-medium ${cfg.text} truncate`}>{flag.name}</span>
                        <span className={`ml-auto text-[10px] font-bold uppercase ${cfg.text}`}>{flag.severity.slice(0, 4)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-green-400 text-sm">
                <CheckCircle className="h-4 w-4" />
                <span>No flags detected</span>
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function ComparePage() {
  const [slots, setSlots] = useState<[Slot, Slot]>([
    { address: '', chain: 'base' },
    { address: '', chain: 'base' },
  ]);
  const [states, setStates] = useState<[SlotState, SlotState]>([
    { status: 'idle' },
    { status: 'idle' },
  ]);

  function updateSlot(idx: 0 | 1, update: Partial<Slot>) {
    setSlots(prev => {
      const next = [...prev] as [Slot, Slot];
      next[idx] = { ...prev[idx], ...update };
      return next;
    });
  }

  async function handleCompare(e: React.FormEvent) {
    e.preventDefault();
    const [a, b] = slots;
    if (!a.address.trim() || !b.address.trim()) return;

    setStates([{ status: 'loading' }, { status: 'loading' }]);

    const results = await Promise.allSettled([
      fetchSecurity(a.chain, a.address.trim()),
      fetchSecurity(b.chain, b.address.trim()),
    ]);

    setStates(
      results.map(r =>
        r.status === 'fulfilled'
          ? { status: 'ok', data: r.value }
          : { status: 'error', message: (r as PromiseRejectedResult).reason?.message ?? 'Failed' },
      ) as [SlotState, SlotState],
    );
  }

  const bothOk = states[0].status === 'ok' && states[1].status === 'ok';
  const winnerIdx: 0 | 1 | null =
    bothOk
      ? (states[0] as { status: 'ok'; data: TokenSecurity }).data.riskScore <
        (states[1] as { status: 'ok'; data: TokenSecurity }).data.riskScore
        ? 0
        : (states[0] as { status: 'ok'; data: TokenSecurity }).data.riskScore >
          (states[1] as { status: 'ok'; data: TokenSecurity }).data.riskScore
          ? 1
          : null
      : null;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <GitCompare className="h-7 w-7 text-blue-400" />
          <h1 className="text-2xl font-bold text-white">Compare Projects</h1>
        </div>
        <p className="text-gray-400 text-sm">
          Side-by-side security comparison of two tokens. Paste a contract address for each and we'll run a full GoPlus security analysis on both simultaneously.
        </p>
      </div>

      {/* Input form */}
      <form onSubmit={handleCompare} className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {([0, 1] as const).map(idx => (
            <div key={idx} className="space-y-2">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                Token {idx + 1}
              </label>
              <select
                value={slots[idx].chain}
                onChange={e => updateSlot(idx, { chain: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-yellow-500"
              >
                {CHAIN_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <input
                type="text"
                placeholder={`Contract address ${idx + 1}…`}
                value={slots[idx].address}
                onChange={e => updateSlot(idx, { address: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-yellow-500 font-mono"
              />
            </div>
          ))}
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button
            type="submit"
            disabled={!slots[0].address.trim() || !slots[1].address.trim() || states.some(s => s.status === 'loading')}
            className="px-6 py-2.5 rounded-lg font-semibold text-sm bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white transition-colors flex items-center gap-2"
          >
            {states.some(s => s.status === 'loading')
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Comparing…</>
              : <><GitCompare className="h-4 w-4" /> Compare</>
            }
          </button>
          <p className="text-xs text-gray-600 flex items-center gap-1.5">
            <Info className="h-3 w-3" />
            Data from GoPlus Security — supports EVM chains &amp; Solana
          </p>
        </div>
      </form>

      {/* Verdict banner */}
      {bothOk && (
        <div className={`mb-5 rounded-xl border p-4 flex items-center gap-3 ${
          winnerIdx !== null
            ? 'bg-green-500/10 border-green-500/30'
            : 'bg-gray-800 border-gray-700'
        }`}>
          {winnerIdx !== null ? (
            <>
              <Shield className="h-5 w-5 text-green-400 flex-shrink-0" />
              <p className="text-sm text-green-400">
                <strong>Token {winnerIdx + 1}</strong>
                {states[winnerIdx].status === 'ok' && (states[winnerIdx] as { status: 'ok'; data: TokenSecurity }).data.symbol
                  ? ` (${(states[winnerIdx] as { status: 'ok'; data: TokenSecurity }).data.symbol})`
                  : ''
                }
                {' '}has a lower risk score and appears safer based on on-chain security signals.
              </p>
            </>
          ) : (
            <>
              <ShieldAlert className="h-5 w-5 text-yellow-400 flex-shrink-0" />
              <p className="text-sm text-yellow-400">Both tokens have the same risk score — review the flags carefully.</p>
            </>
          )}
        </div>
      )}

      {/* Comparison columns */}
      {(states.some(s => s.status !== 'idle')) ? (
        <div className="flex flex-col md:flex-row gap-4">
          {([0, 1] as const).map(idx => (
            <TokenColumn
              key={idx}
              slot={slots[idx]}
              state={states[idx]}
              label={`Token ${idx + 1}`}
              isWinner={winnerIdx === idx}
            />
          ))}
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-10 text-center">
          <GitCompare className="h-12 w-12 text-gray-700 mx-auto mb-3" />
          <p className="text-gray-500 text-sm mb-1">Enter two token addresses above to compare them side by side</p>
          <p className="text-gray-600 text-xs">Honeypot detection, taxes, ownership, LP locks, and more</p>
        </div>
      )}
    </div>
  );
}
