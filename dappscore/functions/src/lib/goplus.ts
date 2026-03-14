/**
 * GoPlus Security API client — comprehensive on-chain token security analysis.
 *
 * Covers: honeypot detection, buy/sell tax, fee manipulation, mint functions,
 * ownership risk (hidden owner, renounced, can-change-balance), transfer pause,
 * anti-whale, blacklist/whitelist, LP lock status, top holders concentration,
 * proxy detection, open-source verification, same-creator honeypot history.
 *
 * Free public tier: ~50 req/min (no token needed).
 * Env: GOPLUS_API_TOKEN — optional, increases rate limits via bearer auth.
 *
 * Supported chains: all major EVM chains including Ethereum, BSC, Polygon,
 * Arbitrum, Optimism, Base, Avalanche, Fantom, Celo, zkSync, Linea, Scroll,
 * Polygon zkEVM, Mantle, opBNB, Ronin, Berachain, Monad, HyperEVM, and more.
 */

const BASE_URL = 'https://api.gopluslabs.io/api/v1';

/**
 * Known scam / rug deployer addresses.
 * All entries must be lowercase. Populated as confirmed rugs are indexed on-chain.
 * Export lets other services (e.g. scam-patterns) share the same source of truth.
 */
export const KNOWN_SCAM_DEPLOYERS = new Set<string>([
  // Entries added as confirmed rug pulls are identified on-chain.
  // Format: '0x<40-char-lowercase-hex>'
]);

// Maps our canonical network key → GoPlus chain ID string
const GOPLUS_CHAIN_IDS: Record<string, string> = {
  // ── EVM L1s ──────────────────────────────────────────────────────────────
  mainnet:         '1',
  bsc:             '56',
  avalanche:       '43114',
  fantom:          '250',
  sonic:           '146',
  celo:            '42220',
  gnosis:          '100',
  cronos:          '25',
  kaia:            '8217',
  moonbeam:        '1284',
  moonriver:       '1285',
  kava:            '2222',
  aurora:          '1313161554',
  core:            '1116',
  ronin:           '2020',
  sei:             '1329',
  zetachain:       '7000',
  rootstock:       '30',

  // ── Ethereum L2s / rollups ───────────────────────────────────────────────
  polygon:         '137',
  arbitrum:        '42161',
  optimism:        '10',
  base:            '8453',
  blast:           '81457',
  zksync:          '324',
  linea:           '59144',
  scroll:          '534352',
  polygon_zkevm:   '1101',
  mantle:          '5000',
  mode:            '34443',
  taiko:           '167000',
  fraxtal:         '252',
  manta:           '169',
  metis:           '1088',
  opbnb:           '204',
  unichain:        '1301',
  zora:            '7777777',
  berachain:       '80094',
  world_chain:     '480',
  soneium:         '1868',
  immutable_zkevm: '13371',
  merlin:          '4200',
  bob:             '60808',

  // ── Newer EVM ────────────────────────────────────────────────────────────
  monad:           '41454',
  hyperevm:        '998',
};

export function goplusSupported(network: string): boolean {
  return network in GOPLUS_CHAIN_IDS;
}

