"""
Collector data fetching and ranking module.
Handles interaction with OBJKT.com API and implements the ranking algorithm.
"""
import aiohttp
import asyncio
from datetime import datetime, timedelta
from typing import List, Dict, Any
import logging

from .utils.retry import RetryWithBackoff, CircuitBreaker
from ..config.settings import (
    OBJKT_API_ENDPOINT,
    OBJKT_API_KEY,
    RANKING_WEIGHTS,
    RECENT_PURCHASE_DAYS,
    TZKT_API_ENDPOINT,
    CACHE_TIMEOUT
)

logger = logging.getLogger(__name__)

# Create circuit breakers for each API
objkt_circuit_breaker = CircuitBreaker(failure_threshold=5, reset_timeout=60)
tzkt_circuit_breaker = CircuitBreaker(failure_threshold=5, reset_timeout=60)

class CollectorRanking:
    def __init__(self):
        self.headers = {
            "Content-Type": "application/json",
            "X-API-Key": OBJKT_API_KEY
        }
        self._cache = {}
        self._cache_timestamp = None

    @RetryWithBackoff(max_retries=5, circuit_breaker=objkt_circuit_breaker)
    async def _fetch_from_objkt(self, query: str, variables: Dict[str, Any]) -> Dict[str, Any]:
        """
        Fetch data from OBJKT API with retry logic.
        """
        async with aiohttp.ClientSession() as session:
            async with session.post(
                OBJKT_API_ENDPOINT,
                json={"query": query, "variables": variables},
                headers=self.headers
            ) as response:
                if response.status != 200:
                    response_text = await response.text()
                    logger.error(f"OBJKT API error: {response_text}")
                    raise Exception(f"OBJKT API error: {response.status}")
                    
                data = await response.json()
                if "errors" in data:
                    logger.error(f"GraphQL errors: {data['errors']}")
                    raise Exception(f"GraphQL error: {data['errors']}")
                    
                return data["data"]

    @RetryWithBackoff(max_retries=5, circuit_breaker=tzkt_circuit_breaker)
    async def _fetch_from_tzkt(self, collection_address: str) -> List[Dict[str, Any]]:
        """
        Fetch data from TzKT API with retry logic.
        """
        async with aiohttp.ClientSession() as session:
            async with session.get(
                f"{TZKT_API_ENDPOINT}/tokens/{collection_address}/holders"
            ) as response:
                if response.status != 200:
                    response_text = await response.text()
                    logger.error(f"TzKT API error: {response_text}")
                    raise Exception(f"TzKT API error: {response.status}")
                    
                return await response.json()

    async def fetch_collector_data(self, collection_address: str) -> List[Dict[str, Any]]:
        """
        Fetch collector data from OBJKT.com GraphQL API.
        
        Args:
            collection_address: The FA2 contract address of the collection
            
        Returns:
            List of collector data with their holdings and purchase history
        """
        # Check cache first
        cache_key = f"collectors_{collection_address}"
        if self._is_cache_valid(cache_key):
            return self._cache[cache_key]

        query = """
        query CollectorData($address: String!, $since: DateTime!) {
            holdings: fa2_holdings(
                where: {contract_address: {_eq: $address}}
            ) {
                holder_address
                quantity
                token {
                    price
                }
            }
            trades: fa2_trades(
                where: {
                    contract_address: {_eq: $address},
                    timestamp: {_gte: $since}
                }
            ) {
                buyer_address
                price
                timestamp
            }
        }
        """
        
        # Calculate timestamp for recent purchases
        recent_date = datetime.utcnow() - timedelta(days=RECENT_PURCHASE_DAYS)
        
        variables = {
            "address": collection_address,
            "since": recent_date.isoformat()
        }
        
        try:
            data = await self._fetch_from_objkt(query, variables)
            collectors = self._process_collector_data(data)
            
            # Cache the results
            self._cache[cache_key] = collectors
            self._cache_timestamp = datetime.utcnow()
            
            return collectors
            
        except Exception as e:
            logger.error(f"Error fetching collector data: {str(e)}")
            logger.info("Falling back to TzKT API")
            return await self._fetch_fallback_data(collection_address)

    async def _fetch_fallback_data(self, collection_address: str) -> List[Dict[str, Any]]:
        """
        Fetch collector data from TzKT API as a fallback.
        """
        try:
            data = await self._fetch_from_tzkt(collection_address)
            return self._process_tzkt_data(data)
        except Exception as e:
            logger.error(f"Error fetching fallback data: {str(e)}")
            return []

    def _process_collector_data(self, data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Process raw API data into collector rankings.
        
        Args:
            data: Raw data from OBJKT API
            
        Returns:
            List of processed collector data with rankings
        """
        collectors = {}
        
        # Process holdings
        for holding in data["holdings"]:
            address = holding["holder_address"]
            if address not in collectors:
                collectors[address] = {
                    "address": address,
                    "total_nfts": 0,
                    "lifetime_spent": 0,
                    "recent_purchases": 0
                }
            
            collectors[address]["total_nfts"] += holding["quantity"]
            if holding["token"]["price"]:
                collectors[address]["lifetime_spent"] += float(holding["token"]["price"])

        # Process recent trades
        for trade in data["trades"]:
            address = trade["buyer_address"]
            if address in collectors:
                collectors[address]["recent_purchases"] += float(trade["price"])

        # Calculate rankings
        ranked_collectors = self._rank_collectors(list(collectors.values()))
        return ranked_collectors

    def _process_tzkt_data(self, data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Process TzKT API data into collector rankings.
        """
        collectors = []
        for holder in data:
            collectors.append({
                "address": holder["address"],
                "total_nfts": holder["balance"],
                "lifetime_spent": 0,  # TzKT doesn't provide price data
                "recent_purchases": 0  # TzKT doesn't provide recent purchase data
            })
        
        return self._rank_collectors(collectors)

    def _rank_collectors(self, collectors: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Apply ranking algorithm to collector data.
        
        Args:
            collectors: List of collector data
            
        Returns:
            Ranked list of collectors with calculated scores
        """
        if not collectors:
            return []

        # Normalize values to 0-1 range
        max_values = {
            "total_nfts": max(c["total_nfts"] for c in collectors),
            "lifetime_spent": max(c["lifetime_spent"] for c in collectors),
            "recent_purchases": max(c["recent_purchases"] for c in collectors)
        }

        for collector in collectors:
            score = 0
            for metric, weight in RANKING_WEIGHTS.items():
                if max_values[metric] > 0:  # Avoid division by zero
                    normalized_value = collector[metric] / max_values[metric]
                    score += normalized_value * weight
            collector["score"] = score

        # Sort by score and calculate share percentages
        ranked_collectors = sorted(collectors, key=lambda x: x["score"], reverse=True)
        
        # Assign share percentages (example: top 3 get 5%, 3%, 2%)
        share_distribution = [5, 3, 2]  # Configurable
        for i, collector in enumerate(ranked_collectors[:len(share_distribution)]):
            collector["share"] = share_distribution[i]
        
        return ranked_collectors

    def _is_cache_valid(self, cache_key: str) -> bool:
        """Check if cached data is still valid."""
        if cache_key not in self._cache or not self._cache_timestamp:
            return False
            
        age = (datetime.utcnow() - self._cache_timestamp).total_seconds()
        return age < CACHE_TIMEOUT

# Example usage
async def get_top_collectors(collection_address: str) -> List[Dict[str, Any]]:
    """
    Get ranked list of top collectors for a given collection.
    
    Args:
        collection_address: The FA2 contract address of the collection
        
    Returns:
        Ranked list of collectors with their scores and suggested split shares
    """
    ranker = CollectorRanking()
    collectors = await ranker.fetch_collector_data(collection_address)
    return collectors[:10]  # Return top 10 collectors
