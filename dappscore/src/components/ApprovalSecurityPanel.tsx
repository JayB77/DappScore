'use client';

import { useEffect, useState } from 'react';
import {
  ShieldX, AlertTriangle, CheckCircle, Loader2, HelpCircle,
  ExternalLink, Info, ChevronDown, ChevronUp,
} from 'lucide-react';
import { useFeatureFlag } from '@/lib/featureFlags';
import { getChainConfig } from '@/lib/chainAdapters';

// ── Types ─────────────────────────────────────────────────────────────────────

interface GoPlusApprovalRaw {
  is_open_source?:     '0' | '1';
  malicious_behavior?: string[];
  doubt_list?:         '0' | '1';
  blacklist_doubt?:    '0' | '1';
  contract_name?:      string;
}

interface AbiItem {
  type:    string;
  name?:   string;
}

type RiskLevel = 'critical' | 'high' | 'medium' | 'low' | 'safe';

interface ApprovalFlag {
  id:       string;
  label:    string;
  why:      string;
  severity: RiskLevel;
}

interface ApprovalSecurity {
  riskLevel:          RiskLevel;
  isOpenSource:       boolean;
  contractName:       string | null;
  maliciousBehaviors: string[];
  flags:              ApprovalFlag[];
}

type State =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ok'; data: ApprovalSecurity }
  | { status: 'error' }
  | { status: 'unsupported' };

interface ContractAddress {
  chain:   string;
  address: string;
}

// ── Dangerous ABI functions ───────────────────────────────────────────────────

interface DangerFnDef {
  label:    string;
  severity: RiskLevel;
  why:      string;
}

/**
 * Functions whose presence in a contract ABI raises approval-exploit concerns.
 * Keyed by exact Solidity function name (case-sensitive).
 */
const DANGEROUS_FUNCTIONS: Record<string, DangerFnDef> = {
  permit: {
    label:    'permit()',
    severity: 'medium',
    why:
      'EIP-2612 gasless approval. Scam UIs can trick users into signing a permit ' +
      'message that hands the contract unlimited transfer rights — no wallet ' +
      'confirmation is required for the subsequent drain call.',
  },
  setApprovalForAll: {
    label:    'setApprovalForAll()',
    severity: 'high',
    why:
      'Grants an operator approval over every token or NFT in a collection at once. ' +
      'A single phished setApprovalForAll() call lets the contract drain all assets ' +
      'without any further interaction.',
  },
  permitTransferFrom: {
    label:    'permitTransferFrom()',
    severity: 'medium',
    why:
      'Permit2-style signature transfer. Bypasses the normal approval step — a ' +
      'signed off-chain message is all that is needed, making it a high-value ' +
      'target for phishing attacks.',
  },
  drain: {
    label:    'drain()',
    severity: 'critical',
    why:
      'Explicitly named drain function with no legitimate use in a standard token ' +
      'or DeFi contract. Presence is a strong wallet drainer signal.',
  },
  drainToken: {
    label:    'drainToken()',
    severity: 'critical',
    why:
      'Token drain function explicitly named as such. This naming pattern is ' +
      'characteristic of wallet drainer contracts deployed on multiple chains.',
  },
  drainAll: {
    label:    'drainAll()',
    severity: 'critical',
    why:
      'Drains all token balances in a single call. Extremely high risk — ' +
      'almost exclusively found in wallet drainer contracts.',
  },
  sweepToken: {
    label:    'sweepToken()',
    severity: 'medium',
    why:
      'Transfers all of a given token from the contract to an address. Legitimate ' +
      'in AMM routers (e.g. Uniswap) but also used in drainer contracts to ' +
      'pull tokens that users have pre-approved.',
  },
};

// ── GoPlus Approval Security fetcher ─────────────────────────────────────────

async function fetchGoPlusApproval(
  chainIdOrSlug: number | string,
  address:       string,
): Promise<GoPlusApprovalRaw> {
  const res = await fetch(
    `https://api.gopluslabs.io/api/v1/approval_security/${chainIdOrSlug}?contract_addresses=${address.toLowerCase()}`,
    { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(15_000) },
  );
  if (!res.ok) throw new Error(`GoPlus ${res.status}`);
  const json = await res.json() as { code: number; result: Record<string, GoPlusApprovalRaw> };
  if (json.code !== 1) throw new Error(`GoPlus code ${json.code}`);
  const raw = json.result[address.toLowerCase()] ?? json.result[address];
  if (!raw) throw new Error('no data');
  return raw;
}

// ── ABI function-name scanner ─────────────────────────────────────────────────

