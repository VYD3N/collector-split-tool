"""
OBJKT.com API client implementation for fetching collector data.
"""
import aiohttp
import asyncio
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
import logging
from ..config.settings import OBJKT_API_ENDPOINT, OBJKT_API_KEY

logger = logging.getLogger(__name__)

class OBJKTClient:
    """Client for interacting with OBJKT.com GraphQL API."""
    
    def __init__(self):
        self.endpoint = OBJKT_API_ENDPOINT
        self.headers = {
            "Content-Type": "application/json",
            "X-API-Key": OBJKT_API_KEY
        }
    
    async def get_collector_holdings(self, collection_address: str) -> List[Dict[str, Any]]:
        """
        Fetch collector holdings for a specific collection.
        
        Args:
            collection_address: The FA2 contract address
            
        Returns:
            List of collector holdings with quantities and token details
        """
        query = """
        query CollectorHoldings($address: String!) {
            fa2_holdings(
                where: {contract_address: {_eq: $address}}
            ) {
                holder_address
                quantity
                token {
                    token_id
                    price
                    timestamp
                }
            }
        }
        """
        
        variables = {"address": collection_address}
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    self.endpoint,
                    json={"query": query, "variables": variables},
                    headers=self.headers
                ) as response:
                    if response.status != 200:
                        logger.error(f"OBJKT API error: {await response.text()}")
                        return []
                    
                    data = await response.json()
                    if "errors" in data:
                        logger.error(f"GraphQL errors: {data['errors']}")
                        return []
                    
                    return data.get("data", {}).get("fa2_holdings", [])
                    
        except Exception as e:
            logger.error(f"Error fetching collector holdings: {str(e)}")
            return []
    
    async def get_recent_trades(
        self,
        collection_address: str,
        days: int = 30
    ) -> List[Dict[str, Any]]:
        """
        Fetch recent trades for a collection.
        
        Args:
            collection_address: The FA2 contract address
            days: Number of days to look back
            
        Returns:
            List of recent trades with buyer and price information
        """
        since = datetime.utcnow() - timedelta(days=days)
        
        query = """
        query RecentTrades($address: String!, $since: DateTime!) {
            fa2_trades(
                where: {
                    contract_address: {_eq: $address},
                    timestamp: {_gte: $since}
                }
            ) {
                buyer_address
                price
                timestamp
                token {
                    token_id
                }
            }
        }
        """
        
        variables = {
            "address": collection_address,
            "since": since.isoformat()
        }
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    self.endpoint,
                    json={"query": query, "variables": variables},
                    headers=self.headers
                ) as response:
                    if response.status != 200:
                        logger.error(f"OBJKT API error: {await response.text()}")
                        return []
                    
                    data = await response.json()
                    if "errors" in data:
                        logger.error(f"GraphQL errors: {data['errors']}")
                        return []
                    
                    return data.get("data", {}).get("fa2_trades", [])
                    
        except Exception as e:
            logger.error(f"Error fetching recent trades: {str(e)}")
            return []
    
    async def get_collection_stats(
        self,
        collection_address: str
    ) -> Optional[Dict[str, Any]]:
        """
        Fetch collection statistics.
        
        Args:
            collection_address: The FA2 contract address
            
        Returns:
            Collection statistics or None if error
        """
        query = """
        query CollectionStats($address: String!) {
            fa2_collection(
                where: {contract_address: {_eq: $address}}
            ) {
                name
                description
                total_tokens
                total_holders
                floor_price
                total_volume
            }
        }
        """
        
        variables = {"address": collection_address}
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    self.endpoint,
                    json={"query": query, "variables": variables},
                    headers=self.headers
                ) as response:
                    if response.status != 200:
                        logger.error(f"OBJKT API error: {await response.text()}")
                        return None
                    
                    data = await response.json()
                    if "errors" in data:
                        logger.error(f"GraphQL errors: {data['errors']}")
                        return None
                    
                    collections = data.get("data", {}).get("fa2_collection", [])
                    return collections[0] if collections else None
                    
        except Exception as e:
            logger.error(f"Error fetching collection stats: {str(e)}")
            return None

# Example usage:
async def main():
    client = OBJKTClient()
    collection = "KT1test"  # Replace with actual collection address
    
    # Get collector holdings
    holdings = await client.get_collector_holdings(collection)
    print(f"Found {len(holdings)} collector holdings")
    
    # Get recent trades
    trades = await client.get_recent_trades(collection)
    print(f"Found {len(trades)} recent trades")
    
    # Get collection stats
    stats = await client.get_collection_stats(collection)
    if stats:
        print(f"Collection stats: {stats}")

if __name__ == "__main__":
    asyncio.run(main()) 