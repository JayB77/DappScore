import { createPublicClient, http, parseAbiItem, keccak256 } from 'viem';
import { baseSepolia } from 'viem/chains';
import { logger } from './logger';

// Known scam patterns
const SCAM_PATTERNS = {
  // Honeypot indicators
  HONEYPOT_FUNCTIONS: [
    'excludeFromMaxTransaction',
    'setRule',
    'blacklist',
    'setBots',
    'setBlacklist',
    'antiBot',
  ],

  // Owner-privileged control functions that signal rug/scam risk
  OWNER_CONTROL_FUNCTIONS: [
    'setTax',
    'setFee',
    'mint',
    'pause',
    'excludeFromFee',
    'setTradingEnabled',
  ],

  // Suspicious function signatures
  SUSPICIOUS_SIGNATURES: [
    '0x23b872dd', // transferFrom without proper implementation
    '0xa9059cbb', // transfer with hidden fees
  ],

  // Known scam deployer addresses
  KNOWN_SCAM_DEPLOYERS: new Set([
    // Add known scam deployer addresses here
  ]),

  // Suspicious token names/symbols
  SUSPICIOUS_NAMES: [
    /elon/i,
    /safe.*moon/i,
    /baby.*doge/i,
    /shib.*inu/i,
    /pepe.*2/i,
    /100x/i,
    /1000x/i,
  ],
};

// ── Rug contract selector profiles ──────────────────────────────────────────
// These are matched using Jaccard similarity against a contract's function
// selector set. Exact bytecode hashes (for 1.0 matches) are added at runtime
// via addKnownScam() as confirmed rugs are identified on-chain.
//
// Selector values = first 4 bytes of keccak256(function signature).
const KNOWN_RUG_PROFILES: Array<{ name: string; selectors: string[] }> = [
  {
    name: 'Safemoon Clone (fee-on-transfer + blacklist)',
    // setTax + excludeFromFee + setBots + blacklist combo is the Safemoon template
    selectors: [
      '3fd0d025', // setTax(uint256,uint256)
      '437823ec', // excludeFromFee(address)
      '69fe0e2d', // setFee(uint256)
      '8da5cb5b', // owner()
      'b515566a', // setBots(address[],bool)
      'f2fde38b', // transferOwnership(address)
      'f9f92be4', // blacklist(address,bool)
    ],
  },
  {
    name: 'Honeypot (anti-sell + trading toggle)',
    // setRule/antiBot + setTradingEnabled is the "buy-only honeypot" template
    selectors: [
      '0b78f9c0', // antiBot(bool)
      '3bbac579', // setTradingEnabled(bool)
      '715018a6', // renounceOwnership()
      '8da5cb5b', // owner()
      'c3c8cd80', // excludeFromMaxTransaction(address,bool)
      'f2fde38b', // transferOwnership(address)
      'fa8b3c00', // setRule(bool)
    ],
  },
  {
    name: 'Mintable rug (mint + pause + blacklist)',
    // Unlimited mint + pause + blacklist = classic admin-rug template
    selectors: [
      '40c10f19', // mint(address,uint256)
      '437823ec', // excludeFromFee(address)
      '8456cb59', // pause()
      '8da5cb5b', // owner()
      'f2fde38b', // transferOwnership(address)
      'f9f92be4', // blacklist(address,bool)
    ],
  },
  {
    name: 'Fee manipulation (modifiable slippage)',
    // Slippage + per-wallet fee exemption combo
    selectors: [
      '3fd0d025', // setTax(uint256,uint256)
      '437823ec', // excludeFromFee(address)
      '8da5cb5b', // owner()
      'a9059cbb', // transfer(address,uint256) — overridden with hidden fee
      'dd62ed3e', // allowance(address,address)
      'f2fde38b', // transferOwnership(address)
    ],
  },
];

// ── Gnosis Safe function selectors (for owner multisig detection) ─────────────
const GNOSIS_SAFE_SELECTORS = {
  execTransaction: '6a761202',
  getOwners:       'a0e67e2b',
  isOwner:         '2f54bf6e',
};

// ── Timelock function selectors ───────────────────────────────────────────────
const TIMELOCK_SELECTORS = {
  schedule: '01d5062a',
  execute:  '134008d3',
};

