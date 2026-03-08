import type { ChainConfig } from './types';

/**
 * Master chain registry.
 * Keys are lowercase chain name / ticker aliases.
 * Add new chains here — the rest of the codebase picks them up automatically.
 */
export const CHAINS: Record<string, ChainConfig> = {

  // ── Ethereum & major L2s ──────────────────────────────────────────────────
  ethereum:           { apiBase: 'https://api.etherscan.io/api',                  explorerBase: 'https://etherscan.io',               family: 'evm' },
  eth:                { apiBase: 'https://api.etherscan.io/api',                  explorerBase: 'https://etherscan.io',               family: 'evm' },
  base:               { apiBase: 'https://api.basescan.org/api',                  explorerBase: 'https://basescan.org',               family: 'evm' },
  arbitrum:           { apiBase: 'https://api.arbiscan.io/api',                   explorerBase: 'https://arbiscan.io',                family: 'evm' },
  'arbitrum one':     { apiBase: 'https://api.arbiscan.io/api',                   explorerBase: 'https://arbiscan.io',                family: 'evm' },
  'arbitrum nova':    { apiBase: 'https://api-nova.arbiscan.io/api',              explorerBase: 'https://nova.arbiscan.io',           family: 'evm' },
  optimism:           { apiBase: 'https://api-optimistic.etherscan.io/api',       explorerBase: 'https://optimistic.etherscan.io',    family: 'evm' },
  'op mainnet':       { apiBase: 'https://api-optimistic.etherscan.io/api',       explorerBase: 'https://optimistic.etherscan.io',    family: 'evm' },
  blast:              { apiBase: 'https://api.blastscan.io/api',                  explorerBase: 'https://blastscan.io',               family: 'evm' },
  linea:              { apiBase: 'https://api.lineascan.build/api',               explorerBase: 'https://lineascan.build',            family: 'evm' },
  scroll:             { apiBase: 'https://api.scrollscan.com/api',                explorerBase: 'https://scrollscan.com',             family: 'evm' },
  'zksync era':       { apiBase: 'https://api-era.zksync.network/api',            explorerBase: 'https://era.zksync.network',         family: 'evm' },
  zksync:             { apiBase: 'https://api-era.zksync.network/api',            explorerBase: 'https://era.zksync.network',         family: 'evm' },
  mantle:             { apiBase: 'https://api.mantlescan.xyz/api',                explorerBase: 'https://mantlescan.xyz',             family: 'evm' },
  mode:               { apiBase: 'https://api.modescan.io/api',                   explorerBase: 'https://modescan.io',                family: 'evm' },
  taiko:              { apiBase: 'https://api.taikoscan.io/api',                  explorerBase: 'https://taikoscan.io',               family: 'evm' },
  fraxtal:            { apiBase: 'https://api.fraxscan.com/api',                  explorerBase: 'https://fraxscan.com',               family: 'evm' },
  'manta pacific':    { apiBase: 'https://pacific-explorer.manta.network/api',    explorerBase: 'https://pacific-explorer.manta.network', family: 'evm' },
  manta:              { apiBase: 'https://pacific-explorer.manta.network/api',    explorerBase: 'https://pacific-explorer.manta.network', family: 'evm' },
  metis:              { apiBase: 'https://andromeda-explorer.metis.io/api',       explorerBase: 'https://andromeda-explorer.metis.io',    family: 'evm' },
  boba:               { apiBase: 'https://api.bobascan.com/api',                  explorerBase: 'https://bobascan.com',               family: 'evm' },
  'x layer':          { apiBase: 'https://www.xlayerscan.com/api',                explorerBase: 'https://www.xlayerscan.com',          family: 'evm' },
  xlayer:             { apiBase: 'https://www.xlayerscan.com/api',                explorerBase: 'https://www.xlayerscan.com',          family: 'evm' },
  'merlin chain':     { apiBase: 'https://scan.merlinchain.io/api',               explorerBase: 'https://scan.merlinchain.io',        family: 'evm' },
  merlin:             { apiBase: 'https://scan.merlinchain.io/api',               explorerBase: 'https://scan.merlinchain.io',        family: 'evm' },

  // ── EVM sidechains & app-chains ──────────────────────────────────────────
  polygon:            { apiBase: 'https://api.polygonscan.com/api',               explorerBase: 'https://polygonscan.com',            family: 'evm' },
  matic:              { apiBase: 'https://api.polygonscan.com/api',               explorerBase: 'https://polygonscan.com',            family: 'evm' },
  'polygon zkevm':    { apiBase: 'https://api-zkevm.polygonscan.com/api',         explorerBase: 'https://zkevm.polygonscan.com',      family: 'evm' },
  bsc:                { apiBase: 'https://api.bscscan.com/api',                   explorerBase: 'https://bscscan.com',                family: 'evm' },
  'bnb smart chain':  { apiBase: 'https://api.bscscan.com/api',                   explorerBase: 'https://bscscan.com',                family: 'evm' },
  bnb:                { apiBase: 'https://api.bscscan.com/api',                   explorerBase: 'https://bscscan.com',                family: 'evm' },
  'opbnb':            { apiBase: 'https://api-opbnb.bscscan.com/api',             explorerBase: 'https://opbnb.bscscan.com',          family: 'evm' },
  avalanche:          { apiBase: 'https://api.snowtrace.io/api',                  explorerBase: 'https://snowtrace.io',               family: 'evm' },
  avax:               { apiBase: 'https://api.snowtrace.io/api',                  explorerBase: 'https://snowtrace.io',               family: 'evm' },
  fantom:             { apiBase: 'https://api.ftmscan.com/api',                   explorerBase: 'https://ftmscan.com',                family: 'evm' },
  ftm:                { apiBase: 'https://api.ftmscan.com/api',                   explorerBase: 'https://ftmscan.com',                family: 'evm' },
  sonic:              { apiBase: 'https://api.sonicscan.org/api',                 explorerBase: 'https://sonicscan.org',              family: 'evm' },
  celo:               { apiBase: 'https://api.celoscan.io/api',                   explorerBase: 'https://celoscan.io',                family: 'evm' },
  gnosis:             { apiBase: 'https://api.gnosisscan.io/api',                 explorerBase: 'https://gnosisscan.io',              family: 'evm' },
  xdai:               { apiBase: 'https://api.gnosisscan.io/api',                 explorerBase: 'https://gnosisscan.io',              family: 'evm' },
  cronos:             { apiBase: 'https://api.cronoscan.com/api',                 explorerBase: 'https://cronoscan.com',              family: 'evm' },
  cro:                { apiBase: 'https://api.cronoscan.com/api',                 explorerBase: 'https://cronoscan.com',              family: 'evm' },
  moonbeam:           { apiBase: 'https://api.moonscan.io/api',                   explorerBase: 'https://moonscan.io',                family: 'evm' },
  glmr:               { apiBase: 'https://api.moonscan.io/api',                   explorerBase: 'https://moonscan.io',                family: 'evm' },
  moonriver:          { apiBase: 'https://api-moonriver.moonscan.io/api',         explorerBase: 'https://moonriver.moonscan.io',      family: 'evm' },
  movr:               { apiBase: 'https://api-moonriver.moonscan.io/api',         explorerBase: 'https://moonriver.moonscan.io',      family: 'evm' },
  kava:               { apiBase: 'https://kavascan.com/api',                      explorerBase: 'https://kavascan.com',               family: 'evm' },
  aurora:             { apiBase: 'https://explorer.aurora.dev/api',               explorerBase: 'https://explorer.aurora.dev',        family: 'evm' },
  'aurora evm':       { apiBase: 'https://explorer.aurora.dev/api',               explorerBase: 'https://explorer.aurora.dev',        family: 'evm' },
  core:               { apiBase: 'https://openapi.coredao.org/api',               explorerBase: 'https://scan.coredao.org',           family: 'evm' },
  'core dao':         { apiBase: 'https://openapi.coredao.org/api',               explorerBase: 'https://scan.coredao.org',           family: 'evm' },
  kaia:               { apiBase: 'https://api-cypress.klaytnscope.com/api',       explorerBase: 'https://kaiascan.io',                family: 'evm' },
  klaytn:             { apiBase: 'https://api-cypress.klaytnscope.com/api',       explorerBase: 'https://kaiascan.io',                family: 'evm' },
  wemix:              { apiBase: 'https://api.wemixscan.com/api',                 explorerBase: 'https://wemixscan.com',              family: 'evm' },
  'neon evm':         { apiBase: 'https://neonscan.org/api',                      explorerBase: 'https://neonscan.org',               family: 'evm' },
  'sei evm':          { apiBase: 'https://seitrace.com/api',                      explorerBase: 'https://seitrace.com',               family: 'evm' },
  sei:                { apiBase: 'https://seitrace.com/api',                      explorerBase: 'https://seitrace.com',               family: 'evm' },
  berachain:          {                                                            explorerBase: 'https://berascan.com',               family: 'evm' },
  bera:               {                                                            explorerBase: 'https://berascan.com',               family: 'evm' },
  rootstock:          {                                                            explorerBase: 'https://rootstock.blockscout.com',   family: 'evm' },
  rsk:                {                                                            explorerBase: 'https://rootstock.blockscout.com',   family: 'evm' },
  bob:                { apiBase: 'https://explorer.gobob.xyz/api/v2',             explorerBase: 'https://explorer.gobob.xyz',          family: 'evm' },
  'build on bitcoin': { apiBase: 'https://explorer.gobob.xyz/api/v2',             explorerBase: 'https://explorer.gobob.xyz',          family: 'evm' },
  'world chain':      { apiBase: 'https://worldchain-mainnet.explorer.alchemy.com/api/v2', explorerBase: 'https://worldscan.org',       family: 'evm' },
  worldchain:         { apiBase: 'https://worldchain-mainnet.explorer.alchemy.com/api/v2', explorerBase: 'https://worldscan.org',       family: 'evm' },
  soneium:            { apiBase: 'https://soneium.blockscout.com/api/v2',         explorerBase: 'https://soneium.blockscout.com',      family: 'evm' },
  'immutable zkevm':  { apiBase: 'https://explorer.immutable.com/api/v2',         explorerBase: 'https://explorer.immutable.com',      family: 'evm' },
  immutable:          { apiBase: 'https://explorer.immutable.com/api/v2',         explorerBase: 'https://explorer.immutable.com',      family: 'evm' },

  // ── Solana ────────────────────────────────────────────────────────────────
  solana:             { explorerBase: 'https://solscan.io',                       family: 'solana' },
  sol:                { explorerBase: 'https://solscan.io',                       family: 'solana' },

  // ── Tron ──────────────────────────────────────────────────────────────────
  tron:               { explorerBase: 'https://tronscan.org',                     family: 'tron' },
  trx:                { explorerBase: 'https://tronscan.org',                     family: 'tron' },

  // ── TON ───────────────────────────────────────────────────────────────────
  ton:                { explorerBase: 'https://tonscan.org',                      family: 'ton' },

};

export function getChainConfig(chain: string): ChainConfig | null {
  return CHAINS[chain.toLowerCase()] ?? null;
}
