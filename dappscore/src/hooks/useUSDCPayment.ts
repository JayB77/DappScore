'use client';

import { useState } from 'react';
import { useAccount, useChainId, useWriteContract, useReadContract, useWaitForTransactionReceipt } from 'wagmi';
import { CONTRACT_ADDRESSES, ERC20_ABI, PREMIUM_LISTING_PRICE, PAYMENT_RECEIVER } from '@/config/wagmi';
import { baseSepolia } from 'wagmi/chains';

export type PaymentStatus = 'idle' | 'checking' | 'insufficient' | 'ready' | 'transferring' | 'confirming' | 'success' | 'error';

export function useUSDCPayment() {
  const { address } = useAccount();
  const chainId = useChainId();
  const [status, setStatus] = useState<PaymentStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null);

  // Get contract addresses for current chain
  const contracts = CONTRACT_ADDRESSES[chainId as keyof typeof CONTRACT_ADDRESSES] || CONTRACT_ADDRESSES[baseSepolia.id];
  const usdcAddress = contracts.usdc as `0x${string}`;

  // Read USDC balance
  const { data: balance, refetch: refetchBalance } = useReadContract({
    address: usdcAddress,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
    },
  });

  // Write contract for transfer
  const { writeContractAsync, isPending: isWritePending } = useWriteContract();

  // Wait for transaction
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash: txHash ?? undefined,
  });

  const checkBalance = async () => {
    if (!address) {
      setError('Wallet not connected');
      return false;
    }

    setStatus('checking');
    await refetchBalance();

    if (!balance || balance < PREMIUM_LISTING_PRICE) {
      setStatus('insufficient');
      setError(`Insufficient USDC balance. You need ${formatUSDC(PREMIUM_LISTING_PRICE)} USDC.`);
      return false;
    }

    setStatus('ready');
    setError(null);
    return true;
  };

  const payForPremium = async (): Promise<boolean> => {
    if (!address) {
      setError('Wallet not connected');
      return false;
    }

    if (PAYMENT_RECEIVER === '0x0000000000000000000000000000000000000000') {
      setError('Payment receiver not configured');
      return false;
    }

    try {
      setStatus('transferring');
      setError(null);

      const hash = await writeContractAsync({
        address: usdcAddress,
        abi: ERC20_ABI,
        functionName: 'transfer',
        args: [PAYMENT_RECEIVER as `0x${string}`, PREMIUM_LISTING_PRICE],
      });

      setTxHash(hash);
      setStatus('confirming');

      // Wait for confirmation is handled by useWaitForTransactionReceipt
      // The component should check isConfirmed
      return true;
    } catch (err: unknown) {
      console.error('Payment failed:', err);
      setStatus('error');
      if (err instanceof Error) {
        if (err.message.includes('User rejected')) {
          setError('Transaction rejected by user');
        } else if (err.message.includes('insufficient')) {
          setError('Insufficient USDC balance');
        } else {
          setError(err.message);
        }
      } else {
        setError('Payment failed. Please try again.');
      }
      return false;
    }
  };

  const reset = () => {
    setStatus('idle');
    setError(null);
    setTxHash(null);
  };

  return {
    status,
    error,
    txHash,
    balance: balance ?? BigInt(0),
    formattedBalance: formatUSDC(balance ?? BigInt(0)),
    price: PREMIUM_LISTING_PRICE,
    formattedPrice: formatUSDC(PREMIUM_LISTING_PRICE),
    isWritePending,
    isConfirming,
    isConfirmed,
    checkBalance,
    payForPremium,
    reset,
    usdcAddress,
    paymentReceiver: PAYMENT_RECEIVER,
  };
}

// Helper to format USDC (6 decimals)
export function formatUSDC(amount: bigint): string {
  const divisor = BigInt(1_000000);
  const whole = amount / divisor;
  const fraction = amount % divisor;
  const fractionStr = fraction.toString().padStart(6, '0').slice(0, 2);
  return `${whole}.${fractionStr}`;
}
