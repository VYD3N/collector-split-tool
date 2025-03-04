export interface Collector {
    address: string;
    total_nfts: number;
    lifetime_spent: number;
    recent_purchases: number;
    score: number;
    share?: number;
}

export interface CollectorRankingResponse {
    collectors: Collector[];
    error?: string;
} 