function goplusHeaders(): Record<string, string> {
  const token = process.env.GOPLUS_API_TOKEN;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ── Raw API response shape ────────────────────────────────────────────────────

export interface GoPlusRaw {
  // Verification
  is_open_source?:              '0' | '1';
  is_proxy?:                    '0' | '1';
  is_mintable?:                 '0' | '1';
  can_be_minted?:               '0' | '1';

  // Honeypot + trading
  is_honeypot?:                 '0' | '1';
  honeypot_with_same_creator?:  '0' | '1';
  buy_tax?:                     string;   // e.g. "0.05" = 5%
  sell_tax?:                    string;
  slippage_modifiable?:         '0' | '1';
  is_anti_whale?:               '0' | '1';
  anti_whale_modifiable?:       '0' | '1';
  cannot_buy?:                  '0' | '1';
  cannot_sell_all?:             '0' | '1';
  trading_cooldown?:            '0' | '1';

  // Ownership
  owner_address?:               string;
  creator_address?:             string;
  owner_change_balance?:        '0' | '1';
  hidden_owner?:                '0' | '1';
  is_contract_renounced?:       '0' | '1';

  // Transfer controls
  transfer_pausable?:           '0' | '1';
  is_blacklisted?:              '0' | '1';
  is_whitelisted?:              '0' | '1';
  personal_slippage_modifiable?: '0' | '1';

  // Token info
  token_name?:                  string;
  token_symbol?:                string;
  total_supply?:                string;
  holder_count?:                string;
  lp_total_supply?:             string;

  // Holders + liquidity
  holders?: Array<{
    address:    string;
    balance:    string;
    percent:    string;
    is_contract: number;
    is_locked:  number;
    tag?:       string;
  }>;
  lp_holders?: Array<{
    address:  string;
    balance:  string;
    percent:  string;
    is_locked: number;
    locked_detail?: Array<{ opt: string; amount: string; end_time: string }>;
    tag?:     string;
  }>;
  dex?: Array<{ name: string; liquidity: string; pair: string }>;
}

// ── Parsed / scored result ────────────────────────────────────────────────────

export interface GoPlusResult {
  raw:           GoPlusRaw;
  chainId:       string;
  /** 0–100 risk score derived from GoPlus fields */
  riskScore:     number;
  flags: Array<{
    id:          string;
    name:        string;
    severity:    'low' | 'medium' | 'high' | 'critical';
    description: string;
  }>;
  summary: {
    isHoneypot:         boolean;
    isOpenSource:       boolean;
    isProxy:            boolean;
    isMintable:         boolean;
    ownerRenounced:     boolean;
    buyTax:             number | null;   // 0–100 (%)
    sellTax:            number | null;
    topHolderPercent:   number | null;   // % held by top 10 holders
    lpLockedPercent:    number | null;   // % of LP locked
    holderCount:        number | null;
  };
}

function pct(s?: string): number | null {
  if (s == null || s === '') return null;
  const n = parseFloat(s);
  return isNaN(n) ? null : n * 100; // GoPlus returns 0.05 for 5%
}

function flag1(val?: '0' | '1'): boolean {
  return val === '1';
}

export function parseGoPlusResult(raw: GoPlusRaw, chainId: string): GoPlusResult {
  const flags: GoPlusResult['flags'] = [];

  // ── Honeypot ────────────────────────────────────────────────────────────
  if (flag1(raw.is_honeypot)) {
    flags.push({
      id: 'honeypot', name: 'Honeypot Detected', severity: 'critical',
      description: 'Contract has been confirmed as a honeypot — tokens can be bought but not sold.',
    });
  }
  if (flag1(raw.cannot_buy)) {
    flags.push({
      id: 'cannot-buy', name: 'Buying Disabled', severity: 'critical',
      description: 'The contract currently blocks all buy transactions.',
    });
  }
  if (flag1(raw.cannot_sell_all)) {
    flags.push({
      id: 'cannot-sell-all', name: 'Cannot Sell All Tokens', severity: 'high',
      description: 'Holders cannot sell their full balance — a partial sell restriction is active.',
    });
  }
  if (flag1(raw.honeypot_with_same_creator)) {
    flags.push({
      id: 'honeypot-creator-history', name: 'Creator Has Deployed Honeypots', severity: 'high',
      description: 'The contract creator has previously deployed confirmed honeypot contracts.',
    });
  }

  // ── Trading taxes ────────────────────────────────────────────────────────
  const buyTax  = pct(raw.buy_tax);
  const sellTax = pct(raw.sell_tax);

  if (buyTax !== null && buyTax > 10) {
    flags.push({
      id: 'high-buy-tax', name: `High Buy Tax (${buyTax.toFixed(1)}%)`, severity: buyTax > 25 ? 'critical' : 'high',
      description: `Buy tax is ${buyTax.toFixed(1)}%. Taxes above 10% significantly reduce returns.`,
    });
  }
  if (sellTax !== null && sellTax > 10) {
    flags.push({
      id: 'high-sell-tax', name: `High Sell Tax (${sellTax.toFixed(1)}%)`, severity: sellTax > 25 ? 'critical' : 'high',
      description: `Sell tax is ${sellTax.toFixed(1)}%. Taxes above 10% are a common scam vector.`,
    });
  }
  if (flag1(raw.slippage_modifiable)) {
    flags.push({
      id: 'slippage-modifiable', name: 'Tax / Slippage Modifiable', severity: 'high',
      description: 'Owner can increase buy/sell taxes at any time — taxes could be raised to 100%.',
    });
  }

  // ── Minting ──────────────────────────────────────────────────────────────
  if (flag1(raw.is_mintable) || flag1(raw.can_be_minted)) {
    flags.push({
      id: 'mintable', name: 'Token is Mintable', severity: 'high',
      description: 'Owner can mint additional tokens, potentially diluting holders without limit.',
    });
  }

  // ── Ownership ────────────────────────────────────────────────────────────
  if (flag1(raw.hidden_owner)) {
    flags.push({
      id: 'hidden-owner', name: 'Hidden Owner', severity: 'critical',
      description: 'The contract has a hidden owner address. The real owner can retain control even after appearing to renounce.',
    });
  }
  if (flag1(raw.owner_change_balance)) {
    flags.push({
      id: 'owner-can-change-balance', name: 'Owner Can Modify Balances', severity: 'critical',
      description: 'The owner can directly increase or decrease any holder\'s token balance.',
    });
  }
  if (!flag1(raw.is_contract_renounced) && raw.owner_address && raw.owner_address !== '0x0000000000000000000000000000000000000000') {
    flags.push({
      id: 'ownership-not-renounced', name: 'Ownership Not Renounced', severity: 'medium',
      description: `Contract is owned by ${raw.owner_address}. Owner retains admin control. ` +
        `Verify on-chain whether this is an EOA, a Gnosis Safe multisig, or an unrecognised proxy.`,
    });
  }

  // ── Creator in known scam deployer set ───────────────────────────────────
  if (raw.creator_address && KNOWN_SCAM_DEPLOYERS.has(raw.creator_address.toLowerCase())) {
    flags.push({
      id: 'known-scam-deployer', name: 'Known Scam Deployer', severity: 'critical',
      description: `This contract was deployed by ${raw.creator_address}, ` +
        `an address previously associated with confirmed rug pulls or scam projects.`,
    });
  }

  // ── Transfer controls ────────────────────────────────────────────────────
  if (flag1(raw.transfer_pausable)) {
    flags.push({
      id: 'transfer-pausable', name: 'Transfers Can Be Paused', severity: 'high',
      description: 'Owner can pause all token transfers, preventing any sells or movement.',
    });
  }
  if (flag1(raw.is_blacklisted)) {
    flags.push({
      id: 'blacklist-function', name: 'Blacklist Function Present', severity: 'medium',
      description: 'Owner can blacklist wallets and prevent them from trading the token.',
    });
  }
  if (flag1(raw.personal_slippage_modifiable)) {
    flags.push({
      id: 'exclude-from-fee', name: 'excludeFromFee() Present', severity: 'medium',
      description: 'Owner can exempt specific wallets from taxes. Insiders may trade fee-free while regular holders pay full fees.',
    });
  }
  if (flag1(raw.trading_cooldown)) {
    flags.push({
      id: 'trading-cooldown', name: 'Trading Cooldown', severity: 'low',
      description: 'A cooldown period is enforced between consecutive trades.',
    });
  }

  // ── Verification ─────────────────────────────────────────────────────────
  if (!flag1(raw.is_open_source)) {
    flags.push({
      id: 'unverified-contract', name: 'Unverified Contract', severity: 'high',
      description: 'Contract source code is not verified. The code cannot be audited.',
    });
  }
  if (flag1(raw.is_proxy)) {
    flags.push({
      id: 'proxy-contract', name: 'Proxy Contract', severity: 'low',
      description: 'Contract is a proxy. Logic can be upgraded by the owner.',
    });
  }

  // ── Top holder concentration ──────────────────────────────────────────────
  let topHolderPercent: number | null = null;
  if (raw.holders?.length) {
    const top10 = raw.holders.slice(0, 10);
    topHolderPercent = top10.reduce((s, h) => s + parseFloat(h.percent || '0') * 100, 0);

    if (topHolderPercent > 50) {
      flags.push({
        id: 'whale-concentration', name: `Top 10 Holders Own ${topHolderPercent.toFixed(1)}%`, severity: topHolderPercent > 80 ? 'critical' : 'high',
        description: `The top 10 wallets control ${topHolderPercent.toFixed(1)}% of supply. A coordinated sell would collapse the price.`,
      });
    }
  }

  // ── LP lock ───────────────────────────────────────────────────────────────
  let lpLockedPercent: number | null = null;
  if (raw.lp_holders?.length) {
    const totalLocked = raw.lp_holders
      .filter(h => h.is_locked === 1)
      .reduce((s, h) => s + parseFloat(h.percent || '0') * 100, 0);

    lpLockedPercent = totalLocked;

    if (totalLocked < 80 && raw.lp_total_supply && parseFloat(raw.lp_total_supply) > 0) {
      flags.push({
        id: 'lp-not-locked', name: `Only ${totalLocked.toFixed(1)}% of LP Locked`, severity: totalLocked < 20 ? 'critical' : totalLocked < 50 ? 'high' : 'medium',
        description: `${totalLocked.toFixed(1)}% of liquidity pool tokens are locked. Unlocked LP can be removed (rug pull).`,
      });
    }
  } else if (raw.dex?.length) {
    // Has DEX liquidity but no LP holder data → assume unlocked
    flags.push({
      id: 'lp-lock-unknown', name: 'LP Lock Status Unknown', severity: 'medium',
      description: 'Token has liquidity on DEX but LP lock status could not be determined.',
    });
  }

  // ── Risk score ────────────────────────────────────────────────────────────
  const weights: Record<string, number> = {
    'honeypot': 50, 'cannot-buy': 50, 'cannot-sell-all': 40,
    'honeypot-creator-history': 30, 'high-buy-tax': 20, 'high-sell-tax': 25,
    'slippage-modifiable': 25, 'mintable': 20, 'hidden-owner': 40,
    'owner-can-change-balance': 40, 'ownership-not-renounced': 10,
    'transfer-pausable': 25, 'blacklist-function': 15, 'exclude-from-fee': 10, 'trading-cooldown': 5,
    'unverified-contract': 20, 'proxy-contract': 5,
    'whale-concentration': 20, 'lp-not-locked': 25, 'lp-lock-unknown': 10,
    'known-scam-deployer': 50,
  };

  const riskScore = Math.min(
    flags.reduce((s, f) => s + (weights[f.id] ?? 0), 0),
    100,
  );

  return {
    raw,
    chainId,
    riskScore,
    flags,
    summary: {
      isHoneypot:       flag1(raw.is_honeypot),
      isOpenSource:     flag1(raw.is_open_source),
      isProxy:          flag1(raw.is_proxy),
      isMintable:       flag1(raw.is_mintable) || flag1(raw.can_be_minted),
      ownerRenounced:   flag1(raw.is_contract_renounced),
      buyTax,
      sellTax,
      topHolderPercent,
      lpLockedPercent,
      holderCount:      raw.holder_count ? parseInt(raw.holder_count) : null,
    },
  };
}

/**
 * Run a full GoPlus token security check.
 * Returns null if the network is not supported or the API call fails.
 */
export async function goplusTokenSecurity(
  network: string,
  contractAddress: string,
): Promise<GoPlusResult | null> {
  const chainId = GOPLUS_CHAIN_IDS[network];
  if (!chainId) return null;

  try {
    const res = await fetch(
      `${BASE_URL}/token_security/${chainId}?contract_addresses=${contractAddress.toLowerCase()}`,
      {
        headers: goplusHeaders(),
        signal: AbortSignal.timeout(15_000),
      },
    );

    if (!res.ok) {
      console.warn(`[goplus] HTTP ${res.status} for ${network}:${contractAddress}`);
      return null;
    }

    const json = (await res.json()) as {
      code:    number;
      message: string;
      result:  Record<string, GoPlusRaw>;
    };

    if (json.code !== 1) {
      console.warn(`[goplus] API error ${json.code}: ${json.message}`);
      return null;
    }

    const raw = json.result[contractAddress.toLowerCase()];
    if (!raw) return null;

    return parseGoPlusResult(raw, chainId);
  } catch (err) {
    console.warn(`[goplus] Failed for ${network}:${contractAddress}`, err);
    return null;
  }
}
