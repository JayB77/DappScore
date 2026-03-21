'use client';

import { useState } from 'react';
import { AlertOctagon, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';

export interface KnownProject {
  id: string;
  name: string;
  contractAddress?: string;
  trustLevel: number;
  status: number;
}

export interface DeployerRisk {
  /** Wallet address of the contract deployer */
  deployerAddress: string;
  /** Projects flagged as confirmed scam (trustLevel ≥ 4 or status ≥ 3) */
  scamCount: number;
  /** Projects flagged as suspicious but not confirmed (trustLevel == 3 or status == 2) */
  suspiciousCount: number;
  /** All matched projects from the DappScore database */
  knownProjects: KnownProject[];
}

function isScan(p: KnownProject): boolean {
  return p.trustLevel >= 4 || p.status >= 3;
}

function projectLabel(p: KnownProject): string {
  if (p.status >= 4) return 'Blacklisted';
  if (p.status === 3) return 'Suspended';
  if (p.trustLevel >= 5) return 'Probable Scam';
  if (p.trustLevel === 4) return 'Suspected Scam';
  if (p.trustLevel === 3 || p.status === 2) return 'Suspicious';
  return 'Flagged';
}

interface Props {
  risk: DeployerRisk;
  explorerBaseUrl?: string;
}

export function SerialRuggerBanner({ risk, explorerBaseUrl }: Props) {
  const [expanded, setExpanded] = useState(false);

  if (risk.scamCount === 0 && risk.suspiciousCount === 0) return null;

  const isSerial = risk.scamCount >= 2;
  const isConfirmed = risk.scamCount >= 1;

  const deployerUrl = explorerBaseUrl
    ? `${explorerBaseUrl}/address/${risk.deployerAddress}`
    : null;

  return (
    <div
      className={`rounded-xl border-2 p-4 mb-6 ${
        isConfirmed
          ? 'border-red-500 bg-red-950/60'
          : 'border-yellow-500 bg-yellow-950/50'
      }`}
    >
      {/* Main alert row */}
      <div className="flex items-start gap-3">
        <AlertOctagon
          className={`h-6 w-6 flex-shrink-0 mt-0.5 ${isConfirmed ? 'text-red-400' : 'text-yellow-400'}`}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`text-sm font-bold px-2 py-0.5 rounded ${
                isSerial
                  ? 'bg-red-500 text-white'
                  : isConfirmed
                  ? 'bg-red-500/80 text-white'
                  : 'bg-yellow-500 text-black'
              }`}
            >
              {isSerial
                ? 'SERIAL RUGGER'
                : isConfirmed
                ? 'KNOWN RUGGER'
                : 'SUSPICIOUS DEPLOYER'}
            </span>
            {deployerUrl ? (
              <a
                href={deployerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-mono text-gray-400 hover:text-white flex items-center gap-1 transition-colors"
              >
                {risk.deployerAddress.slice(0, 6)}…{risk.deployerAddress.slice(-4)}
                <ExternalLink className="h-3 w-3" />
              </a>
            ) : (
              <span className="text-xs font-mono text-gray-400">
                {risk.deployerAddress.slice(0, 6)}…{risk.deployerAddress.slice(-4)}
              </span>
            )}
          </div>

          <p className={`text-sm mt-1 ${isConfirmed ? 'text-red-200' : 'text-yellow-200'}`}>
            {isSerial ? (
              <>
                This deployer wallet has <strong>{risk.scamCount} confirmed scam projects</strong> in
                the DappScore database. High probability of repeat rug.
              </>
            ) : isConfirmed ? (
              <>
                This deployer wallet has <strong>1 confirmed scam project</strong> in the DappScore
                database. Exercise extreme caution.
              </>
            ) : (
              <>
                This deployer wallet has{' '}
                <strong>{risk.suspiciousCount} suspicious project{risk.suspiciousCount !== 1 ? 's' : ''}</strong>{' '}
                flagged in the DappScore database.
              </>
            )}
          </p>
        </div>

        {/* Expand toggle */}
        {risk.knownProjects.length > 0 && (
          <button
            onClick={() => setExpanded(e => !e)}
            className="text-gray-400 hover:text-white transition-colors flex-shrink-0"
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        )}
      </div>

      {/* Expanded project list */}
      {expanded && risk.knownProjects.length > 0 && (
        <div className="mt-3 pl-9 space-y-1.5">
          <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold mb-2">
            Previously deployed projects in DappScore
          </p>
          {risk.knownProjects.map(p => (
            <div key={p.id} className="flex items-center justify-between gap-2 text-sm">
              <span className="text-white font-medium truncate">{p.name}</span>
              <div className="flex items-center gap-2 flex-shrink-0">
                {p.contractAddress && (
                  <span className="text-xs font-mono text-gray-500">
                    {p.contractAddress.slice(0, 6)}…{p.contractAddress.slice(-4)}
                  </span>
                )}
                <span
                  className={`text-xs px-1.5 py-0.5 rounded font-semibold ${
                    isScan(p)
                      ? 'bg-red-500/20 text-red-400'
                      : 'bg-yellow-500/20 text-yellow-400'
                  }`}
                >
                  {projectLabel(p)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
