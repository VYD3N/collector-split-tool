/**
 * API Service interface for fetching collector data and rankings
 */
import { Collector } from '../../types/collector';

export interface CollectorResponse {
  collectors: Collector[];
  error?: string;
}

export interface CollectionStats {
  name: string;
  total_tokens: number;
  total_holders: number;
  floor_price: number;
  total_volume: number;
}

export interface SplitCalculationParams {
  collection_address: string;
  total_share: number;
  min_collectors: number;
  max_collectors: number;
}

export interface SplitResponse {
  collectors: Collector[];
  error?: string;
}

export interface IApiService {
  /**
   * Get ranked collectors for a specific collection
   * @param collectionAddress The collection contract address
   */
  getCollectors(collectionAddress: string): Promise<CollectorResponse>;
  
  /**
   * Get statistics for a collection
   * @param collectionAddress The collection contract address
   */
  getCollectionStats(collectionAddress: string): Promise<CollectionStats>;
  
  /**
   * Calculate splits for top collectors
   * @param params Split calculation parameters
   */
  calculateSplits(params: SplitCalculationParams): Promise<SplitResponse>;
  
  /**
   * Clear the API cache
   * @param key Optional specific cache key to clear, clears all if not provided
   */
  clearCache(key?: string): void;
} 