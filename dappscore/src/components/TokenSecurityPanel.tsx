'use client';

import { useEffect, useState } from 'react';
import {
  ShieldAlert, CheckCircle, XCircle, AlertTriangle, Loader2,
  HelpCircle, Info,
} from 'lucide-react';
import { useFeatureFlag } from '@/lib/featureFlags';
import { getChainConfig } from '@/lib/chainAdapters';

// ── Flag catalogue — every possible flag + why it matters ────────────────────

interface FlagDef {
  id:          string;
  name:        string;
  severity:    'critical' | 'high' | 'medium' | 'low';
  /** Short one-line label shown in the badge */
  label:       string;
  /** Full explanation shown in the tooltip / info panel */
  why:         string;
}

const FLAG_DEFS: Record<string, FlagDef> = {
  honeypot: {
    id: 'honeypot', name: 'Honeypot Detected', severity: 'critical',
    label: 'Honeypot',
    why: 'You can buy but cannot sell. Your funds would be permanently trapped in the contract.',
  },
  'cannot-buy': {
    id: 'cannot-buy', name: 'Buying Disabled', severity: 'critical',
    label: 'Buy Disabled',
    why: 'The contract is currently blocking all buy transactions — no one can enter a position.',
  },
  'cannot-sell-all': {
    id: 'cannot-sell-all', name: 'Cannot Sell All Tokens', severity: 'high',
    label: 'Partial Sell Lock',
    why: 'Holders cannot sell their full balance. A portion will always remain stuck in your wallet.',
  },
  'honeypot-creator-history': {
    id: 'honeypot-creator-history', name: 'Creator Deployed Honeypots Before', severity: 'high',
    label: 'Scam Deployer',
    why: 'The wallet that deployed this contract has previously deployed confirmed honeypot tokens.',
  },
  mintable: {
    id: 'mintable', name: 'Unlimited Minting — mint() Present', severity: 'high',
    label: 'Unlimited Mint',
    why: 'The owner can create unlimited new tokens at any time with no supply cap. Your holdings can be diluted to near-zero without warning.',
  },
  'slippage-modifiable': {
    id: 'slippage-modifiable', name: 'Adjustable Taxes — setTax() / setFee() Present', severity: 'high',
    label: 'Tax Adjustable',
    why: 'The owner can raise buy/sell taxes to any value — including 100%. Taxes above 20% make it effectively impossible to profit.',
  },
  'tax-over-20': {
    id: 'tax-over-20', name: 'Tax Currently >20%', severity: 'critical',
    label: 'Tax >20%',
    why: 'Current buy or sell tax already exceeds 20%. At this level, you lose at least 1-in-5 of your funds on every trade.',
  },
  'exclude-from-fee': {
    id: 'exclude-from-fee', name: 'excludeFromFee() Present', severity: 'medium',
    label: 'Fee Exclusion',
    why: 'Specific wallets (typically team/insiders) can be made tax-exempt while regular buyers pay full fees — a structural insider advantage.',
  },
  'transfer-pausable': {
    id: 'transfer-pausable', name: 'Trading Lock — pause() Present', severity: 'high',
    label: 'Trading Lock',
    why: 'The owner can disable all trading at any time. Once paused, nobody can buy, sell, or move tokens until the owner re-enables it.',
  },
  'blacklist-function': {
    id: 'blacklist-function', name: 'Blacklist — Owner Can Block Wallets', severity: 'medium',
    label: 'Blacklist',
    why: 'The owner can blacklist any wallet address, permanently blocking that address from buying or selling the token.',
  },
  'hidden-owner': {
    id: 'hidden-owner', name: 'Hidden Owner', severity: 'critical',
    label: 'Hidden Owner',
    why: 'A concealed owner address retains full admin control even after the visible ownership appears to be renounced.',
  },
  'owner-can-change-balance': {
    id: 'owner-can-change-balance', name: 'Owner Can Modify Balances', severity: 'critical',
    label: 'Balance Manipulation',
    why: 'The owner can directly set any wallet\'s token balance to any value — including zero — without a transaction from that wallet.',
  },
  'ownership-not-renounced': {
    id: 'ownership-not-renounced', name: 'Ownership Not Renounced', severity: 'medium',
    label: 'Active Owner',
    why: 'An active owner can invoke any privileged function at any time. Renounced contracts have no admin key and cannot be modified.',
  },
  'unverified-contract': {
    id: 'unverified-contract', name: 'Unverified Contract', severity: 'high',
    label: 'Unverified',
    why: 'Source code is not publicly verified. Malicious logic could be hidden inside the bytecode with no way to audit it.',
  },
  'proxy-contract': {
    id: 'proxy-contract', name: 'Proxy Contract', severity: 'low',
    label: 'Proxy',
    why: 'The contract logic can be upgraded by the owner. Even if today\'s code is safe, it could be silently replaced.',
  },
  'whale-concentration': {
    id: 'whale-concentration', name: 'High Whale Concentration', severity: 'high',
    label: 'Whale Risk',
    why: 'A small number of wallets control a large share of supply. A coordinated dump would collapse the price.',
  },
  'lp-not-locked': {
    id: 'lp-not-locked', name: 'LP Not Locked', severity: 'high',
    label: 'LP Unlocked',
    why: 'Liquidity pool tokens are not locked. The deployer can remove all liquidity at any time (rug pull).',
  },
  'lp-lock-unknown': {
    id: 'lp-lock-unknown', name: 'LP Lock Status Unknown', severity: 'medium',
    label: 'LP Unknown',
    why: 'Liquidity exists on a DEX but LP lock status cannot be confirmed. Unlocked LP is a rug pull risk.',
  },
  'trading-cooldown': {
    id: 'trading-cooldown', name: 'Trading Cooldown', severity: 'low',
    label: 'Cooldown',
    why: 'A delay is enforced between consecutive trades from the same wallet.',
  },
  // ── Solana-specific flags ─────────────────────────────────────────────────
  'mint-authority-active': {
    id: 'mint-authority-active', name: 'Mint Authority Active', severity: 'critical',
    label: 'Mint Active',
    why: 'The mint authority can create unlimited new tokens at any time, instantly diluting all holders to near-zero.',
  },
  'freeze-authority-active': {
    id: 'freeze-authority-active', name: 'Freeze Authority Active', severity: 'high',
    label: 'Freeze Risk',
    why: 'The freeze authority can lock any token account without the holder\'s consent, permanently blocking transfers.',
  },
  'mutable-metadata': {
    id: 'mutable-metadata', name: 'Mutable Token Metadata', severity: 'medium',
    label: 'Mutable Meta',
    why: 'The token name, symbol, and image URI can be changed by the authority at any time — common in post-pump rug pulls.',
  },
  'closeable-mint': {
    id: 'closeable-mint', name: 'Mint Account Closeable', severity: 'high',
    label: 'Closeable Mint',
    why: 'The mint account can be destroyed by the authority, effectively wiping the token supply.',
  },
};