interface ScamAnalysis {
  address: string;
  riskScore: number; // 0-100
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  flags: ScamFlag[];
  similarContracts: SimilarContract[];
  recommendation: string;
}

interface ScamFlag {
  type: string;
  severity: 'info' | 'warning' | 'danger';
  description: string;
}

interface SimilarContract {
  address: string;
  similarity: number;
  wasScam: boolean;
  name?: string;
}

export class ScamPatternService {
  private client;

  // Maps normalised-bytecode keccak256 hash → known contract info.
  // Seeded with rug selector profiles at construction time;
  // exact bytecode hashes are added via addKnownScam() as rugs are confirmed.
  private knownBytecodes: Map<string, {
    wasScam: boolean;
    name?: string;
    selectors: string[];    // sorted function selectors for Jaccard similarity
    parentHash?: string;    // rug lineage: which known scam this was forked from
  }> = new Map();

  // Tracks clone genealogy: child bytecode hash → parent bytecode hash.
  // Populated via addToLineage() or addKnownScam() with a parentBytecode argument.
  private rugLineage: Map<string, string> = new Map();

  constructor() {
    this.client = createPublicClient({
      chain: baseSepolia,
      transport: http(process.env.RPC_URL || 'https://sepolia.base.org'),
    });
    this.seedKnownPatterns();
  }

  // ── Seeding ────────────────────────────────────────────────────────────────

  private seedKnownPatterns(): void {
    // Seed fuzzy-match rug profiles from known function selector combinations.
    // The key is keccak256(sorted-selectors) — not a real bytecode hash — so
    // similarity is always computed via Jaccard, never reaching 1.0 unless the
    // selector set is identical. Exact bytecode hashes are added via addKnownScam().
    for (const profile of KNOWN_RUG_PROFILES) {
      const selectors = [...profile.selectors].sort();
      const fingerprint = keccak256(`0x${selectors.join('')}` as `0x${string}`);
      this.knownBytecodes.set(fingerprint, {
        wasScam: true,
        name: profile.name,
        selectors,
      });
    }
  }

  // ── Public analysis entry point ────────────────────────────────────────────

  async analyzeContract(address: string): Promise<ScamAnalysis> {
    const flags: ScamFlag[] = [];
    let riskScore = 0;

    try {
      // Get contract bytecode
      const bytecode = await this.client.getBytecode({ address: address as `0x${string}` });

      if (!bytecode) {
        flags.push({
          type: 'NO_CONTRACT',
          severity: 'danger',
          description: 'Address is not a contract',
        });
        riskScore += 50;
      } else {
        // Check for honeypot functions
        for (const func of SCAM_PATTERNS.HONEYPOT_FUNCTIONS) {
          if (this.bytecodeContainsFunction(bytecode, func)) {
            flags.push({
              type: 'HONEYPOT_FUNCTION',
              severity: 'danger',
              description: `Contains suspicious function: ${func}`,
            });
            riskScore += 15;
          }
        }

        // Check for owner-privileged control functions
        for (const func of SCAM_PATTERNS.OWNER_CONTROL_FUNCTIONS) {
          if (this.bytecodeContainsFunction(bytecode, func)) {
            flags.push({
              type: 'OWNER_CONTROL_FUNCTION',
              severity: 'warning',
              description: `Contains privileged owner function: ${func}()`,
            });
            riskScore += 10;
          }
        }

        // Check for hidden mint function
        if (this.hasHiddenMint(bytecode)) {
          flags.push({
            type: 'HIDDEN_MINT',
            severity: 'danger',
            description: 'Contract may have hidden mint capability',
          });
          riskScore += 30;
        }

        // Detect proxy / upgradeability patterns — INFO only, not a risk hit.
        // Proxies are legitimate architectural choices; users should simply be
        // aware the implementation can change.
        const proxy = this.detectProxyPattern(bytecode);
        if (proxy.type !== 'none') {
          flags.push({
            type: `PROXY_${proxy.type.toUpperCase().replace(/-/g, '_')}`,
            severity: 'info',
            description: proxy.description,
          });
          // UUPS / Transparent proxies carry some risk because they can be
          // upgraded to malicious logic — add a small bump but not critical.
          if (proxy.type === 'uups' || proxy.type === 'transparent') riskScore += 5;
        }
      }

      // Check deployer / owner type (multisig detection)
      const deployerAnalysis = await this.analyzeDeployer(address);
      flags.push(...deployerAnalysis.flags);
      riskScore += deployerAnalysis.riskIncrease;

      // Check similar contracts (clone detection)
      const similarContracts = await this.findSimilarContracts(address);

      // Adjust risk based on similar contracts
      const scamSimilars = similarContracts.filter(c => c.wasScam && c.similarity > 0.8);
      if (scamSimilars.length > 0) {
        const best = scamSimilars[0];
        const isExactClone = best.similarity === 1.0;
        flags.push({
          type: 'SIMILAR_TO_SCAM',
          severity: 'danger',
          description: isExactClone
            ? `Exact bytecode clone of known scam: ${best.name ?? best.address}`
            : `Contract is ${Math.round(best.similarity * 100)}% similar to known scam: ${best.name ?? best.address}`,
        });
        riskScore += isExactClone ? 40 : 25;
      }

      // Cap risk score at 100
      riskScore = Math.min(riskScore, 100);

      // Determine risk level
      let riskLevel: 'low' | 'medium' | 'high' | 'critical';
      if (riskScore < 20) riskLevel = 'low';
      else if (riskScore < 50) riskLevel = 'medium';
      else if (riskScore < 80) riskLevel = 'high';
      else riskLevel = 'critical';

      // Generate recommendation
      const recommendation = this.generateRecommendation(riskLevel, flags);

      return {
        address,
        riskScore,
        riskLevel,
        flags,
        similarContracts,
        recommendation,
      };
    } catch (error) {
      logger.error('Error analyzing contract:', error);
      throw error;
    }
  }

