'use client';

import Link from 'next/link';
import { ThumbsUp, ThumbsDown, Clock, Shield, AlertTriangle, Zap, Rocket, FlaskConical, Globe, XCircle, Crown } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { CHAIN_BY_NAME } from '@/config/chains';

export type TrustLevel = 'NewListing' | 'Trusted' | 'Neutral' | 'Suspicious' | 'SuspectedScam' | 'ProbableScam';

export type ProjectStage =
  | 'concept'
  | 'development'
  | 'testnet'
  | 'mainnet_beta'
  | 'mainnet'
  | 'launched'
  | 'discontinued';

export type AuditFirm =
  // Tier-1 audit firms
  | 'CertiK'
  | 'Hacken'
  | 'OpenZeppelin'
  | 'Consensys Diligence'
  | 'Cyfrin'
  | 'Trail of Bits'
  | 'Quantstamp'
  | 'PeckShield'
  // Contest / competitive audit platforms
  | 'Code4rena'
  | 'Sherlock'
  | 'Spearbit'
  // Other established firms
  | 'SlowMist'
  | 'Halborn'
  | 'Zellic'
  | 'Macro'
  | 'Sigma Prime'
  | 'Dedaub'
  | 'ChainSecurity'
  | 'BlockSec'
  // Bug bounty
  | 'Immunefi';

export interface AuditRecord {
  firm: AuditFirm | string;
  /** ISO date string, e.g. "2024-06" or "2024-06-15" */
  date: string;
  /** Link to the public report PDF / page */
  reportUrl: string;
  /** CertiK-style security score 0–100 */
  score?: number;
  findings?: {
    critical?: number;
    high?: number;
    medium?: number;
    low?: number;
  };
}

export interface Project {
  id: number;
  name: string;
  symbol: string;
  description: string;
  category: string;
  chain: string;
  projectStage?: ProjectStage;
  logoUrl?: string;
  websiteUrl?: string;
  contractAddresses?: { chain: string; address: string }[];
  audits?: AuditRecord[];
  // Token sale — all optional; only populated when the project has an active/upcoming sale
  totalSupply?: string;
  hardCap?: string;
  saleStartDate?: number;
  saleEndDate?: number;
  trustLevel: TrustLevel;
  isPremium?: boolean;
  upvotes: number;
  downvotes: number;
  verified: boolean;
  createdAt: number;
}

const trustLevelConfig: Record<TrustLevel, { label: string; color: string; icon: typeof Shield }> = {
  NewListing:    { label: 'New Listing',     color: 'bg-blue-500',   icon: Clock        },
  Trusted:       { label: 'Trusted',         color: 'bg-green-500',  icon: Shield       },
  Neutral:       { label: 'Neutral',         color: 'bg-gray-500',   icon: Shield       },
  Suspicious:    { label: 'Suspicious',      color: 'bg-yellow-500', icon: AlertTriangle },
  SuspectedScam: { label: 'Suspected Scam',  color: 'bg-orange-500', icon: AlertTriangle },
  ProbableScam:  { label: 'Probable Scam',   color: 'bg-red-500',    icon: AlertTriangle },
};

const stageConfig: Record<ProjectStage, { label: string; color: string; icon: typeof Shield }> = {
  concept:       { label: 'Concept',        color: 'text-purple-400', icon: Zap          },
  development:   { label: 'In Development', color: 'text-blue-400',   icon: Zap          },
  testnet:       { label: 'Testnet',        color: 'text-yellow-400', icon: FlaskConical  },
  mainnet_beta:  { label: 'Mainnet Beta',   color: 'text-orange-400', icon: Rocket       },
  mainnet:       { label: 'Mainnet',        color: 'text-green-400',  icon: Globe        },
  launched:      { label: 'Live',           color: 'text-green-400',  icon: Globe        },
  discontinued:  { label: 'Discontinued',   color: 'text-gray-400',   icon: XCircle      },
};

