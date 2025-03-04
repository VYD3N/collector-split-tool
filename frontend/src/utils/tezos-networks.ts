import { NetworkType as BeaconNetworkType } from "@airgap/beacon-sdk";
import { NetworkType } from "../config/networks";

/**
 * Tezos network information
 */
export interface TezosNetworkInfo {
  name: string;
  type: NetworkType;
  description: string;
  rpcUrl: string;
  blockExplorerUrl: string;
  faucetUrl?: string;
  isTest: boolean;
  chainId?: string;
  icon?: string;
}

/**
 * Tezos network configurations
 */
export const TEZOS_NETWORKS: Record<string, TezosNetworkInfo> = {
  mainnet: {
    name: "Mainnet",
    type: "mainnet" as NetworkType,
    description: "Tezos main network",
    rpcUrl: "https://mainnet.api.tez.ie",
    blockExplorerUrl: "https://tzkt.io",
    isTest: false,
    chainId: "NetXdQprcVkpaWU"
  },
  ghostnet: {
    name: "Ghostnet",
    type: "ghostnet" as NetworkType,
    description: "Tezos test network (Ghostnet)",
    rpcUrl: "https://ghostnet.ecadinfra.com",
    blockExplorerUrl: "https://ghostnet.tzkt.io",
    faucetUrl: "https://faucet.ghostnet.teztnets.xyz/",
    isTest: true,
    chainId: "NetXLH1uAxK7CCh"
  },
  custom: {
    name: "Custom",
    type: "custom" as NetworkType,
    description: "Custom Tezos network",
    rpcUrl: "",
    blockExplorerUrl: "",
    isTest: true
  }
};

/**
 * Get information about a Tezos network
 * @param network The network type
 * @returns Network information
 */
export function getNetworkInfo(network: NetworkType): TezosNetworkInfo {
  return TEZOS_NETWORKS[network as string] || TEZOS_NETWORKS.mainnet;
}

/**
 * Check if a network is a testnet
 * @param network The network to check
 * @returns True if the network is a testnet
 */
export function isTestnet(network: NetworkType): boolean {
  const info = getNetworkInfo(network);
  return info.isTest;
}

/**
 * Get a block explorer URL for a transaction hash
 * @param hash The transaction hash
 * @param network The network type
 * @returns Block explorer URL
 */
export function getTransactionExplorerUrl(hash: string, network: NetworkType): string {
  const info = getNetworkInfo(network);
  return `${info.blockExplorerUrl}/operations/${hash}`;
}

/**
 * Get a block explorer URL for an address
 * @param address The address to view
 * @param network The network type
 * @returns Block explorer URL
 */
export function getAddressExplorerUrl(address: string, network: NetworkType): string {
  const info = getNetworkInfo(network);
  return `${info.blockExplorerUrl}/addresses/${address}`;
}

/**
 * Get a faucet URL for a testnet
 * @param network The network type
 * @returns Faucet URL or undefined if not available
 */
export function getFaucetUrl(network: NetworkType): string | undefined {
  const info = getNetworkInfo(network);
  return info.faucetUrl;
} 