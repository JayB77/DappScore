'use client';

import Link from 'next/link';
import { ThumbsUp, ThumbsDown, Clock, Shield, AlertTriangle, Crown } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { CHAIN_BY_NAME } from '@/config/chains';

export type TrustLevel = 'NewListing' | 'Trusted' | 'Neutral' | 'Suspicious' | 'SuspectedScam' | 'ProbableScam';

export interface Project {
  id: number;
  name: string;
  symbol: string;
  description: string;
  category: string;
  chain: string;
  logoUrl?: string;
  websiteUrl?: string;
  contractAddresses?: { chain: string; address: string }[];
  totalSupply: string;
  hardCap: string;
  startDate: number;
  endDate: number;
  trustLevel: TrustLevel;
  isPremium: boolean;
  premiumExpiresAt?: number;
  upvotes: number;
  downvotes: number;
  verified: boolean;
  createdAt: number;
}

const trustLevelConfig: Record<TrustLevel, { label: string; color: string; icon: typeof Shield }> = {
  NewListing: { label: 'New', color: 'bg-blue-500', icon: Clock },
  Trusted: { label: 'Trusted', color: 'bg-green-500', icon: Shield },
  Neutral: { label: 'Neutral', color: 'bg-gray-500', icon: Shield },
  Suspicious: { label: 'Suspicious', color: 'bg-yellow-500', icon: AlertTriangle },
  SuspectedScam: { label: 'Suspected Scam', color: 'bg-orange-500', icon: AlertTriangle },
  ProbableScam: { label: 'Probable Scam', color: 'bg-red-500', icon: AlertTriangle },
};

export function ProjectCard({ project }: { project: Project }) {
  const trustConfig = trustLevelConfig[project.trustLevel];
  const TrustIcon = trustConfig.icon;

  const saleStatus = () => {
    const now = Date.now() / 1000;
    if (now < project.startDate) return { label: 'Upcoming', color: 'text-blue-400' };
    if (now > project.endDate) return { label: 'Ended', color: 'text-gray-400' };
    return { label: 'Live', color: 'text-green-400' };
  };

  const status = saleStatus();

  return (
    <Link href={`/projects/${project.id}`}>
      <div
        className={`bg-gray-800 rounded-lg overflow-hidden hover:bg-gray-750 transition-all cursor-pointer border-2 ${
          project.isPremium ? 'border-yellow-500' : 'border-transparent'
        } hover:border-yellow-500/50`}
      >
        {/* Premium Badge */}
        {project.isPremium && (
          <div className="bg-yellow-500 text-black text-xs font-bold text-center py-1 flex items-center justify-center space-x-1">
            <Crown className="h-3 w-3" />
            <span>FEATURED</span>
          </div>
        )}

        <div className="p-4">
          {/* Header */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 rounded-full bg-gray-700 flex items-center justify-center overflow-hidden">
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
                  {project.verified && (
                    <span title="Verified"><Shield className="h-4 w-4 text-green-500" /></span>
                  )}
                </div>
                <p className="text-gray-400 text-sm">${project.symbol}</p>
              </div>
            </div>
            <span className={`${status.color} text-xs font-medium`}>{status.label}</span>
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
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: chainInfo.color }}
                    />
                  )}
                  <span>{chainInfo ? chainInfo.abbr : project.chain}</span>
                </span>
              );
            })()}
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
            <span>Hard Cap: {project.hardCap}</span>
            <span>{formatDistanceToNow(project.createdAt * 1000, { addSuffix: true })}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
