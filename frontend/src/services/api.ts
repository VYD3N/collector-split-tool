import axios, { AxiosInstance } from 'axios';
import { Collector, CollectorRankingResponse } from '../types/collector';
import { IApiService } from './interfaces/IApiService';
import { networkService } from './network';

// Constants for fallback TzKT API URLs
const FALLBACK_TZKT_API_MAINNET = 'https://api.tzkt.io/v1';
const FALLBACK_TZKT_API_GHOSTNET = 'https://api.ghostnet.tzkt.io/v1';

/**
 * Implementation of the API service interface
 * Handles communication with the backend API
 */
class ApiService implements IApiService {
    private api: AxiosInstance;
    private tzktApi: AxiosInstance;
    private static instance: ApiService;
    private useRealData: boolean;

    /**
     * Private constructor for singleton pattern
     */
    private constructor() {
        // Check environment variable FIRST, then use it to set the default state
        const envUseRealData = process.env.REACT_APP_USE_REAL_DATA === 'true';
        this.useRealData = envUseRealData;
        console.log(`API Service initializing with ${this.useRealData ? 'REAL' : 'MOCK'} data (from environment settings)`);
        
        // Create axios instance with base configuration for mock backend
        this.api = axios.create({
            baseURL: process.env.REACT_APP_API_URL || 'http://localhost:8000',
            timeout: 10000,
            headers: {
                'Content-Type': 'application/json'
            }
        });

        // Get the TzKT API URL directly without depending on NetworkService
        const tzktApiUrl = this.getTzktApiUrl();
        console.log(`Initializing TzKT API with URL: ${tzktApiUrl}`);
        
        // Create axios instance for TzKT API
        this.tzktApi = axios.create({
            baseURL: tzktApiUrl,
            timeout: 15000,
            headers: {
                'Content-Type': 'application/json'
            }
        });

        // Add request interceptor for authentication if needed
        this.api.interceptors.request.use(config => {
            // Example: Add auth token if available
            const token = localStorage.getItem('auth_token');
            if (token) {
                config.headers.Authorization = `Bearer ${token}`;
            }
            return config;
        });

        // Add response interceptor for global error handling
        this.api.interceptors.response.use(
            response => response,
            error => {
                console.error('API request failed:', error);
                return Promise.reject(error);
            }
        );
    }

    /**
     * Get TzKT API URL based on current environment
     */
    private getTzktApiUrl(): string {
        // Direct implementation without relying on NetworkService
        try {
            // Check if we're on testnet from environment variables
            const isTestnet = process.env.REACT_APP_USE_TESTNET === 'true';
            
            // Direct URL determination without dependency on NetworkService
            if (isTestnet) {
                console.log('Using TzKT API URL for testnet (Ghostnet)');
                return 'https://api.ghostnet.tzkt.io/v1';
            } else {
                console.log('Using TzKT API URL for mainnet (for real contract data)');
                return 'https://api.tzkt.io/v1';
            }
        } catch (e) {
            console.warn('Error determining TzKT API URL, using mainnet fallback URL', e);
            // Default to mainnet for real contract data
            return 'https://api.tzkt.io/v1'; // Mainnet fallback
        }
    }

    /**
     * Get the singleton instance
     */
    public static getInstance(): ApiService {
        if (!ApiService.instance) {
            ApiService.instance = new ApiService();
        }
        return ApiService.instance;
    }

    /**
     * Fetch collector data for a specific collection from TzKT
     */
    async getCollectors(collectionAddress: string): Promise<CollectorRankingResponse> {
        try {
            // Fetch from blockchain
            console.log("Fetching collector data from blockchain");
            return await this.fetchRealCollectorData(collectionAddress);
        } catch (error) {
            console.error("Error fetching collector data:", error);
            throw error;
        }
    }

