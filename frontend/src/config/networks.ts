import { NetworkType as BeaconNetworkType } from "@airgap/beacon-sdk";

// Extend the NetworkType to include our custom network types
export type NetworkType = BeaconNetworkType | 'ghostnet' | 'custom';

/**
 * Network configuration interface
 */
export interface NetworkConfig {
  name: string;
  type: NetworkType;
  rpcUrl: string;
  indexerUrl: string;
  tzktUrl: string;
  blockExplorerUrl: string;
  contracts: {
    [key: string]: string;
  };
}

// Define a type for the networks record
export type NetworksRecord = {
  [key in string]: NetworkConfig;
}

// Default configuration for fallback
export const DEFAULT_NETWORK_CONFIG: NetworkConfig = {
  name: "Mainnet (Fallback)",
  type: "mainnet" as NetworkType,
  rpcUrl: "https://mainnet.api.tez.ie",
  indexerUrl: "https://api.tzkt.io",
  tzktUrl: "https://api.tzkt.io/v1",
  blockExplorerUrl: "https://tzkt.io",
  contracts: {
    openEdition: process.env.REACT_APP_CONTRACT_ADDRESS_MAINNET || "KT1JtUU7d1boS9WVHu2B2obTE4gdX2uyFMVq"
  }
};

/**
 * Network configurations
 */
export const networks: NetworksRecord = {
  mainnet: {
    name: "Mainnet",
    type: "mainnet" as NetworkType,
    rpcUrl: "https://mainnet.api.tez.ie",
    indexerUrl: "https://api.tzkt.io",
    tzktUrl: "https://api.tzkt.io/v1",
    blockExplorerUrl: "https://tzkt.io",
    contracts: {
      openEdition: process.env.REACT_APP_CONTRACT_ADDRESS_MAINNET || "KT1JtUU7d1boS9WVHu2B2obTE4gdX2uyFMVq"
    }
  },
  ghostnet: {
    name: "Ghostnet (Testnet)",
    type: "ghostnet" as NetworkType,
    rpcUrl: "https://ghostnet.ecadinfra.com",
    indexerUrl: "https://api.ghostnet.tzkt.io",
    tzktUrl: "https://api.ghostnet.tzkt.io/v1",
    blockExplorerUrl: "https://ghostnet.tzkt.io",
    contracts: {
      openEdition: process.env.REACT_APP_CONTRACT_ADDRESS_GHOSTNET || "KT1FSPCgwcZfjzSnpeWjCE12p1ghbHyvUK94"
    }
  },
  custom: {
    name: "Custom Network",
    type: "custom" as NetworkType,
    rpcUrl: process.env.REACT_APP_CUSTOM_RPC_URL || "https://ghostnet.ecadinfra.com",
    indexerUrl: process.env.REACT_APP_CUSTOM_INDEXER_URL || "https://api.ghostnet.tzkt.io",
    tzktUrl: process.env.REACT_APP_CUSTOM_TZKT_URL || "https://api.ghostnet.tzkt.io/v1",
    blockExplorerUrl: process.env.REACT_APP_CUSTOM_EXPLORER_URL || "https://ghostnet.tzkt.io",
    contracts: {
      openEdition: process.env.REACT_APP_CUSTOM_CONTRACT || "KT1FSPCgwcZfjzSnpeWjCE12p1ghbHyvUK94"
    }
  }
};

// Initialize missing networks with defaults if needed
Object.values(BeaconNetworkType).forEach(networkType => {
  if (!networks[networkType]) {
    networks[networkType] = {
      ...DEFAULT_NETWORK_CONFIG,
      name: `${networkType} (Auto-generated)`,
      type: networkType as NetworkType
    };
  }
});

/**
 * Get network configuration with reliable fallback
 */
export function getNetworkConfig(type: NetworkType): NetworkConfig {
  // Make sure we have a valid type
  if (!type || typeof type !== 'string') {
    console.warn('Invalid network type provided, using default');
    return DEFAULT_NETWORK_CONFIG;
  }
  
  // Check if network exists
  if (!networks[type]) {
    console.warn(`Network ${type} not found, using default`);
    return DEFAULT_NETWORK_CONFIG;
  }
  
  return networks[type];
}

/**
 * Default network to use
 */
export const DEFAULT_NETWORK: NetworkType = 
  (process.env.NODE_ENV === 'development' || process.env.REACT_APP_USE_TESTNET === 'true')
    ? 'ghostnet' as NetworkType
    : 'mainnet' as NetworkType;

/**
 * Get block explorer URL for a transaction
 */
export function getTransactionUrl(hash: string, network: NetworkType = DEFAULT_NETWORK): string {
  const config = getNetworkConfig(network);
  return `${config.blockExplorerUrl}/operations/${hash}`;
}

/**
 * Get block explorer URL for an address
 */
export function getAddressUrl(address: string, network: NetworkType = DEFAULT_NETWORK): string {
  const config = getNetworkConfig(network);
  return `${config.blockExplorerUrl}/addresses/${address}`;
} 