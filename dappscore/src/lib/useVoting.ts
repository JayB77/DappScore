'use client';

import { useEffect } from 'react';
import {
  useAccount,
  useChainId,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from 'wagmi';
import { formatUnits } from 'viem';
import { base, baseSepolia } from 'wagmi/chains';
import { VOTING_ENGINE_ABI, VoteType } from '@/config/abis';
import { CONTRACT_ADDRESSES } from '@/config/wagmi';

// ── Helpers ───────────────────────────────────────────────────────────────────

function getVotingEngineAddress(chainId: number): `0x${string}` | undefined {
  const map: Record<number, `0x${string}`> = {
    [base.id]:       CONTRACT_ADDRESSES[base.id].votingEngine as `0x${string}`,
    [baseSepolia.id]: CONTRACT_ADDRESSES[baseSepolia.id].votingEngine as `0x${string}`,
  };
  const addr = map[chainId];
  if (!addr || addr === '0x0000000000000000000000000000000000000000') return undefined;
  return addr;
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type OnChainVote = 'up' | 'down' | null;

export interface UseVotingResult {
  /** User's current on-chain vote for this project (null = no vote yet) */
  existingVote: OnChainVote;
  /** Pending SCORE rewards available to claim (formatted, e.g. "42.5") */
  pendingRewards: string;
  /** True while reading on-chain state */
  isLoading: boolean;
  /** True while a vote tx is in-flight */
  isVoting: boolean;
  /** True while a claim tx is in-flight */
  isClaiming: boolean;
  /** True if the VotingEngine contract address is configured on this chain */
  isContractDeployed: boolean;
  /** Submit an on-chain vote (1 = upvote, 2 = downvote) */
  castVote: (type: 'up' | 'down') => void;
  /** Claim pending SCORE rewards */
  claimRewards: () => void;
  /** Tx hash of the most recent vote (for a success toast) */
  voteTxHash: `0x${string}` | undefined;
  /** Tx hash of the most recent claim (for a success toast) */
  claimTxHash: `0x${string}` | undefined;
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useVoting(projectId: number): UseVotingResult {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const contractAddress = getVotingEngineAddress(chainId);
  const isContractDeployed = !!contractAddress;

  // ── Reads ─────────────────────────────────────────────────────────────────

  const { data: userVoteData, isLoading: isVoteLoading } = useReadContract({
    address: contractAddress,
    abi: VOTING_ENGINE_ABI,
    functionName: 'getUserVote',
    args: contractAddress && address ? [BigInt(projectId), address] : undefined,
    query: { enabled: isContractDeployed && isConnected && !!address },
  });

  const { data: pendingData, isLoading: isRewardsLoading } = useReadContract({
    address: contractAddress,
    abi: VOTING_ENGINE_ABI,
    functionName: 'pendingRewards',
    args: address ? [address] : undefined,
    query: { enabled: isContractDeployed && isConnected && !!address },
  });

  // ── Writes ────────────────────────────────────────────────────────────────

  const { writeContract: writeVote, data: voteTxHash, isPending: isVotePending } = useWriteContract();
  const { writeContract: writeClaim, data: claimTxHash, isPending: isClaimPending } = useWriteContract();

  const { isLoading: isVoteConfirming } = useWaitForTransactionReceipt({ hash: voteTxHash });
  const { isLoading: isClaimConfirming } = useWaitForTransactionReceipt({ hash: claimTxHash });

  // ── Derived state ─────────────────────────────────────────────────────────

  const rawVoteType = (userVoteData as { voteType?: number } | undefined)?.voteType ?? 0;
  const existingVote: OnChainVote =
    rawVoteType === VoteType.Upvote   ? 'up'   :
    rawVoteType === VoteType.Downvote ? 'down' : null;

  const pendingRewards = pendingData != null
    ? parseFloat(formatUnits(pendingData as bigint, 18)).toFixed(2)
    : '0.00';

  // ── Actions ───────────────────────────────────────────────────────────────

  const castVote = (type: 'up' | 'down') => {
    if (!contractAddress || !isConnected) return;
    const voteType = type === 'up' ? VoteType.Upvote : VoteType.Downvote;
    writeVote({
      address: contractAddress,
      abi: VOTING_ENGINE_ABI,
      functionName: 'vote',
      args: [BigInt(projectId), voteType, ''],
    });
  };

  const claimRewards = () => {
    if (!contractAddress || !isConnected) return;
    writeClaim({
      address: contractAddress,
      abi: VOTING_ENGINE_ABI,
      functionName: 'claimRewards',
      args: [],
    });
  };

  return {
    existingVote,
    pendingRewards,
    isLoading: isVoteLoading || isRewardsLoading,
    isVoting: isVotePending || isVoteConfirming,
    isClaiming: isClaimPending || isClaimConfirming,
    isContractDeployed,
    castVote,
    claimRewards,
    voteTxHash,
    claimTxHash,
  };
}