// ── GoPlus raw response (subset needed here) ──────────────────────────────────

interface GoPlusTokenRaw {
  is_honeypot?:               '0' | '1';
  honeypot_with_same_creator?:'0' | '1';
  cannot_buy?:                '0' | '1';
  cannot_sell_all?:           '0' | '1';
  is_mintable?:               '0' | '1';
  can_be_minted?:             '0' | '1';
  slippage_modifiable?:       '0' | '1';
  personal_slippage_modifiable?: '0' | '1';
  transfer_pausable?:         '0' | '1';
  is_blacklisted?:            '0' | '1';
  hidden_owner?:              '0' | '1';
  owner_change_balance?:      '0' | '1';
  is_contract_renounced?:     '0' | '1';
  owner_address?:             string;
  is_open_source?:            '0' | '1';
  is_proxy?:                  '0' | '1';
  trading_cooldown?:          '0' | '1';
  buy_tax?:                   string;  // GoPlus returns decimal, e.g. "0.05" = 5%
  sell_tax?:                  string;
  total_supply?:              string;
  holders?: Array<{ percent: string }>;
  lp_holders?: Array<{ percent: string; is_locked: number }>;
  lp_total_supply?: string;
  dex?: Array<{ name: string }>;
  token_name?:   string;
  token_symbol?: string;
}