function StatusBadge({ project }: { project: Project }) {
  const now = Date.now() / 1000;

  // Token sale status takes priority when sale dates are set
  if (project.saleStartDate && project.saleEndDate) {
    if (now < project.saleStartDate) return <span className="text-blue-400 text-xs font-medium">Sale Upcoming</span>;
    if (now > project.saleEndDate)   return <span className="text-gray-400 text-xs font-medium">Sale Ended</span>;
    return <span className="text-green-400 text-xs font-medium">Sale Live</span>;
  }

  // Fall back to project stage
  if (project.projectStage && stageConfig[project.projectStage]) {
    const cfg = stageConfig[project.projectStage];
    return <span className={`${cfg.color} text-xs font-medium`}>{cfg.label}</span>;
  }

  return null;
}

export function ProjectCard({ project }: { project: Project }) {
  const trustConfig = trustLevelConfig[project.trustLevel];
  const TrustIcon = trustConfig.icon;

  return (
    <Link href={`/projects/${project.id}`}>
      <div className={`bg-gray-800 rounded-lg overflow-hidden hover:bg-gray-750 transition-all cursor-pointer border-2 ${project.isPremium ? 'border-yellow-500' : 'border-transparent hover:border-yellow-500/50'}`}>
        {project.isPremium && (
          <div className="bg-yellow-500 text-black text-center text-xs font-bold py-1 flex items-center justify-center space-x-1">
            <Crown className="h-3 w-3" />
            <span>FEATURED</span>
          </div>
        )}
        <div className="p-4">
          {/* Header */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 rounded-full bg-gray-700 flex items-center justify-center overflow-hidden flex-shrink-0">
                {project.logoUrl ? (
                  <img src={project.logoUrl} alt={project.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xl font-bold text-yellow-500">
                    {project.symbol.slice(0, 2)}
                  </span>
                )}
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="text-white font-semibold">{project.name}</h3>
                  {project.isPremium && <Crown className="h-4 w-4 text-yellow-400" title="Featured" />}
                  {project.verified && (
                    <span title="Verified"><Shield className="h-4 w-4 text-green-500" /></span>
                  )}
                </div>
                <p className="text-gray-400 text-sm">${project.symbol}</p>
              </div>
            </div>
            <StatusBadge project={project} />
          </div>

          {/* Description */}
          <p className="text-gray-400 text-sm mb-3 line-clamp-2">{project.description}</p>

          {/* Tags */}
          <div className="flex flex-wrap gap-2 mb-3">
            <span className="px-2 py-1 bg-gray-700 rounded text-xs text-gray-300">
              {project.category}
            </span>
            {(() => {
              const chainInfo = CHAIN_BY_NAME.get(project.chain);
              return (
                <span className="flex items-center space-x-1 px-2 py-1 bg-gray-700 rounded text-xs text-gray-300">
                  {chainInfo && (
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: chainInfo.color }} />
                  )}
                  <span>{chainInfo ? chainInfo.abbr : project.chain}</span>
                </span>
              );
            })()}
            {/* Token sale indicator */}
            {project.saleStartDate && (
              <span className="px-2 py-1 bg-yellow-500/10 border border-yellow-500/30 rounded text-xs text-yellow-400">
                Token Sale
              </span>
            )}
          </div>

          {/* Trust Level & Votes */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-1">
              <TrustIcon className={`h-4 w-4 ${trustConfig.color.replace('bg-', 'text-')}`} />
              <span className={`text-xs ${trustConfig.color} text-white px-2 py-0.5 rounded`}>
                {trustConfig.label}
              </span>
            </div>
            <div className="flex items-center space-x-3 text-sm">
              <span className="flex items-center space-x-1 text-green-400">
                <ThumbsUp className="h-4 w-4" />
                <span>{project.upvotes}</span>
              </span>
              <span className="flex items-center space-x-1 text-red-400">
                <ThumbsDown className="h-4 w-4" />
                <span>{project.downvotes}</span>
              </span>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-3 pt-3 border-t border-gray-700 flex justify-between items-center text-xs text-gray-500">
            <span>
              {project.hardCap
                ? `Hard Cap: ${project.hardCap}`
                : project.totalSupply
                ? `Supply: ${project.totalSupply}`
                : project.contractAddresses?.length
                ? `${project.contractAddresses.length} contract${project.contractAddresses.length > 1 ? 's' : ''}`
                : 'No token sale'}
            </span>
            <span>{formatDistanceToNow(project.createdAt * 1000, { addSuffix: true })}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
