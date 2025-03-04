"""
Collector ranking algorithm implementation.
"""
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
import logging
from .objkt_client import OBJKTClient
from .tzkt_client import TzKTClient
from ..config.settings import RANKING_WEIGHTS

logger = logging.getLogger(__name__)

class CollectorRanking:
    """Handles collector ranking calculations."""
    
    def __init__(self):
        self.objkt_client = OBJKTClient()
        self.tzkt_client = TzKTClient()
    
    async def get_collector_data(
        self,
        collection_address: str,
        days: int = 30
    ) -> Dict[str, Any]:
        """
        Fetch collector data from both APIs and merge results.
        
        Args:
            collection_address: The FA2 contract address
            days: Number of days to look back for recent activity
            
        Returns:
            Dictionary containing merged collector data
        """
        try:
            # Try OBJKT API first
            holdings = await self.objkt_client.get_collector_holdings(collection_address)
            trades = await self.objkt_client.get_recent_trades(collection_address, days)
            stats = await self.objkt_client.get_collection_stats(collection_address)
            
            if not holdings:
                # Fallback to TzKT API
                logger.info("Falling back to TzKT API")
                holdings = await self.tzkt_client.get_token_holders(collection_address)
                trades = await self.tzkt_client.get_token_transfers(collection_address, days)
                metadata = await self.tzkt_client.get_contract_metadata(collection_address)
                
                # Get additional operations for price data
                operations = await self.tzkt_client.get_contract_operations(
                    collection_address,
                    days,
                    types=["transaction"]
                )
                
                return {
                    "holdings": holdings,
                    "trades": trades,
                    "metadata": metadata,
                    "operations": operations
                }
            
            return {
                "holdings": holdings,
                "trades": trades,
                "stats": stats
            }
            
        except Exception as e:
            logger.error(f"Error fetching collector data: {str(e)}")
            return {
                "holdings": [],
                "trades": [],
                "stats": None
            }
    
    def calculate_scores(
        self,
        data: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """
        Calculate collector scores based on holdings and activity.
        
        Args:
            data: Collector data from APIs
            
        Returns:
            List of collectors with calculated scores
        """
        collectors: Dict[str, Dict[str, Any]] = {}
        
        # Process holdings
        for holding in data["holdings"]:
            address = holding.get("holder_address") or holding.get("address")
            quantity = holding.get("quantity") or holding.get("balance", 0)
            
            if address not in collectors:
                collectors[address] = {
                    "address": address,
                    "total_nfts": 0,
                    "lifetime_spent": 0,
                    "recent_purchases": 0,
                    "score": 0
                }
            
            collectors[address]["total_nfts"] += quantity
        
        # Process trades/transfers
        for trade in data["trades"]:
            buyer = trade.get("buyer_address") or trade.get("to")
            price = float(trade.get("price", 0))
            
            if buyer in collectors:
                collectors[buyer]["lifetime_spent"] += price
                collectors[buyer]["recent_purchases"] += price
        
        # Calculate scores
        max_values = {
            "total_nfts": max((c["total_nfts"] for c in collectors.values()), default=1),
            "lifetime_spent": max((c["lifetime_spent"] for c in collectors.values()), default=1),
            "recent_purchases": max((c["recent_purchases"] for c in collectors.values()), default=1)
        }
        
        for collector in collectors.values():
            # Normalize values to 0-1 range
            normalized_nfts = collector["total_nfts"] / max_values["total_nfts"]
            normalized_spent = collector["lifetime_spent"] / max_values["lifetime_spent"]
            normalized_recent = collector["recent_purchases"] / max_values["recent_purchases"]
            
            # Calculate weighted score
            collector["score"] = (
                normalized_nfts * RANKING_WEIGHTS["total_nfts_owned"] +
                normalized_spent * RANKING_WEIGHTS["lifetime_tez_spent"] +
                normalized_recent * RANKING_WEIGHTS["recent_purchases"]
            )
        
        # Sort by score and return as list
        ranked_collectors = sorted(
            collectors.values(),
            key=lambda x: x["score"],
            reverse=True
        )
        
        return ranked_collectors
    
    def calculate_splits(
        self,
        ranked_collectors: List[Dict[str, Any]],
        total_share: float = 10.0,  # Default 10% total for collectors
        min_collectors: int = 3,
        max_collectors: int = 10
    ) -> List[Dict[str, Any]]:
        """
        Calculate split percentages for top collectors.
        
        Args:
            ranked_collectors: List of ranked collectors
            total_share: Total percentage to distribute
            min_collectors: Minimum number of collectors to include
            max_collectors: Maximum number of collectors to include
            
        Returns:
            List of collectors with assigned split percentages
        """
        if not ranked_collectors:
            return []
        
        # Determine number of collectors to include
        num_collectors = min(
            max(min_collectors, len(ranked_collectors)),
            max_collectors
        )
        
        # Get top collectors
        top_collectors = ranked_collectors[:num_collectors]
        
        # Calculate total score for selected collectors
        total_score = sum(c["score"] for c in top_collectors)
        
        # Assign shares based on relative scores
        for collector in top_collectors:
            if total_score > 0:
                collector["share"] = (collector["score"] / total_score) * total_share
            else:
                # If all scores are 0, distribute evenly
                collector["share"] = total_share / num_collectors
        
        return top_collectors

# Example usage:
async def main():
    ranker = CollectorRanking()
    collection = "KT1test"  # Replace with actual collection address
    
    # Get collector data
    data = await ranker.get_collector_data(collection)
    
    # Calculate scores
    ranked_collectors = ranker.calculate_scores(data)
    print(f"Found {len(ranked_collectors)} ranked collectors")
    
    # Calculate splits for top collectors
    splits = ranker.calculate_splits(ranked_collectors)
    for collector in splits:
        print(f"Collector {collector['address']}: {collector['share']:.2f}% share")

if __name__ == "__main__":
    import asyncio
    asyncio.run(main()) 