interface Heuristic {
  key:      string;
  label:    string;
  active:   boolean;
  severity: 'critical' | 'high' | 'medium';
  detail:   string;  // short note shown inline (e.g. "5% buy / 10% sell")
  why:      string;  // full tooltip explanation
}

interface ParsedFlag {
  id:          string;
  severity:    'critical' | 'high' | 'medium' | 'low';
  name:        string;
  label:       string;
  why:         string;
}

interface TokenSecurity {
  flags:      ParsedFlag[];
  heuristics: Heuristic[];
  riskScore:  number;     // 0–100
  name:       string | null;
  symbol:     string | null;
  allClear:   boolean;
}

// ── Parser ───────────────────────────────────────────────────────────────────

function f1(v?: '0' | '1'): boolean { return v === '1'; }

function resolveFlag(id: string, extra?: Partial<FlagDef>): ParsedFlag {
  const def = FLAG_DEFS[id];
  return {
    id,
    severity: extra?.severity ?? def?.severity ?? 'medium',
    name:     extra?.name     ?? def?.name     ?? id,
    label:    extra?.label    ?? def?.label    ?? id,
    why:      extra?.why      ?? def?.why      ?? '',
  };
}

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
  // Solana
  'mint-authority-active': 50, 'freeze-authority-active': 25,
  'mutable-metadata': 10, 'closeable-mint': 20,
};

function parseTokenSecurity(raw: GoPlusTokenRaw): TokenSecurity {
  const flagIds: string[] = [];

  if (f1(raw.is_honeypot))               flagIds.push('honeypot');
  if (f1(raw.cannot_buy))                flagIds.push('cannot-buy');
  if (f1(raw.cannot_sell_all))           flagIds.push('cannot-sell-all');
  if (f1(raw.honeypot_with_same_creator))flagIds.push('honeypot-creator-history');
  if (f1(raw.is_mintable) || f1(raw.can_be_minted)) flagIds.push('mintable');
  if (f1(raw.slippage_modifiable))       flagIds.push('slippage-modifiable');
  if (f1(raw.personal_slippage_modifiable)) flagIds.push('exclude-from-fee');
  if (f1(raw.transfer_pausable))         flagIds.push('transfer-pausable');
  if (f1(raw.is_blacklisted))            flagIds.push('blacklist-function');
  if (f1(raw.hidden_owner))              flagIds.push('hidden-owner');
  if (f1(raw.owner_change_balance))      flagIds.push('owner-can-change-balance');
  if (!f1(raw.is_open_source))           flagIds.push('unverified-contract');
  if (f1(raw.is_proxy))                  flagIds.push('proxy-contract');
  if (f1(raw.trading_cooldown))          flagIds.push('trading-cooldown');

  // Tax thresholds — GoPlus returns decimal fractions (0.05 = 5%)
  const buyTaxPct  = raw.buy_tax  ? parseFloat(raw.buy_tax)  * 100 : 0;
  const sellTaxPct = raw.sell_tax ? parseFloat(raw.sell_tax) * 100 : 0;
  if (buyTaxPct > 20 || sellTaxPct > 20) flagIds.push('tax-over-20');

  // Ownership
  if (
    !f1(raw.is_contract_renounced) &&
    raw.owner_address &&
    raw.owner_address !== '0x0000000000000000000000000000000000000000'
  ) {
    flagIds.push('ownership-not-renounced');
  }

  // Whale concentration
  if (raw.holders?.length) {
    const top10pct = raw.holders
      .slice(0, 10)
      .reduce((s, h) => s + parseFloat(h.percent || '0') * 100, 0);
    if (top10pct > 50) flagIds.push('whale-concentration');
  }

  // LP lock
  if (raw.lp_holders?.length) {
    const lockedPct = raw.lp_holders
      .filter(h => h.is_locked === 1)
      .reduce((s, h) => s + parseFloat(h.percent || '0') * 100, 0);
    if (lockedPct < 80 && raw.lp_total_supply && parseFloat(raw.lp_total_supply) > 0) {
      flagIds.push('lp-not-locked');
    }
  } else if (raw.dex?.length) {
    flagIds.push('lp-lock-unknown');
  }

  const flags = flagIds.map(id => resolveFlag(id));
  const riskScore = Math.min(
    flags.reduce((s, f) => s + (WEIGHTS[f.id] ?? 0), 0),
    100,
  );

  // ── Heuristic summary (4 key risk categories) ────────────────────────────
  const flagSet = new Set(flagIds);

  const taxDetail =
    buyTaxPct > 0 || sellTaxPct > 0
      ? `Currently ${buyTaxPct.toFixed(1)}% buy / ${sellTaxPct.toFixed(1)}% sell`
      : flagSet.has('slippage-modifiable') ? 'Can be raised to any value' : 'Taxes appear fixed';

  const heuristics: Heuristic[] = [
    {
      key:      'unlimited-minting',
      label:    'Unlimited Minting',
      active:   flagSet.has('mintable'),
      severity: 'high',
      detail:   flagSet.has('mintable') ? 'mint() detected in contract' : 'No mint function detected',
      why:      FLAG_DEFS['mintable'].why,
    },
    {
      key:      'trading-lock',
      label:    'Trading Lock',
      active:   flagSet.has('transfer-pausable') || flagSet.has('cannot-buy'),
      severity: 'high',
      detail:   flagSet.has('cannot-buy')
        ? 'Trading currently disabled'
        : flagSet.has('transfer-pausable')
          ? 'pause() present — can be disabled'
          : 'No trading lock detected',
      why:      FLAG_DEFS['transfer-pausable'].why,
    },
    {
      key:      'blacklist',
      label:    'Blacklist',
      active:   flagSet.has('blacklist-function'),
      severity: 'medium',
      detail:   flagSet.has('blacklist-function') ? 'blacklist() present in contract' : 'No blacklist function detected',
      why:      FLAG_DEFS['blacklist-function'].why,
    },
    {
      key:      'adjustable-taxes',
      label:    'Adjustable Taxes >20%',
      active:   flagSet.has('slippage-modifiable') || flagSet.has('tax-over-20'),
      severity: flagSet.has('tax-over-20') ? 'critical' : 'high',
      detail:   taxDetail,
      why:      flagSet.has('tax-over-20')
        ? FLAG_DEFS['tax-over-20'].why
        : FLAG_DEFS['slippage-modifiable'].why,
    },
  ];

  return {
    flags,
    heuristics,
    riskScore,
    name:     raw.token_name   ?? null,
    symbol:   raw.token_symbol ?? null,
    allClear: flags.length === 0,
  };
}