async function fetchAbiNames(apiBase: string, address: string): Promise<string[]> {
  try {
    const res = await fetch(
      `${apiBase}?module=contract&action=getabi&address=${address}`,
      { signal: AbortSignal.timeout(8_000) },
    );
    const data = await res.json() as { status: string; result: string };
    if (data.status !== '1' || !data.result || data.result === 'Contract source code not verified') {
      return [];
    }
    const abi = JSON.parse(data.result) as AbiItem[];
    return abi.filter(item => item.type === 'function' && typeof item.name === 'string').map(item => item.name!);
  } catch {
    return [];
  }
}

// ── Risk builder ──────────────────────────────────────────────────────────────

function buildApprovalSecurity(
  raw:      GoPlusApprovalRaw,
  abiNames: string[],
): ApprovalSecurity {
  const flags: ApprovalFlag[] = [];

  // ── GoPlus signals ────────────────────────────────────────────────────────
  if (raw.blacklist_doubt === '1') {
    flags.push({
      id: 'blacklisted', label: 'Blacklisted', severity: 'critical',
      why: 'GoPlus has this contract on its drainer blacklist based on on-chain ' +
           'analysis and community reports.',
    });
  }
  if (raw.doubt_list === '1') {
    flags.push({
      id: 'doubt-listed', label: 'On Doubt List', severity: 'high',
      why: 'GoPlus has flagged this contract as suspicious. Exercise extreme ' +
           'caution before approving any tokens.',
    });
  }
  for (const behavior of raw.malicious_behavior ?? []) {
    flags.push({
      id: `malicious-${behavior}`, label: behavior, severity: 'critical',
      why: 'GoPlus detected this specific malicious behavior pattern through ' +
           'automated on-chain analysis.',
    });
  }
  if (raw.is_open_source === '0') {
    flags.push({
      id: 'closed-source', label: 'Closed Source', severity: 'low',
      why: 'Contract bytecode is not verified on the block explorer. It is ' +
           'impossible to audit what the contract actually does with token approvals.',
    });
  }

  // ── ABI signals ───────────────────────────────────────────────────────────
  const abiSet = new Set(abiNames.map(n => n.toLowerCase()));
  for (const [fnName, def] of Object.entries(DANGEROUS_FUNCTIONS)) {
    if (abiSet.has(fnName.toLowerCase())) {
      flags.push({ id: fnName, label: def.label, severity: def.severity, why: def.why });
    }
  }

  // ── Risk level ────────────────────────────────────────────────────────────
  const severities = flags.map(f => f.severity);
  let riskLevel: RiskLevel;
  if (severities.includes('critical')) {
    riskLevel = 'critical';
  } else if (severities.includes('high')) {
    riskLevel = 'high';
  } else if (severities.includes('medium')) {
    // Closed source + any risky approval function → upgrade from medium to high
    const closedSource = flags.some(f => f.id === 'closed-source');
    const hasRiskyFn   = flags.some(f => f.severity === 'medium' && f.id !== 'closed-source');
    riskLevel = closedSource && hasRiskyFn ? 'high' : 'medium';
  } else if (severities.includes('low')) {
    riskLevel = 'low';
  } else {
    riskLevel = 'safe';
  }

  return {
    riskLevel,
    isOpenSource:       raw.is_open_source === '1',
    contractName:       raw.contract_name ?? null,
    maliciousBehaviors: raw.malicious_behavior ?? [],
    flags,
  };
}

// ── Combined fetcher ──────────────────────────────────────────────────────────

async function fetchApprovalSecurity(
  chainIdOrSlug: number | string,
  apiBase:       string | undefined,
  address:       string,
): Promise<ApprovalSecurity> {
  const [raw, abiNames] = await Promise.all([
    fetchGoPlusApproval(chainIdOrSlug, address),
    apiBase ? fetchAbiNames(apiBase, address) : Promise.resolve([]),
  ]);
  return buildApprovalSecurity(raw, abiNames);
}

// ── Risk style map ────────────────────────────────────────────────────────────

