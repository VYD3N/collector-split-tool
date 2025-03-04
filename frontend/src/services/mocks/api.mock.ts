import { 
  IApiService, 
  CollectorResponse, 
  CollectionStats, 
  SplitCalculationParams, 
  SplitResponse 
} from '../abstractions/api.interface';
import { Collector } from '../../types/collector';

/**
 * Mock API service implementation for testing
 */
export class MockApiService implements IApiService {
  private cache: Map<string, {data: any, timestamp: number}> = new Map();
  private cacheTTL: number = 300; // 5 minutes default
  
  // Default mock data
  private mockCollectors: Collector[] = [
    {
      address: 'tz1test1',
      total_nfts: 10,
      lifetime_spent: 100.5,
      recent_purchases: 50.25,
      score: 0.85
    },
    {
      address: 'tz1test2',
      total_nfts: 5,
      lifetime_spent: 50.25,
      recent_purchases: 20.0,
      score: 0.65
    },
    {
      address: 'tz1test3',
      total_nfts: 3,
      lifetime_spent: 30.0,
      recent_purchases: 10.0,
      score: 0.45
    }
  ];
  
  private mockStats: CollectionStats = {
    name: 'Test Collection',
    total_tokens: 100,
    total_holders: 50,
    floor_price: 10.0,
    total_volume: 1000.0
  };

  // Flag to simulate network errors
  private simulateError: boolean = false;
  
  /**
   * Set whether to simulate network errors
   */
  setSimulateError(value: boolean): void {
    this.simulateError = value;
  }
  
  /**
   * Get collectors for a collection
   */
  async getCollectors(collectionAddress: string): Promise<CollectorResponse> {
    // Check cache first
    const cacheKey = `collectors_${collectionAddress}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;
    
    // Simulate network error if enabled
    if (this.simulateError) {
      return {
        collectors: [],
        error: 'Network error fetching collectors'
      };
    }
    
    // Return mock data with slight delay to simulate network
    await this.delay(300);
    
    const result = {
      collectors: this.mockCollectors
    };
    
    // Store in cache
    this.setInCache(cacheKey, result);
    
    return result;
  }
  
  /**
   * Get collection stats
   */
  async getCollectionStats(collectionAddress: string): Promise<CollectionStats> {
    // Check cache first
    const cacheKey = `stats_${collectionAddress}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;
    
    // Simulate network error if enabled
    if (this.simulateError) {
      throw new Error('Network error fetching collection stats');
    }
    
    // Return mock data with slight delay to simulate network
    await this.delay(300);
    
    // Store in cache
    this.setInCache(cacheKey, this.mockStats);
    
    return this.mockStats;
  }
  
  /**
   * Calculate splits for collectors
   */
  async calculateSplits(params: SplitCalculationParams): Promise<SplitResponse> {
    // Check cache first
    const cacheKey = `splits_${params.collection_address}_${params.total_share}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;
    
    // Simulate network error if enabled
    if (this.simulateError) {
      return {
        collectors: [],
        error: 'Network error calculating splits'
      };
    }
    
    // Return mock data with slight delay to simulate network
    await this.delay(500);
    
    // Get collectors first
    const collectorResponse = await this.getCollectors(params.collection_address);
    
    // Sort by score and limit by min/max collectors
    const sorted = [...collectorResponse.collectors].sort((a, b) => b.score - a.score);
    const count = Math.min(
      Math.max(params.min_collectors, 1),
      Math.min(params.max_collectors, sorted.length)
    );
    
    // Get top collectors
    const topCollectors = sorted.slice(0, count);
    
    // Calculate shares
    const totalScore = topCollectors.reduce((sum, c) => sum + c.score, 0);
    const collectorsWithShares = topCollectors.map(c => ({
      ...c,
      share: (c.score / totalScore) * params.total_share
    }));
    
    const result = {
      collectors: collectorsWithShares
    };
    
    // Store in cache
    this.setInCache(cacheKey, result);
    
    return result;
  }
  
  /**
   * Clear cache
   */
  clearCache(key?: string): void {
    if (key) {
      this.cache.delete(key);
    } else {
      this.cache.clear();
    }
  }
  
  // Private helper methods
  
  private getFromCache(key: string): any {
    const cached = this.cache.get(key);
    if (!cached) return null;
    
    // Check if cache is still valid
    if (Date.now() - cached.timestamp > this.cacheTTL * 1000) {
      this.cache.delete(key);
      return null;
    }
    
    return cached.data;
  }
  
  private setInCache(key: string, data: any): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }
  
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
} 