// ── Solana GoPlus ─────────────────────────────────────────────────────────────

interface GoPlusSolanaRaw {
  mint_authority?:     string | null;
  freeze_authority?:   string | null;
  is_mintable?:        '0' | '1';
  can_freeze_account?: '0' | '1';
  is_closable?:        '0' | '1';
  metadata_mutable?:   '0' | '1';
  token_name?:         string;
  token_symbol?:       string;
}

function parseSolanaTokenSecurity(raw: GoPlusSolanaRaw): TokenSecurity {
  const flagIds: string[] = [];

  const hasMintAuth = raw.mint_authority && raw.mint_authority !== '' && raw.mint_authority !== '0x0000000000000000000000000000000000000000';
  const hasFreezeAuth = raw.freeze_authority && raw.freeze_authority !== '' && raw.freeze_authority !== '0x0000000000000000000000000000000000000000';

  if (hasMintAuth || f1(raw.is_mintable)) flagIds.push('mint-authority-active');
  if (hasFreezeAuth || f1(raw.can_freeze_account)) flagIds.push('freeze-authority-active');
  if (f1(raw.metadata_mutable)) flagIds.push('mutable-metadata');
  if (f1(raw.is_closable)) flagIds.push('closeable-mint');

  const flags = flagIds.map(id => resolveFlag(id));
  const riskScore = Math.min(flags.reduce((s, f) => s + (WEIGHTS[f.id] ?? 0), 0), 100);
  const flagSet = new Set(flagIds);

  const heuristics: Heuristic[] = [
    {
      key:      'mint-authority',
      label:    'Mint Authority',
      active:   flagSet.has('mint-authority-active'),
      severity: 'critical',
      detail:   flagSet.has('mint-authority-active') ? 'Mint authority is active' : 'Mint authority revoked',
      why:      FLAG_DEFS['mint-authority-active'].why,
    },
    {
      key:      'freeze-authority',
      label:    'Freeze Authority',
      active:   flagSet.has('freeze-authority-active'),
      severity: 'high',
      detail:   flagSet.has('freeze-authority-active') ? 'Can freeze accounts' : 'No freeze authority',
      why:      FLAG_DEFS['freeze-authority-active'].why,
    },
    {
      key:      'mutable-metadata',
      label:    'Mutable Metadata',
      active:   flagSet.has('mutable-metadata'),
      severity: 'medium',
      detail:   flagSet.has('mutable-metadata') ? 'Metadata can be changed' : 'Metadata is immutable',
      why:      FLAG_DEFS['mutable-metadata'].why,
    },
    {
      key:      'closeable-mint',
      label:    'Closeable Mint',
      active:   flagSet.has('closeable-mint'),
      severity: 'high',
      detail:   flagSet.has('closeable-mint') ? 'Mint account closeable' : 'Mint account permanent',
      why:      FLAG_DEFS['closeable-mint'].why,
    },
  ];

  return {
    flags, heuristics, riskScore,
    name:     raw.token_name   ?? null,
    symbol:   raw.token_symbol ?? null,
    allClear: flags.length === 0,
  };
}