  // ── Clone detection ────────────────────────────────────────────────────────

  async findSimilarContracts(address: string): Promise<SimilarContract[]> {
    try {
      const bytecode = await this.client.getBytecode({ address: address as `0x${string}` });
      if (!bytecode) return [];

      const bytecodeHash    = this.hashBytecode(bytecode);
      const targetSelectors = this.extractSelectors(bytecode);
      const similar: SimilarContract[] = [];

      for (const [storedHash, info] of this.knownBytecodes) {
        // Exact clone: normalised bytecode hash matches
        if (storedHash === bytecodeHash) {
          similar.push({
            address: storedHash,
            similarity: 1.0,
            wasScam: info.wasScam,
            name: info.name,
          });
          continue;
        }

        // Fuzzy clone: Jaccard similarity on function selector sets
        if (info.selectors.length > 0) {
          const similarity = this.calculateSelectorSimilarity(targetSelectors, info.selectors);
          if (similarity > 0.6) {
            similar.push({
              address: storedHash,
              similarity,
              wasScam: info.wasScam,
              name: info.name,
            });
          }
        }
      }

      return similar.sort((a, b) => b.similarity - a.similarity).slice(0, 5);
    } catch (error) {
      logger.error('Error finding similar contracts:', error);
      return [];
    }
  }

  // ── Rug lineage ────────────────────────────────────────────────────────────

  /** Record that childBytecode was forked from parentBytecode. */
  addToLineage(childBytecode: string, parentBytecode: string): void {
    const childHash  = this.hashBytecode(childBytecode);
    const parentHash = this.hashBytecode(parentBytecode);
    this.rugLineage.set(childHash, parentHash);
    const entry = this.knownBytecodes.get(childHash);
    if (entry) entry.parentHash = parentHash;
  }

  /**
   * Walk the lineage tree upward from bytecode and return an ordered list of
   * ancestor hashes (oldest last). Stops at 10 hops to prevent cycles.
   */
  getLineage(bytecode: string): string[] {
    const lineage: string[] = [];
    let current = this.hashBytecode(bytecode);
    const visited = new Set<string>();
    while (this.rugLineage.has(current) && !visited.has(current)) {
      visited.add(current);
      current = this.rugLineage.get(current)!;
      lineage.push(current);
    }
    return lineage;
  }

  // ── Batch analysis ─────────────────────────────────────────────────────────

