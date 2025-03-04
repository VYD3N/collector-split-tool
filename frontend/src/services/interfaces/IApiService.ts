import { Collector, CollectorRankingResponse } from "../../types/collector";

/**
 * Interface for API-related services
 */
export interface IApiService {
  /**
   * Fetch collector data for a specific collection
   * @param collectionAddress The collection contract address
   * @returns Response containing collectors or error
   */
  getCollectors(collectionAddress: string): Promise<CollectorRankingResponse>;
  
  /**
   * Calculate splits for a collection
   * @param collectionAddress The collection contract address
   * @param totalShare The total percentage to distribute
   * @param minCollectors Minimum number of collectors
   * @param maxCollectors Maximum number of collectors
   * @returns Array of collectors with calculated shares
   */
  calculateSplits(
    collectionAddress: string,
    totalShare: number,
    minCollectors: number,
    maxCollectors: number
  ): Promise<Collector[]>;
  
  /**
   * Get collection statistics
   * @param collectionAddress The collection contract address
   * @returns Collection statistics
   */
  getCollectionStats(
    collectionAddress: string
  ): Promise<{
    name: string;
    total_tokens: number;
    total_holders: number;
    floor_price: number;
    total_volume: number;
  }>;
} 