async function fetchSolanaTokenSecurity(address: string): Promise<TokenSecurity> {
  const res = await fetch(
    `https://api.gopluslabs.io/api/v1/solana/token_security?contract_addresses=${address}`,
    { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(15_000) },
  );
  if (!res.ok) throw new Error(`GoPlus ${res.status}`);
  const json = await res.json() as { code: number; result: Record<string, GoPlusSolanaRaw> };
  if (json.code !== 1) throw new Error(`GoPlus code ${json.code}`);
  const raw = json.result[address] ?? json.result[address.toLowerCase()];
  if (!raw) throw new Error('no data');
  return parseSolanaTokenSecurity(raw);
}

// ── Fetch ────────────────────────────────────────────────────────────────────

async function fetchTokenSecurity(chainId: number, address: string): Promise<TokenSecurity> {
  const res = await fetch(
    `https://api.gopluslabs.io/api/v1/token_security/${chainId}?contract_addresses=${address.toLowerCase()}`,
    { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(15_000) },
  );
  if (!res.ok) throw new Error(`GoPlus ${res.status}`);
  const json = await res.json() as {
    code: number;
    result: Record<string, GoPlusTokenRaw>;
  };
  if (json.code !== 1) throw new Error(`GoPlus code ${json.code}`);
  const raw = json.result[address.toLowerCase()];
  if (!raw) throw new Error('no data');
  return parseTokenSecurity(raw);
}

// ── Severity helpers ──────────────────────────────────────────────────────────

const SEV_CONFIG = {
  critical: { bg: 'bg-red-500/20',    text: 'text-red-400',    border: 'border-red-500/40',    dot: 'bg-red-400',    label: 'CRITICAL' },
  high:     { bg: 'bg-orange-500/20', text: 'text-orange-400', border: 'border-orange-500/40', dot: 'bg-orange-400', label: 'HIGH' },
  medium:   { bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/40', dot: 'bg-yellow-400', label: 'MED' },
  low:      { bg: 'bg-blue-500/20',   text: 'text-blue-400',   border: 'border-blue-500/40',   dot: 'bg-blue-400',   label: 'LOW' },
};

// ── Heuristic summary grid ────────────────────────────────────────────────────

function HeuristicItem({
  h,
  open,
  onToggle,
}: {
  h: Heuristic;
  open: boolean;
  onToggle: () => void;
}) {
  const activeCfg = SEV_CONFIG[h.severity];
  return (
    <div
      className={`rounded-lg border p-2.5 flex flex-col gap-1 transition-colors ${
        h.active
          ? `${activeCfg.bg} ${activeCfg.border}`
          : 'bg-gray-700/30 border-gray-700'
      }`}
    >
      <div className="flex items-center justify-between gap-1.5">
        {/* Status dot + label */}
        <div className="flex items-center gap-1.5 min-w-0">
          <span
            className={`w-2 h-2 rounded-full flex-shrink-0 ${
              h.active ? activeCfg.dot : 'bg-green-500'
            }`}
          />
          <span
            className={`text-xs font-semibold truncate ${
              h.active ? activeCfg.text : 'text-green-400'
            }`}
          >
            {h.label}
          </span>
        </div>

        {/* Info toggle */}
        <button
          onClick={onToggle}
          title={h.why}
          aria-label={open ? 'Hide details' : 'Why is this dangerous?'}
          className={`flex-shrink-0 p-0.5 rounded transition-colors ${
            open ? `${activeCfg.text}` : 'text-gray-600 hover:text-gray-400'
          }`}
        >
          <Info className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Detail note */}
      <span className={`text-xs ${h.active ? activeCfg.text + ' opacity-75' : 'text-gray-500'}`}>
        {h.detail}
      </span>

      {/* Expanded why */}
      {open && (
        <p className={`text-xs leading-relaxed mt-0.5 ${h.active ? activeCfg.text : 'text-gray-400'} opacity-90`}>
          {h.why}
        </p>
      )}
    </div>
  );
}