  async analyzeRecentProjects(): Promise<void> {
    // This would be called by cron job to analyze recent project submissions
    logger.info('Analyzing recent projects for scam patterns...');

    // In real implementation:
    // 1. Fetch recent projects from subgraph
    // 2. Analyze each contract
    // 3. Store results / trigger alerts
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private bytecodeContainsFunction(bytecode: string, funcName: string): boolean {
    const selector = this.getFunctionSelector(funcName);
    return bytecode.toLowerCase().includes(selector.slice(2));
  }

  private getFunctionSelector(funcName: string): string {
    const selectors: Record<string, string> = {
      // Honeypot / anti-bot functions
      excludeFromMaxTransaction: '0xc3c8cd80',
      setRule:                   '0xfa8b3c00',
      blacklist:                 '0xf9f92be4',
      setBots:                   '0xb515566a',
      setBlacklist:              '0x884f99c4',
      antiBot:                   '0x0b78f9c0',
      // Owner control functions
      setTax:                    '0x3fd0d025', // setTax(uint256,uint256)
      setFee:                    '0x69fe0e2d', // setFee(uint256)
      mint:                      '0x40c10f19', // mint(address,uint256)
      pause:                     '0x8456cb59', // pause()
      excludeFromFee:            '0x437823ec', // excludeFromFee(address)
      setTradingEnabled:         '0x3bbac579', // setTradingEnabled(bool)
    };
    return selectors[funcName] || '0x00000000';
  }

  private hasHiddenMint(bytecode: string): boolean {
    const mintSelector = '40c10f19'; // mint(address,uint256)
    const hasMintSelector = bytecode.toLowerCase().includes(mintSelector);
    const hasMintKeyword = bytecode.toLowerCase().includes('6d696e74'); // "mint" in hex

    return hasMintKeyword && !hasMintSelector;
  }

  // ── Proxy pattern detection ───────────────────────────────────────────────

  /**
   * Identify the proxy/upgradeability pattern used by a contract.
   * Returns INFO-level data only — proxies are NOT inherently malicious.
   *
   * Detection hierarchy (checked in order):
   *   1. EIP-1167 minimal clone  — fixed delegation, no upgrades possible
   *   2. UUPS (ERC-1822)        — upgradeTo + proxiableUUID selectors
   *   3. Transparent proxy      — admin() + implementation() + upgradeTo()
   *   4. Beacon proxy           — beacon() + implementation()
   *   5. Raw delegatecall       — opcode 0xf4 present (generic catch-all)
   */
  private detectProxyPattern(bytecode: string): {
    type: 'none' | 'minimal-clone' | 'uups' | 'transparent' | 'beacon' | 'delegatecall';
    description: string;
  } {
    const hex = (bytecode.startsWith('0x') ? bytecode.slice(2) : bytecode).toLowerCase();

    // EIP-1167: fixed 45-byte clone factory prefix
    if (hex.startsWith('363d3d373d3d3d363d73')) {
      return {
        type: 'minimal-clone',
        description:
          'EIP-1167 minimal clone — delegates all calls to a fixed implementation address. ' +
          'Cannot be upgraded.',
      };
    }

    const selectors = new Set(this.extractSelectors(bytecode));

    // UUPS (ERC-1822): upgradeTo/upgradeToAndCall + proxiableUUID
    const hasUpgradeTo     = selectors.has('3659cfe6') || selectors.has('4f1ef286');
    const hasProxiableUUID = selectors.has('52d1902d');
    if (hasUpgradeTo && hasProxiableUUID) {
      return {
        type: 'uups',
        description:
          'UUPS upgradeable proxy (ERC-1822/EIP-1967) — the owner can swap the contract ' +
          'implementation at any time. Verify that upgradeTo() is protected by a timelock ' +
          'or multisig.',
      };
    }

    // TransparentUpgradeableProxy: admin() + implementation() + upgradeTo()
    const hasAdmin          = selectors.has('f851a440');
    const hasImplementation = selectors.has('5c60da1b');
    if (hasAdmin && hasImplementation && hasUpgradeTo) {
      return {
        type: 'transparent',
        description:
          'Transparent upgradeable proxy (EIP-1967) — a separate admin address can replace ' +
          'the implementation. Verify the admin is a timelock or multisig, not an EOA.',
      };
    }

    // Beacon proxy: beacon() + implementation()
    const hasBeacon = selectors.has('59659e90');
    if (hasBeacon && hasImplementation) {
      return {
        type: 'beacon',
        description:
          'Beacon proxy — implementation address is read from a beacon contract and can ' +
          'be changed by the beacon owner for all proxies pointing at it.',
      };
    }

    // Generic delegatecall (opcode 0xf4)
    if (hex.includes('f4')) {
      return {
        type: 'delegatecall',
        description:
          'Contract uses delegatecall — execution logic may live in a separate contract. ' +
          'Verify there is no hidden upgrade path.',
      };
    }

    return { type: 'none', description: '' };
  }

  /**
   * Analyse the contract owner:
   * - If owner() is a contract, detect whether it's a Gnosis Safe, Timelock, or unknown.
   * - Unknown contract owners are flagged as suspicious (could hide true control).
   */
  private async analyzeDeployer(contractAddress: string): Promise<{ flags: ScamFlag[]; riskIncrease: number }> {
    const flags: ScamFlag[] = [];
    let riskIncrease = 0;

    try {
      // Try to read owner() — not all contracts expose it
      let ownerAddress: string | null = null;
      try {
        ownerAddress = (await this.client.readContract({
          address: contractAddress as `0x${string}`,
          abi: [{
            name: 'owner',
            type: 'function',
            inputs: [],
            outputs: [{ name: '', type: 'address' }],
            stateMutability: 'view' as const,
          }] as const,
          functionName: 'owner',
        })) as string;
      } catch {
        // No owner() — Ownable not used; skip
      }

      if (ownerAddress && ownerAddress !== '0x0000000000000000000000000000000000000000') {
        // Determine if the owner is itself a contract (multisig / proxy / DAO)
        const ownerCode = await this.client.getBytecode({ address: ownerAddress as `0x${string}` });
        const ownerIsContract = !!ownerCode && ownerCode !== '0x';

        if (ownerIsContract) {
          const ownerSelectors = this.extractSelectors(ownerCode!);

          const isGnosisSafe =
            ownerSelectors.includes(GNOSIS_SAFE_SELECTORS.execTransaction) &&
            ownerSelectors.includes(GNOSIS_SAFE_SELECTORS.getOwners);

          const isTimelock =
            ownerSelectors.includes(TIMELOCK_SELECTORS.schedule) &&
            ownerSelectors.includes(TIMELOCK_SELECTORS.execute);

          if (isGnosisSafe) {
            flags.push({
              type: 'MULTISIG_OWNER',
              severity: 'info',
              description: `Owner is a Gnosis Safe multisig at ${ownerAddress}. Verify the signer set and threshold on-chain.`,
            });
          } else if (isTimelock) {
            flags.push({
              type: 'TIMELOCK_OWNER',
              severity: 'info',
              description: `Owner is a Timelock controller at ${ownerAddress}. Check the delay period and proposer addresses.`,
            });
          } else {
            // Unknown contract owner — could be hiding true control behind a custom proxy
            flags.push({
              type: 'SUSPICIOUS_CONTRACT_OWNER',
              severity: 'warning',
              description: `Owner is an unrecognised contract at ${ownerAddress}. True ownership may be obscured behind a custom proxy or multisig.`,
            });
            riskIncrease += 20;
          }
        }
      }
    } catch (error) {
      logger.error('Error in owner analysis:', error);
    }

    return { flags, riskIncrease };
  }

  // ── Hashing & fingerprinting ───────────────────────────────────────────────

  /**
   * Normalise bytecode by stripping the Solidity CBOR metadata suffix, then
   * return its keccak256 hash. The metadata suffix encodes compiler version and
   * source file paths — removing it makes identical-source contracts hash the
   * same even when compiled with different settings.
   *
   * Format: ...runtime... <metadata-bytes> <2-byte-length>
   */
  private hashBytecode(bytecode: string): string {
    const hex = bytecode.startsWith('0x') ? bytecode.slice(2) : bytecode;
    // Last 2 bytes (4 hex chars) = length of CBOR metadata preceding them
    const metaLen = parseInt(hex.slice(-4), 16);
    const normalized =
      metaLen > 0 && metaLen * 2 + 4 < hex.length
        ? hex.slice(0, -(metaLen * 2 + 4))
        : hex;
    return keccak256(`0x${normalized}` as `0x${string}`);
  }

  /**
   * Scan bytecode for PUSH4 opcodes (0x63) to extract all 4-byte function
   * selectors. Returns them sorted for use in Jaccard similarity comparisons.
   *
   * Note: only catches selectors in the dispatch table; internal selectors
   * may be missed, but the dispatch table is the most reliable fingerprint.
   */
  private extractSelectors(bytecode: string): string[] {
    const hex = bytecode.startsWith('0x') ? bytecode.slice(2) : bytecode;
    const selectors = new Set<string>();
    for (let i = 0; i < hex.length - 10; i += 2) {
      if (hex.slice(i, i + 2) === '63') {
        const sel = hex.slice(i + 2, i + 10);
        // Skip trivial / padding values
        if (sel !== '00000000' && sel !== 'ffffffff') selectors.add(sel);
      }
    }
    return Array.from(selectors).sort();
  }

  /**
   * Jaccard similarity between two function selector sets.
   * Returns 0–1; 1.0 = identical selector sets.
   */
  private calculateSelectorSimilarity(a: string[], b: string[]): number {
    if (a.length === 0 && b.length === 0) return 1;
    const setA = new Set(a);
    const setB = new Set(b);
    const intersection = a.filter(s => setB.has(s)).length;
    const union = new Set([...a, ...b]).size;
    return union > 0 ? intersection / union : 0;
  }

  private generateRecommendation(riskLevel: string, flags: ScamFlag[]): string {
    switch (riskLevel) {
      case 'critical':
        return 'AVOID - This contract shows multiple critical red flags consistent with known scam patterns.';
      case 'high':
        return 'CAUTION - This contract has significant warning signs. Conduct thorough research before interacting.';
      case 'medium':
        return 'PROCEED WITH CARE - Some concerns detected. Review the flags and verify the project team.';
      case 'low':
        return 'APPEARS SAFE - No major concerns detected, but always do your own research.';
      default:
        return 'Unable to determine risk level.';
    }
  }

  // ── Public DB management ───────────────────────────────────────────────────

  /** Register a confirmed rug contract bytecode for exact-clone detection. */
  addKnownScam(bytecode: string, name?: string, parentBytecode?: string): void {
    const hash      = this.hashBytecode(bytecode);
    const selectors = this.extractSelectors(bytecode);
    const parentHash = parentBytecode ? this.hashBytecode(parentBytecode) : undefined;
    this.knownBytecodes.set(hash, { wasScam: true, name, selectors, parentHash });
    if (parentHash) this.rugLineage.set(hash, parentHash);
  }

  /** Register a known-safe contract bytecode (to suppress false positives). */
  addKnownSafe(bytecode: string, name?: string): void {
    const hash      = this.hashBytecode(bytecode);
    const selectors = this.extractSelectors(bytecode);
    this.knownBytecodes.set(hash, { wasScam: false, name, selectors });
  }
}

// ── Standalone exports (required by scam-detection routes) ───────────────────

/** Singleton used by standalone function wrappers below. */
const _service = new ScamPatternService();

/** Analyse a single contract for scam patterns. */
export async function analyzeContract(
  address: string,
  _network?: string,
): Promise<ScamAnalysis> {
  return _service.analyzeContract(address);
}

// ── Tokenomics sanity check ───────────────────────────────────────────────────

export interface TokenomicsAnalysis {
  address: string;
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  flags: Array<{ type: string; severity: 'info' | 'warning' | 'danger'; description: string }>;
  details: Record<string, unknown>;
  analyzedAt: Date;
}

const REAL_BURN_ADDRESSES = new Set([
  '0x000000000000000000000000000000000000dead',
  '0x0000000000000000000000000000000000000000',
  '0xdead000000000000000042069420694206942069',
]);

/**
 * Tokenomics sanity check using GoPlus token_security data.
 *
 * Flags:
 *   - DEV_WALLET_CONCENTRATION  : deployer wallet holds >15% of supply
 *   - TOP_5_CONCENTRATION       : top 5 wallets hold >50% of supply
 *   - FAKE_BURN_WALLET          : address resembles a burn but isn't a known dead address
 */
export async function analyzeTokenomics(
  tokenAddress: string,
  network = 'mainnet',
): Promise<TokenomicsAnalysis> {
  // Map service network string to a GoPlus-supported chain ID.
  // Defaults to Base mainnet; expand per-chain as needed.
  const chainId = network === 'testnet' ? 84532 : 8453;
  const flags: TokenomicsAnalysis['flags'] = [];
  let riskScore = 0;

  try {
    const res = await fetch(
      `https://api.gopluslabs.io/api/v1/token_security/${chainId}?contract_addresses=${tokenAddress}`,
      { headers: { Accept: 'application/json' } },
    );
    if (!res.ok) throw new Error(`GoPlus ${res.status}`);
    const data = await res.json();
    const token = Object.values(data?.result ?? {})[0] as Record<string, unknown> | undefined;
    if (!token) throw new Error('no data');

    const holders = Array.isArray(token.holders)
      ? (token.holders as Array<{ address: string; tag?: string; percent: string; is_locked?: number }>)
      : [];
    const creatorAddress = typeof token.creator_address === 'string'
      ? token.creator_address.toLowerCase()
      : null;

    // ── Check 1: Dev wallet concentration ────────────────────────────────────
    if (creatorAddress) {
      const devHolder = holders.find(h => h.address.toLowerCase() === creatorAddress);
      if (devHolder) {
        const pct = parseFloat(devHolder.percent) * 100;
        if (pct > 15) {
          flags.push({
            type: 'DEV_WALLET_CONCENTRATION',
            severity: pct > 30 ? 'danger' : 'warning',
            description:
              `Deployer wallet (${devHolder.address}) holds ${pct.toFixed(1)}% of supply. ` +
              `Projects with >15% in developer control carry significant dump risk.`,
          });
          riskScore += pct > 30 ? 30 : 20;
        }
      }
    }

    // ── Check 2: Top-5 concentration ─────────────────────────────────────────
    const top5Pct = holders.slice(0, 5).reduce((s, h) => s + parseFloat(h.percent) * 100, 0);
    if (top5Pct > 50) {
      flags.push({
        type: 'TOP_5_CONCENTRATION',
        severity: top5Pct > 70 ? 'danger' : 'warning',
        description:
          `Top 5 wallets collectively hold ${top5Pct.toFixed(1)}% of supply — ` +
          `a coordinated sell could collapse price.`,
      });
      riskScore += top5Pct > 70 ? 25 : 15;
    }

    // ── Check 3: Fake burn wallet detection ───────────────────────────────────
    // An address that LOOKS like a burn (many leading zeros, or contains 'dead')
    // but is not one of the known provably-unspendable addresses.
    for (const h of holders) {
      const addr = h.address.toLowerCase();
      const pct  = parseFloat(h.percent) * 100;
      if (pct < 1) continue;

      const looksLikeBurn =
        /^0x0{15,}/.test(addr) ||                  // ≥15 leading zeros after 0x
        (addr.includes('dead') && addr.length === 42); // contains 'dead' in 40-char hex

      if (looksLikeBurn && !REAL_BURN_ADDRESSES.has(addr)) {
        flags.push({
          type: 'FAKE_BURN_WALLET',
          severity: 'warning',
          description:
            `Address ${h.address} holds ${pct.toFixed(1)}% of supply and resembles a burn ` +
            `address, but is not a provably unspendable address. Tokens here may be recoverable.`,
        });
        riskScore += 15;
      }
    }

    riskScore = Math.min(100, riskScore);
    const riskLevel =
      riskScore < 20 ? 'low' :
      riskScore < 50 ? 'medium' :
      riskScore < 80 ? 'high' : 'critical';

    return {
      address: tokenAddress,
      riskScore,
      riskLevel,
      flags,
      details: {
        top5Pct,
        holderCount: holders.length,
        creatorAddress,
      },
      analyzedAt: new Date(),
    };
  } catch (error) {
    logger.error('[Tokenomics] analyzeTokenomics error:', error);
    return {
      address: tokenAddress,
      riskScore: 0,
      riskLevel: 'low',
      flags: [],
      details: { error: (error as Error).message },
      analyzedAt: new Date(),
    };
  }
}
