import { IApiService } from '../interfaces/IApiService';
import { Collector, CollectorRankingResponse } from '../../types/collector';

/**
 * Mock data for collectors
 */
const DEFAULT_COLLECTORS: Collector[] = [
  {
    address: "tz1test1",
    total_nfts: 10,
    lifetime_spent: 100.5,
    recent_purchases: 50.25,
    score: 0.85
  },
  {
    address: "tz1test2",
    total_nfts: 5,
    lifetime_spent: 50.25,
    recent_purchases: 20.0,
    score: 0.65
  },
  {
    address: "tz1test3",
    total_nfts: 3,
    lifetime_spent: 30.75,
    recent_purchases: 10.5,
    score: 0.45
  }
];

/**
 * Default collection stats
 */
const DEFAULT_COLLECTION_STATS = {
  name: "Test Collection",
  total_tokens: 100,
  total_holders: 50,
  floor_price: 10.0,
  total_volume: 1000.0
};

/**
 * Simple mock API service for testing
 * Does not depend on actual HTTP requests
 */
export class TestApiService implements IApiService {
  private collectors: Collector[];
  private collectionStats: any;
  private shouldFail: boolean = false;
  private delayMs: number = 0;
  private errorMessage: string = "Mock API error";
  
  constructor(options?: {
    collectors?: Collector[];
    collectionStats?: any;
    shouldFail?: boolean;
    delayMs?: number;
    errorMessage?: string;
  }) {
    this.collectors = options?.collectors || [...DEFAULT_COLLECTORS];
    this.collectionStats = options?.collectionStats || {...DEFAULT_COLLECTION_STATS};
    this.shouldFail = options?.shouldFail || false;
    this.delayMs = options?.delayMs || 0;
    this.errorMessage = options?.errorMessage || "Mock API error";
  }
  
  /**
   * Set whether API calls should fail
   */
  setShouldFail(shouldFail: boolean, errorMessage?: string) {
    this.shouldFail = shouldFail;
    this.errorMessage = errorMessage || "Mock API error";
    return this;
  }
  
  /**
   * Set mock response delay in milliseconds
   */
  setDelay(delayMs: number) {
    this.delayMs = delayMs;
    return this;
  }
  
  /**
   * Set mock collectors data
   */
  setCollectors(collectors: Collector[]) {
    this.collectors = [...collectors];
    return this;
  }
  
  /**
   * Set mock collection stats
   */
  setCollectionStats(stats: any) {
    this.collectionStats = {...stats};
    return this;
  }
  
  /**
   * Simulate a delayed response
   */
  private async delay<T>(value: T): Promise<T> {
    if (this.delayMs > 0) {
      await new Promise(resolve => setTimeout(resolve, this.delayMs));
    }
    return value;
  }
  
  /**
   * Check if should simulate failure
   */
  private checkShouldFail(): void {
    if (this.shouldFail) {
      throw new Error(this.errorMessage || "Mock API error");
    }
  }
  
  // IApiService implementation
  
  async getCollectors(collectionAddress: string): Promise<CollectorRankingResponse> {
    try {
      this.checkShouldFail();
      return this.delay({
        collectors: this.collectors
      });
    } catch (error) {
      console.error('Error in mock getCollectors:', error);
      return {
        collectors: [],
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  
  async calculateSplits(
    collectionAddress: string,
    totalShare: number = 10.0,
    minCollectors: number = 3,
    maxCollectors: number = 10
  ): Promise<Collector[]> {
    try {
      this.checkShouldFail();
      
      // Take top collectors based on score
      const sortedCollectors = [...this.collectors]
        .sort((a, b) => b.score - a.score)
        .slice(0, Math.min(maxCollectors, this.collectors.length));
      
      // Calculate shares based on relative scores
      const totalScore = sortedCollectors.reduce((sum, c) => sum + c.score, 0);
      
      return this.delay(
        sortedCollectors.map(collector => ({
          ...collector,
          share: totalScore > 0 
            ? (collector.score / totalScore) * totalShare
            : totalShare / sortedCollectors.length
        }))
      );
    } catch (error) {
      console.error('Error in mock calculateSplits:', error);
      throw error;
    }
  }
  
  async getCollectionStats(collectionAddress: string): Promise<{
    name: string;
    total_tokens: number;
    total_holders: number;
    floor_price: number;
    total_volume: number;
  }> {
    try {
      this.checkShouldFail();
      return this.delay(this.collectionStats);
    } catch (error) {
      console.error('Error in mock getCollectionStats:', error);
      throw error;
    }
  }
} 