function HeuristicSummary({
  heuristics,
  openTip,
  onToggle,
}: {
  heuristics: Heuristic[];
  openTip: string | null;
  onToggle: (key: string) => void;
}) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
        Heuristic Flags
      </p>
      <div className="grid grid-cols-2 gap-1.5">
        {heuristics.map(h => (
          <HeuristicItem
            key={h.key}
            h={h}
            open={openTip === `h:${h.key}`}
            onToggle={() => onToggle(`h:${h.key}`)}
          />
        ))}
      </div>
    </div>
  );
}

// ── Flag item with tooltip ────────────────────────────────────────────────────

function FlagItem({
  flag,
  open,
  onToggle,
}: {
  flag: ParsedFlag;
  open: boolean;
  onToggle: () => void;
}) {
  const cfg = SEV_CONFIG[flag.severity];

  return (
    <div className={`rounded-lg border ${cfg.border} ${cfg.bg} p-2.5`}>
      <div className="flex items-center justify-between gap-2">
        {/* Left: dot + name */}
        <div className="flex items-center gap-2 min-w-0">
          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
          <span className={`text-sm font-medium ${cfg.text} truncate`}>{flag.name}</span>
          <span className={`hidden sm:inline-flex text-xs px-1.5 py-0.5 rounded font-bold ${cfg.bg} ${cfg.text} border ${cfg.border} flex-shrink-0`}>
            {cfg.label}
          </span>
        </div>

        {/* Right: info toggle button (hover + tap) */}
        <button
          onClick={onToggle}
          aria-label={open ? 'Hide explanation' : 'Why is this dangerous?'}
          title={flag.why}
          className={`flex-shrink-0 p-1 rounded-md transition-colors ${
            open
              ? `${cfg.bg} ${cfg.text}`
              : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          <Info className="h-4 w-4" />
        </button>
      </div>

      {/* Expanded explanation (tap on mobile, also triggered by info button) */}
      {open && (
        <p className={`mt-2 text-xs leading-relaxed ${cfg.text} opacity-90`}>
          {flag.why}
        </p>
      )}
    </div>
  );
}

// ── Risk score bar ────────────────────────────────────────────────────────────

function RiskBar({ score }: { score: number }) {
  const color =
    score >= 60 ? 'bg-red-500' :
    score >= 30 ? 'bg-orange-500' :
    score >= 10 ? 'bg-yellow-500' :
                  'bg-green-500';
  const label =
    score >= 60 ? 'Critical' :
    score >= 30 ? 'High' :
    score >= 10 ? 'Medium' :
                  'Low';
  const textColor =
    score >= 60 ? 'text-red-400' :
    score >= 30 ? 'text-orange-400' :
    score >= 10 ? 'text-yellow-400' :
                  'text-green-400';

  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center">
        <span className="text-xs text-gray-500">Risk Score</span>
        <span className={`text-sm font-bold ${textColor}`}>{score}/100 — {label}</span>
      </div>
      <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}

// ── Contract row ──────────────────────────────────────────────────────────────

type State =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ok'; data: TokenSecurity }
  | { status: 'error' }
  | { status: 'unsupported' };

interface ContractAddress { chain: string; address: string }

function ContractRow({ chain, address }: ContractAddress) {
  const [state, setState] = useState<State>({ status: 'idle' });
  const [openTip, setOpenTip] = useState<string | null>(null);
  const config   = getChainConfig(chain);
  const isSolana = config?.family === 'solana';
  const chainId  = config?.goplusId;

  useEffect(() => {
    if (!config || (!isSolana && !chainId)) { setState({ status: 'unsupported' }); return; }
    setState({ status: 'loading' });
    (isSolana ? fetchSolanaTokenSecurity(address) : fetchTokenSecurity(chainId!, address))
      .then(data => setState({ status: 'ok', data }))
      .catch(() => setState({ status: 'error' }));
  }, [address, chainId, isSolana, config]);

  const toggleTip = (id: string) =>
    setOpenTip(prev => (prev === id ? null : id));

  return (
    <div className="border border-gray-700 rounded-lg p-3 space-y-3">
      {/* Chain header */}
      <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{chain}</span>

      {state.status === 'loading' && (
        <div className="flex items-center space-x-1.5 text-gray-500 text-sm">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          <span>Scanning contract functions…</span>
        </div>
      )}

      {state.status === 'unsupported' && (
        <div className="flex items-center space-x-1.5 text-gray-500 text-xs">
          <HelpCircle className="h-3.5 w-3.5" />
          <span>Chain not supported by GoPlus</span>
        </div>
      )}

      {state.status === 'error' && (
        <div className="flex items-center space-x-1.5 text-gray-500 text-xs">
          <AlertTriangle className="h-3.5 w-3.5" />
          <span>Unable to scan contract</span>
        </div>
      )}

      {state.status === 'ok' && (
        <>
          <RiskBar score={state.data.riskScore} />

          {/* 4-cell heuristic summary — always shown */}
          <HeuristicSummary
            heuristics={state.data.heuristics}
            openTip={openTip}
            onToggle={toggleTip}
          />

          {/* Detailed flag list */}
          {state.data.allClear ? (
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0" />
              <span className="text-sm text-green-400">No additional flags detected</span>
            </div>
          ) : (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                All Flags
              </p>
              <div className="space-y-1.5">
                {(['critical', 'high', 'medium', 'low'] as const).map(sev => {
                  const group = state.data.flags.filter(f => f.severity === sev);
                  if (!group.length) return null;
                  return group.map(flag => (
                    <FlagItem
                      key={flag.id}
                      flag={flag}
                      open={openTip === flag.id}
                      onToggle={() => toggleTip(flag.id)}
                    />
                  ));
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Panel ─────────────────────────────────────────────────────────────────────

interface Props {
  contractAddresses: ContractAddress[];
}

export default function TokenSecurityPanel({ contractAddresses }: Props) {
  const enabled = useFeatureFlag('tokenSecurity', true);
  if (!enabled) return null;

  const supported = contractAddresses.filter(({ chain }) => {
    const cfg = getChainConfig(chain);
    return cfg?.family === 'solana' || !!cfg?.goplusId;
  });
  if (supported.length === 0) return null;

  return (
    <div className="bg-gray-800 rounded-xl p-6">
      <div className="flex items-center space-x-2 mb-4">
        <ShieldAlert className="h-4 w-4 text-gray-400" />
        <h3 className="font-bold text-sm uppercase tracking-wider text-gray-400">Token Security Scan</h3>
      </div>

      <p className="text-xs text-gray-500 mb-3">
        Tap <Info className="inline h-3 w-3" /> on any flag to see why it&apos;s potentially dangerous.
      </p>

      <div className="space-y-3">
        {supported.map(({ chain, address }) => (
          <ContractRow key={`${chain}:${address}`} chain={chain} address={address} />
        ))}
      </div>

      <p className="text-xs text-gray-600 mt-4">
        Scans:{' '}
        <span className="text-gray-500">
          mint() · setTax() · setFee() · blacklist() · pause() · excludeFromFee() · setTradingEnabled()
        </span>
        {' '}via GoPlus Security · Not financial advice
      </p>
    </div>
  );
}
