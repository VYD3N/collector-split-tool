import { TezosToolkit } from "@taquito/taquito";
import { BeaconWallet } from "@taquito/beacon-wallet";
import { NetworkType as BeaconNetworkType } from "@airgap/beacon-sdk";
import { NetworkConfig, DEFAULT_NETWORK, NetworkType, networks, DEFAULT_NETWORK_CONFIG } from "../config/networks";

// Import getNetworkConfig directly from the file
import { getNetworkConfig } from "../config/networks";

/**
 * Convert our custom NetworkType to Beacon's NetworkType
 */
export function toBeaconNetworkType(network: NetworkType): BeaconNetworkType {
    if (network === 'mainnet') return 'mainnet' as BeaconNetworkType;
    if (network === 'ghostnet') return 'custom' as BeaconNetworkType;
    return network as unknown as BeaconNetworkType;
}

/**
 * Service for managing network configurations and switching between networks
 */
export class NetworkService {
    private static instance: NetworkService;
    private currentNetwork: NetworkType;
    private tezos: TezosToolkit;
    private wallet: BeaconWallet | null = null;
    private storageKey = 'preferred_network'; // Key for localStorage
    private initializationComplete = false;

    private constructor() {
        this.currentNetwork = DEFAULT_NETWORK; // Safe default
        this.tezos = new TezosToolkit("https://mainnet.api.tez.ie"); // Safe default

        try {
            // Try to load saved network preference
            const savedNetwork = this.loadNetworkPreference();
            
            // Ensure we have a valid network type, with strong validation
            const validNetwork = savedNetwork && 
                typeof savedNetwork === 'string' && 
                Object.keys(networks).includes(savedNetwork) ? 
                savedNetwork as NetworkType : 
                DEFAULT_NETWORK;
            
            this.currentNetwork = validNetwork;
            
            // Get configuration with guaranteed fallback
            const config = this.getSafeNetworkConfig(this.currentNetwork);
            
            // Initialize TezosToolkit with the RPC URL
            this.tezos = new TezosToolkit(config.rpcUrl);
            
            // Mark initialization as complete
            this.initializationComplete = true;
        } catch (error) {
            console.error("Error initializing NetworkService:", error);
            // We already have safe defaults set above
        }
    }

    // Safe method to get network config that won't crash if networks[type] is undefined
    private getSafeNetworkConfig(type: NetworkType): NetworkConfig {
        // Verify networks object exists
        if (!networks) {
            console.error("Networks object is undefined!");
            return DEFAULT_NETWORK_CONFIG;
        }
        
        // Check if the network exists in our networks object
        if (typeof type === 'string' && Object.keys(networks).includes(type)) {
            return networks[type];
        }
        
        // Fallback to default config
        return DEFAULT_NETWORK_CONFIG;
    }

    public static getInstance(): NetworkService {
        if (!NetworkService.instance) {
            try {
                NetworkService.instance = new NetworkService();
            } catch (error) {
                console.error("Failed to create NetworkService instance:", error);
                // Create minimal working instance
                NetworkService.instance = Object.create(NetworkService.prototype);
                NetworkService.instance.currentNetwork = DEFAULT_NETWORK;
                NetworkService.instance.tezos = new TezosToolkit("https://mainnet.api.tez.ie");
                NetworkService.instance.wallet = null;
                NetworkService.instance.storageKey = 'preferred_network';
                NetworkService.instance.initializationComplete = false;
            }
        }
        return NetworkService.instance;
    }

    /**
     * Get the current network configuration
     */
    getNetworkConfig(): NetworkConfig {
        return this.getSafeNetworkConfig(this.currentNetwork);
    }

    /**
     * Get the current network type
     */
    getCurrentNetwork(): NetworkType {
        return this.currentNetwork || DEFAULT_NETWORK;
    }