const RISK_STYLES: Record<RiskLevel, {
  border:  string;
  bg:      string;
  text:    string;
  badge:   string;
  badgeBg: string;
  label:   string;
}> = {
  critical: { border: 'border-red-500/40',    bg: 'bg-red-500/5',    text: 'text-red-400',    badge: 'text-red-400',    badgeBg: 'bg-red-500/20',    label: 'DRAINER DETECTED'  },
  high:     { border: 'border-orange-500/40', bg: 'bg-orange-500/5', text: 'text-orange-400', badge: 'text-orange-400', badgeBg: 'bg-orange-500/20', label: 'HIGH RISK'         },
  medium:   { border: 'border-yellow-500/30', bg: 'bg-yellow-500/5', text: 'text-yellow-400', badge: 'text-yellow-400', badgeBg: 'bg-yellow-500/20', label: 'CAUTION'           },
  low:      { border: 'border-gray-600',      bg: '',                text: 'text-gray-400',   badge: 'text-gray-400',   badgeBg: 'bg-gray-700',      label: 'LOW RISK'          },
  safe:     { border: 'border-green-500/20',  bg: 'bg-green-500/5',  text: 'text-green-400',  badge: 'text-green-400',  badgeBg: 'bg-green-500/20',  label: 'NO KNOWN ISSUES'   },
};

const FLAG_SEVERITY_COLOR: Record<RiskLevel, string> = {
  critical: 'bg-red-500/20 text-red-400',
  high:     'bg-orange-500/20 text-orange-400',
  medium:   'bg-yellow-500/20 text-yellow-400',
  low:      'bg-gray-700 text-gray-400',
  safe:     'bg-green-500/20 text-green-400',
};

// ── Inline tooltip ────────────────────────────────────────────────────────────

function FlagPill({ flag }: { flag: ApprovalFlag }) {
  const [open, setOpen] = useState(false);
  const color = FLAG_SEVERITY_COLOR[flag.severity];
  return (
    <span className="relative">
      <button
        onClick={() => setOpen(p => !p)}
        className={`inline-flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded cursor-pointer ${color}`}
      >
        {flag.label}
        <Info className="h-2.5 w-2.5 opacity-60" />
      </button>
      {open && (
        <span className="absolute z-50 bottom-full left-0 mb-1.5 w-60 bg-gray-900 border border-gray-700 rounded-lg p-2 text-xs text-gray-300 shadow-xl leading-relaxed">
          {flag.why}
        </span>
      )}
    </span>
  );
}

// ── Per-address row ───────────────────────────────────────────────────────────

