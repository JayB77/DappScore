import { createPublicClient, http, parseAbiItem } from 'viem';
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
  private knownBytecodes: Map<string, { wasScam: boolean; name?: string }> = new Map();

  constructor() {
    this.client = createPublicClient({
      chain: baseSepolia,
      transport: http(process.env.RPC_URL || 'https://sepolia.base.org'),
    });
  }

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

        // Check for hidden mint function
        if (this.hasHiddenMint(bytecode)) {
          flags.push({
            type: 'HIDDEN_MINT',
            severity: 'danger',
            description: 'Contract may have hidden mint capability',
          });
          riskScore += 30;
        }

        // Check for proxy pattern without clear upgrade mechanism
        if (this.isSuspiciousProxy(bytecode)) {
          flags.push({
            type: 'SUSPICIOUS_PROXY',
            severity: 'warning',
            description: 'Contract uses proxy pattern - implementation could change',
          });
          riskScore += 10;
        }
      }

      // Check deployer
      const deployerAnalysis = await this.analyzeDeployer(address);
      flags.push(...deployerAnalysis.flags);
      riskScore += deployerAnalysis.riskIncrease;

      // Check similar contracts
      const similarContracts = await this.findSimilarContracts(address);

      // Adjust risk based on similar contracts
      const scamSimilars = similarContracts.filter(c => c.wasScam && c.similarity > 0.8);
      if (scamSimilars.length > 0) {
        flags.push({
          type: 'SIMILAR_TO_SCAM',
          severity: 'danger',
          description: `Contract is ${Math.round(scamSimilars[0].similarity * 100)}% similar to known scam`,
        });
        riskScore += 25;
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

  async findSimilarContracts(address: string): Promise<SimilarContract[]> {
    try {
      const bytecode = await this.client.getBytecode({ address: address as `0x${string}` });

      if (!bytecode) return [];

      const similar: SimilarContract[] = [];
      const bytecodeHash = this.hashBytecode(bytecode);

      // Check against known bytecodes
      for (const [hash, info] of this.knownBytecodes) {
        const similarity = this.calculateSimilarity(bytecodeHash, hash);

        if (similarity > 0.5) {
          similar.push({
            address: hash, // In real impl, store address separately
            similarity,
            wasScam: info.wasScam,
            name: info.name,
          });
        }
      }

      // Sort by similarity
      similar.sort((a, b) => b.similarity - a.similarity);

      return similar.slice(0, 5);
    } catch (error) {
      logger.error('Error finding similar contracts:', error);
      return [];
    }
  }

  async analyzeRecentProjects(): Promise<void> {
    // This would be called by cron job to analyze recent project submissions
    logger.info('Analyzing recent projects for scam patterns...');

    // In real implementation:
    // 1. Fetch recent projects from subgraph
    // 2. Analyze each contract
    // 3. Store results / trigger alerts
  }

  private bytecodeContainsFunction(bytecode: string, funcName: string): boolean {
    // Simple check - in production use proper selector matching
    const selector = this.getFunctionSelector(funcName);
    return bytecode.toLowerCase().includes(selector.slice(2));
  }

  private getFunctionSelector(funcName: string): string {
    // Simplified - in production compute keccak256 of function signature
    const selectors: Record<string, string> = {
      excludeFromMaxTransaction: '0xc3c8cd80',
      setRule: '0xfa8b3c00',
      blacklist: '0xf9f92be4',
      setBots: '0xb515566a',
      setBlacklist: '0x884f99c4',
      antiBot: '0x0b78f9c0',
    };
    return selectors[funcName] || '0x00000000';
  }

  private hasHiddenMint(bytecode: string): boolean {
    // Check for mint-like operations without standard mint function
    const mintSelector = '40c10f19'; // mint(address,uint256)
    const hasMintSelector = bytecode.toLowerCase().includes(mintSelector);
    const hasMintKeyword = bytecode.toLowerCase().includes('6d696e74'); // "mint" in hex

    return hasMintKeyword && !hasMintSelector;
  }

  private isSuspiciousProxy(bytecode: string): boolean {
    // Check for delegatecall without proper upgrade guards
    const delegatecall = 'f4';
    return bytecode.toLowerCase().includes(delegatecall) && bytecode.length < 1000;
  }

  private async analyzeDeployer(contractAddress: string): Promise<{ flags: ScamFlag[]; riskIncrease: number }> {
    const flags: ScamFlag[] = [];
    let riskIncrease = 0;

    try {
      // Get contract creation transaction
      // In real implementation, use block explorer API to get deployer

      // Check if deployer is known scam address
      // Check deployer's other contracts
      // Check if deployer is new wallet with no history

    } catch (error) {
      logger.error('Error analyzing deployer:', error);
    }

    return { flags, riskIncrease };
  }

  private hashBytecode(bytecode: string): string {
    // Simple hash for comparison - in production use proper hashing
    return bytecode.slice(0, 100) + bytecode.slice(-100);
  }

  private calculateSimilarity(hash1: string, hash2: string): number {
    // Jaccard similarity or similar metric
    let matches = 0;
    const len = Math.min(hash1.length, hash2.length);

    for (let i = 0; i < len; i++) {
      if (hash1[i] === hash2[i]) matches++;
    }

    return matches / len;
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

  // Add known scam bytecode for future matching
  addKnownScam(bytecode: string, name?: string): void {
    const hash = this.hashBytecode(bytecode);
    this.knownBytecodes.set(hash, { wasScam: true, name });
  }

  // Add known safe bytecode for comparison
  addKnownSafe(bytecode: string, name?: string): void {
    const hash = this.hashBytecode(bytecode);
    this.knownBytecodes.set(hash, { wasScam: false, name });
  }
}