    /**
     * Set the network to use (with persistence)
     */
    setNetwork(network: NetworkType): void {
        try {
            if (!network || typeof network !== 'string') {
                console.error('Invalid network type provided, not switching');
                return;
            }
            
            console.log(`Attempting to switch to network: ${network}`);
            
            // Verify networks object exists
            if (!networks) {
                console.error("Networks object is undefined, cannot switch network!");
                return;
            }
            
            // Check if the network exists in our networks object
            if (!Object.keys(networks).includes(network)) {
                console.error(`Network "${network}" not found in networks config!`);
                return;
            }
            
            this.currentNetwork = network;
            
            // Get network config safely
            const config = this.getSafeNetworkConfig(network);
            console.log(`Switching to network: ${network}, RPC URL: ${config.rpcUrl}`);
            
            // Initialize TezosToolkit
            this.tezos = new TezosToolkit(config.rpcUrl);
            
            // Save preference to localStorage
            this.saveNetworkPreference(network);
        } catch (error) {
            console.error("Error setting network:", error);
        }
    }

    /**
     * Set the wallet for the network service
     */
    setWallet(wallet: BeaconWallet): void {
        this.wallet = wallet;
        this.tezos.setWalletProvider(wallet);
        
        // Network will be synced when connecting the wallet
    }

    /**
     * Get the Tezos toolkit for the current network
     */
    getTezos(): TezosToolkit {
        return this.tezos;
    }

    /**
     * Get the contract address for the given contract name
     */
    getContractAddress(contractName: 'openEdition'): string {
        try {
            const config = this.getNetworkConfig();
            return config.contracts[contractName] || '';
        } catch (error) {
            console.error("Error getting contract address:", error);
            return '';
        }
    }

    /**
     * Get the block explorer URL for a transaction hash
     */
    getTransactionUrl(hash: string): string {
        try {
            const config = this.getNetworkConfig();
            return `${config.blockExplorerUrl}/operations/${hash}`;
        } catch (error) {
            console.error("Error getting transaction URL:", error);
            return `https://tzkt.io/operations/${hash}`;
        }
    }

    /**
     * Get the block explorer URL for an address
     */
    getAddressUrl(address: string): string {
        try {
            const config = this.getNetworkConfig();
            return `${config.blockExplorerUrl}/addresses/${address}`;
        } catch (error) {
            console.error("Error getting address URL:", error);
            return `https://tzkt.io/addresses/${address}`;
        }
    }

    /**
     * Check if the network is a testnet
     */
    isTestnet(): boolean {
        return this.currentNetwork === 'ghostnet' || this.currentNetwork === 'custom';
    }

    /**
     * Get the TzKT API URL for the current network
     */
    getTzktApiUrl(): string {
        try {
            return this.getNetworkConfig().tzktUrl;
        } catch (error) {
            console.error("Error getting TzKT API URL:", error);
            return 'https://api.tzkt.io/v1';
        }
    }

    /**
     * Load network preference from localStorage
     */
    private loadNetworkPreference(): NetworkType | null {
        try {
            const saved = localStorage.getItem(this.storageKey);
            if (saved && typeof saved === 'string') {
                // Validate that it's actually a NetworkType
                if (['mainnet', 'ghostnet', 'custom'].includes(saved) || 
                    Object.values(BeaconNetworkType).includes(saved as BeaconNetworkType)) {
                    return saved as NetworkType;
                }
            }
            return null;
        } catch (error) {
            console.error('Error loading network preference:', error);
            return null;
        }
    }

    /**
     * Save network preference to localStorage
     */
    private saveNetworkPreference(network: NetworkType): void {
        try {
            localStorage.setItem(this.storageKey, network);
        } catch (error) {
            console.error('Error saving network preference:', error);
        }
    }

    /**
     * Check if initialization completed successfully
     */
    isInitialized(): boolean {
        return this.initializationComplete;
    }
}

// Export singleton instance
export const networkService = NetworkService.getInstance(); 