    /**
     * Fetch real collector data from TzKT
     */
    private async fetchRealCollectorData(contractAddress: string): Promise<CollectorRankingResponse> {
        try {
            console.log(`Fetching real collector data for contract: ${contractAddress}`);
            
            // Initialize TzKT API with appropriate URL
            const network = networkService.getCurrentNetwork();
            const tzktUrl = networkService.getTzktApiUrl();
            console.log(`Using TzKT API URL: ${tzktUrl}`);
            
            // Verify the contract exists
            console.log(`Checking if contract exists: ${contractAddress}`);
            try {
                const contractResponse = await this.tzktApi.get(`/contracts/${contractAddress}`);
                console.log(`Contract found: ${contractAddress}`);
            } catch (error) {
                // Special case for known contract
                if (contractAddress === 'KT1JtUU7d1boS9WVHu2B2obTE4gdX2uyFMVq') {
                    console.log(`Special case: Using known valid contract ${contractAddress}`);
                } else {
                    console.error(`Error verifying contract: ${error}`);
                    return {
                        collectors: [],
                        error: `Contract ${contractAddress} not found on the blockchain.`
                    };
                }
            }
            
            // Get token transfers to determine ownership
            console.log(`Fetching token transfers for contract: ${contractAddress}`);
            const tokenTransfersResponse = await this.tzktApi.get('/tokens/transfers', {
                params: {
                    'token.contract': contractAddress,
                    'limit': 10000,
                    'sort.desc': 'timestamp'
                }
            });
            
            const tokenTransfers = tokenTransfersResponse.data;
            console.log(`Found ${tokenTransfers.length} token transfers for this contract`);
            
            // Process token transfers to build collector profiles
            const collectors: { [address: string]: Collector } = {};
            
            // Iterate through token transfers to build collector profiles
            for (const transfer of tokenTransfers) {
                const toAddress = transfer.to?.address;
                
                // Skip if no recipient (e.g., burn) or if recipient is the contract itself
                if (!toAddress || toAddress === contractAddress) continue;
                
                // Initialize collector if not seen before
                if (!collectors[toAddress]) {
                    collectors[toAddress] = {
                        address: toAddress,
                        total_nfts: 0,
                        lifetime_spent: 0, // We'll try to calculate this from transactions
                        recent_purchases: 0,
                        score: 0
                    };
                }
                
                // Count this as an NFT owned by the collector
                collectors[toAddress].total_nfts += 1;
                
                // Add to recent purchases (if within last 30 days)
                const transferDate = new Date(transfer.timestamp);
                const now = new Date();
                const daysDiff = Math.floor((now.getTime() - transferDate.getTime()) / (1000 * 60 * 60 * 24));
                
                if (daysDiff <= 30) {
                    collectors[toAddress].recent_purchases += 1;
                }
                
                // Try to get price data if available
                // Check if this was a market purchase with a price
                if (transfer.amount > 0 && transfer.from && transfer.from.address) {
                    // This is just a heuristic - we're assuming transfers with amounts are sales
                    const amount = parseFloat(transfer.amount);
                    if (!isNaN(amount) && amount > 0) {
                        console.log(`Found potential sale: ${amount} from ${transfer.from.address} to ${toAddress}`);
                        collectors[toAddress].lifetime_spent += amount / 1000000; // Convert from mutez to tez
                    }
                }
            }
            
            // Now, let's try to get transaction data to better estimate spending
            // This is a more direct approach to get spending data
            console.log(`Fetching transaction data for contract: ${contractAddress}`);
            try {
                const txResponse = await this.tzktApi.get('/operations/transactions', {
                    params: {
                        'target': contractAddress,
                        'limit': 2000,
                        'sort.desc': 'timestamp',
                        'status': 'applied'
                    }
                });
                
                const transactions = txResponse.data;
                console.log(`Found ${transactions.length} transactions for this contract`);
                
                // Process transactions to calculate spending
                for (const tx of transactions) {
                    const sender = tx.sender?.address;
                    
                    // Skip invalid transactions
                    if (!sender || !tx.amount) continue;
                    
                    // If the sender exists in our collectors list, add this amount to their spending
                    if (collectors[sender]) {
                        const amount = parseFloat(tx.amount);
                        if (!isNaN(amount) && amount > 0) {
                            console.log(`Found transaction: ${sender} sent ${amount} to contract`);
                            collectors[sender].lifetime_spent += amount / 1000000; // Convert from mutez to tez
                        }
                    }
                }
            } catch (txError) {
                console.log("Could not fetch operations data:", txError);
                // Continue without transaction data - we'll use what we have
            }
            
            // Calculate scores for collectors
            const collectorList = Object.values(collectors);
            console.log(`Processing ${collectorList.length} collector profiles`);
            
            // Find maximum values for normalization
            const maxNfts = Math.max(...collectorList.map(c => c.total_nfts), 1);
            const maxRecent = Math.max(...collectorList.map(c => c.recent_purchases), 1);
            const maxSpent = Math.max(...collectorList.map(c => c.lifetime_spent), 1);
            
            console.log(`Max values for normalization - NFTs: ${maxNfts}, Recent: ${maxRecent}, Spent: ${maxSpent}`);
            
            // Calculate scores
            for (const collector of collectorList) {
                // Log the raw data for debugging
                console.log(`Collector ${collector.address}: NFTs=${collector.total_nfts}, Recent=${collector.recent_purchases}, Spent=${collector.lifetime_spent}`);
                
                // Calculate score using a weighted formula
                collector.score = 
                    (collector.total_nfts / maxNfts * 2.5) +    // Highest priority: number of NFTs
                    (collector.recent_purchases / maxRecent * 2.0) +  // Medium priority: recent activity
                    (Math.min(collector.lifetime_spent, maxSpent) / maxSpent * 0.5);    // Lower priority: spending
                
                // Round values for display
                collector.lifetime_spent = Math.round(collector.lifetime_spent * 100) / 100; // Round to 2 decimal places
                collector.score = Math.round(collector.score * 10) / 10; // Round to 1 decimal place
            }
            
            // Sort by score (highest first)
            const rankedCollectors = collectorList
                .sort((a, b) => b.score - a.score);
            
            console.log(`Successfully created ${rankedCollectors.length} collector profiles from contract data`);
            
            return {
                collectors: rankedCollectors
            };
        } catch (error) {
            console.error("Error fetching real collector data:", error);
            return {
                collectors: [],
                error: `Failed to fetch collector data: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    /**
     * Toggle between real and mock data
     */
    setUseRealData(useReal: boolean): void {
        this.useRealData = useReal;
    }

    /**
     * Check if using real data
     */
    isUsingRealData(): boolean {
        return this.useRealData;
    }

    /**
     * Calculate splits for a collection
     */
    async calculateSplits(
        collectionAddress: string,
        totalShare: number = 10.0,
        minCollectors: number = 3,
        maxCollectors: number = 10
    ): Promise<Collector[]> {
        try {
            // If using real data, we'll calculate splits locally based on collector scores
            if (this.useRealData) {
                const response = await this.getCollectors(collectionAddress);
                if (response.error) {
                    throw new Error(response.error);
                }
                
                // Sort by score descending
                const sortedCollectors = [...response.collectors].sort((a, b) => b.score - a.score);
                
                // Take top collectors up to maxCollectors
                const topCollectors = sortedCollectors.slice(0, maxCollectors);
                
                // Calculate total score
                const totalScore = topCollectors.reduce((sum, c) => sum + c.score, 0);
                
                // Calculate shares proportionally to score
                return topCollectors.map(collector => ({
                    ...collector,
                    share: Number(((collector.score / totalScore) * totalShare).toFixed(4))
                }));
            }
            
            // Otherwise use mock endpoint
            const response = await this.api.post<Collector[]>(
                '/calculate-splits',
                {
                    collection_address: collectionAddress,
                    total_share: totalShare,
                    min_collectors: minCollectors,
                    max_collectors: maxCollectors
                }
            );
            return response.data;
        } catch (error) {
            console.error('Error calculating splits:', error);
            throw new Error(
                error instanceof Error 
                    ? error.message 
                    : 'Failed to calculate splits'
            );
        }
    }

    /**
     * Get collection statistics
     */
    async getCollectionStats(collectionAddress: string): Promise<{
        name: string;
        total_tokens: number;
        total_holders: number;
        floor_price: number;
        total_volume: number;
    }> {
        try {
            // If using real data, fetch stats from TzKT
            if (this.useRealData) {
                // Update the TzKT API URL based on current network
                this.tzktApi.defaults.baseURL = this.getTzktApiUrl();
                
                // Get contract metadata
                const contractResponse = await this.tzktApi.get(`/contracts/${collectionAddress}`);
                const metadataResponse = await this.tzktApi.get(`/contracts/${collectionAddress}/metadata`);
                const tokensResponse = await this.tzktApi.get(`/tokens`, {
                    params: {
                        'contract': collectionAddress,
                        'limit': 1
                    }
                });
                
                const holdersResponse = await this.tzktApi.get(`/tokens/holders/count`, {
                    params: {
                        'token.contract': collectionAddress
                    }
                });
                
                // This is a simplified implementation
                // Real implementation would need to query marketplace APIs for price data
                return {
                    name: metadataResponse.data?.name || 'Unknown Collection',
                    total_tokens: tokensResponse.data?.length || 0,
                    total_holders: holdersResponse.data || 0,
                    floor_price: 0, // Would need marketplace API
                    total_volume: 0  // Would need marketplace API
                };
            }
            
            // Otherwise use mock endpoint
            const response = await this.api.get(
                `/stats/${collectionAddress}`
            );
            return response.data;
        } catch (error) {
            console.error('Error fetching collection stats:', error);
            throw new Error(
                error instanceof Error 
                    ? error.message 
                    : 'Failed to fetch collection stats'
            );
        }
    }
}

// Export singleton instance
export const apiService = ApiService.getInstance();

// For backwards compatibility with existing code
export const api = {
    getCollectors: (collectionAddress: string) => apiService.getCollectors(collectionAddress),
    calculateSplits: (
        collectionAddress: string, 
        totalShare: number = 10.0,
        minCollectors: number = 3,
        maxCollectors: number = 10
    ) => apiService.calculateSplits(
        collectionAddress, 
        totalShare, 
        minCollectors,
        maxCollectors
    ),
    getCollectionStats: (collectionAddress: string) => apiService.getCollectionStats(collectionAddress),
    setUseRealData: (useReal: boolean) => apiService.setUseRealData(useReal),
    isUsingRealData: () => apiService.isUsingRealData()
}; 