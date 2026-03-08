export interface SaleData {
  raised: number;           // Amount raised so far (in `currency` units)
  goal: number;             // Hard cap (in `currency` units)
  currency: string;         // 'USDC' | 'ETH' | 'BNB' etc.
  tokenPrice: number;       // Price per token in USD
  startDate: number;        // Unix timestamp (seconds)
  endDate: number;          // Unix timestamp (seconds)
  minContribution?: number;
  maxContribution?: number;
  saleContract?: string;    // Optional: on-chain sale contract address
  network?: string;         // Chain name e.g. 'Ethereum', 'Base'
  updatedAt: number;        // Unix timestamp — last write
}