function ContractRow({ chain, address }: ContractAddress) {
  const [state, setState]   = useState<State>({ status: 'idle' });
  const [expanded, setExpanded] = useState(false);

  const config  = getChainConfig(chain);
  const chainId = config?.goplusId;
  const isTron  = config?.family === 'tron';

  useEffect(() => {
    if (!config || (!chainId && !isTron)) {
      setState({ status: 'unsupported' });
      return;
    }
    setState({ status: 'loading' });
    const slug = isTron ? 'tron' : chainId!;
    fetchApprovalSecurity(slug, config.apiBase, address)
      .then(data => setState({ status: 'ok', data }))
      .catch(() => setState({ status: 'error' }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, chain]);

  const explorerUrl = config
    ? isTron
      ? `${config.explorerBase}/#/contract/${address}`
      : `${config.explorerBase}/address/${address}`
    : null;

  const borderClass =
    state.status === 'ok'
      ? `${RISK_STYLES[state.data.riskLevel].border} ${RISK_STYLES[state.data.riskLevel].bg}`
      : 'border-gray-700';

  return (
    <div className={`border rounded-lg p-3 space-y-2 ${borderClass}`}>

      {/* Chain / address header */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{chain}</span>
        {explorerUrl ? (
          <a
            href={explorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center space-x-1 text-xs text-blue-400 hover:text-blue-300 font-mono transition-colors"
          >
            <span>{address.slice(0, 6)}…{address.slice(-4)}</span>
            <ExternalLink className="h-3 w-3" />
          </a>
        ) : (
          <span className="text-xs font-mono text-gray-500">{address.slice(0, 6)}…{address.slice(-4)}</span>
        )}
      </div>

      {/* Loading */}
      {state.status === 'loading' && (
        <div className="flex items-center space-x-1.5 text-gray-500 text-sm">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          <span>Scanning approval risk…</span>
        </div>
      )}

      {/* Unsupported */}
      {state.status === 'unsupported' && (
        <div className="flex items-center space-x-1.5 text-gray-500 text-xs">
          <HelpCircle className="h-3.5 w-3.5" />
          <span>EVM chains only (Ethereum, BSC, Polygon, …)</span>
        </div>
      )}

      {/* Error */}
      {state.status === 'error' && (
        <span className="text-xs text-gray-500">Approval scan unavailable</span>
      )}

      {/* Result */}
      {state.status === 'ok' && (() => {
        const { data } = state;
        const s = RISK_STYLES[data.riskLevel];

        // Exclude the closed-source flag from the pill list — it's shown inline
        const pillFlags = data.flags.filter(f => f.id !== 'closed-source');
        const MAX_PILLS = 5;

        return (
          <div className="space-y-2">

            {/* ── Verdict row ── */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                {data.riskLevel === 'critical' ? (
                  <ShieldX       className={`h-4 w-4 flex-shrink-0 ${s.text}`} />
                ) : data.riskLevel === 'high' || data.riskLevel === 'medium' ? (
                  <AlertTriangle className={`h-4 w-4 flex-shrink-0 ${s.text}`} />
                ) : data.riskLevel === 'low' ? (
                  <Info          className={`h-4 w-4 flex-shrink-0 ${s.text}`} />
                ) : (
                  <CheckCircle   className={`h-4 w-4 flex-shrink-0 ${s.text}`} />
                )}
                {data.contractName ? (
                  <span className={`text-sm font-medium ${s.text}`}>{data.contractName}</span>
                ) : (
                  <span className={`text-sm ${data.riskLevel === 'safe' ? 'text-gray-300' : s.text}`}>
                    {data.riskLevel === 'safe'
                      ? 'No known approval exploit patterns'
                      : 'Approval exploit risk detected'}
                  </span>
                )}
              </div>
              <span className={`text-xs px-2 py-0.5 rounded font-bold ${s.badgeBg} ${s.badge}`}>
                {s.label}
              </span>
            </div>

            {/* ── Open / closed source ── */}
            <div className="flex items-center space-x-1.5 text-xs">
              {data.isOpenSource ? (
                <>
                  <CheckCircle className="h-3 w-3 text-green-400 flex-shrink-0" />
                  <span className="text-green-400">Open source — approval logic is auditable</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="h-3 w-3 text-gray-500 flex-shrink-0" />
                  <span className="text-gray-500">Closed source — approval logic cannot be audited</span>
                </>
              )}
            </div>

            {/* ── Malicious behavior prose (critical only) ── */}
            {data.maliciousBehaviors.length > 0 && (
              <div className="space-y-1">
                {data.maliciousBehaviors.map((b, i) => (
                  <p key={i} className="text-xs text-red-300 bg-red-500/10 rounded px-2 py-1">{b}</p>
                ))}
              </div>
            )}

            {/* ── Flag pills ── */}
            {pillFlags.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-0.5">
                {(expanded ? pillFlags : pillFlags.slice(0, MAX_PILLS)).map(flag => (
                  <FlagPill key={flag.id} flag={flag} />
                ))}
                {!expanded && pillFlags.length > MAX_PILLS && (
                  <span className="text-xs text-gray-500 self-center">
                    +{pillFlags.length - MAX_PILLS} more
                  </span>
                )}
              </div>
            )}

            {/* ── Expand toggle ── */}
            {pillFlags.length > MAX_PILLS && (
              <button
                onClick={() => setExpanded(p => !p)}
                className="flex items-center space-x-1 text-xs text-gray-500 hover:text-gray-300 transition-colors"
              >
                {expanded
                  ? <><ChevronUp   className="h-3 w-3" /><span>Show fewer flags</span></>
                  : <><ChevronDown className="h-3 w-3" /><span>Show all {pillFlags.length} flags</span></>}
              </button>
            )}

          </div>
        );
      })()}
    </div>
  );
}

// ── Panel ─────────────────────────────────────────────────────────────────────

interface Props {
  contractAddresses: ContractAddress[];
}

export default function ApprovalSecurityPanel({ contractAddresses }: Props) {
  const enabled = useFeatureFlag('approvalSecurity', false);
  if (!enabled) return null;

  // GoPlus approval_security supports EVM chains (via goplusId) and Tron
  const supported = contractAddresses.filter(({ chain }) => {
    const cfg = getChainConfig(chain);
    return cfg?.family === 'tron' || !!cfg?.goplusId;
  });
  if (supported.length === 0) return null;

  return (
    <div className="bg-gray-800 rounded-xl p-6">
      <div className="flex items-center space-x-2 mb-4">
        <ShieldX className="h-4 w-4 text-gray-400" />
        <h3 className="font-bold text-sm uppercase tracking-wider text-gray-400">Approval Risk</h3>
      </div>

      <div className="space-y-3">
        {supported.map(({ chain, address }) => (
          <ContractRow key={`${chain}:${address}`} chain={chain} address={address} />
        ))}
      </div>

      <p className="text-xs text-gray-600 mt-4">
        GoPlus approval security · ABI function scan via Etherscan · Tap flag pills for details · Not financial advice
      </p>
    </div>
  );
}
