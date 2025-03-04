"""
TzKT API client implementation for fetching collector data as a fallback.
"""
import aiohttp
import asyncio
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
import logging
from ..config.settings import TZKT_API_ENDPOINT

logger = logging.getLogger(__name__)

class TzKTClient:
    """Client for interacting with TzKT REST API."""
    
    def __init__(self):
        self.endpoint = TZKT_API_ENDPOINT.rstrip('/')
        self.headers = {
            "Content-Type": "application/json"
        }
    
    async def get_token_holders(
        self,
        contract_address: str,
        token_id: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """
        Fetch token holders for a contract.
        
        Args:
            contract_address: The FA2 contract address
            token_id: Optional specific token ID
            
        Returns:
            List of token holders with balances
        """
        url = f"{self.endpoint}/tokens/{contract_address}"
        if token_id is not None:
            url += f"/holders?token_id={token_id}"
        else:
            url += "/holders"
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(url, headers=self.headers) as response:
                    if response.status != 200:
                        logger.error(f"TzKT API error: {await response.text()}")
                        return []
                    
                    return await response.json()
                    
        except Exception as e:
            logger.error(f"Error fetching token holders: {str(e)}")
            return []
    
    async def get_token_transfers(
        self,
        contract_address: str,
        days: int = 30,
        token_id: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """
        Fetch token transfers for a contract.
        
        Args:
            contract_address: The FA2 contract address
            days: Number of days to look back
            token_id: Optional specific token ID
            
        Returns:
            List of token transfers
        """
        since = int((datetime.utcnow() - timedelta(days=days)).timestamp())
        url = f"{self.endpoint}/tokens/transfers"
        params = {
            "contract": contract_address,
            "timestamp.gt": since
        }
        if token_id is not None:
            params["token_id"] = token_id
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    url,
                    params=params,
                    headers=self.headers
                ) as response:
                    if response.status != 200:
                        logger.error(f"TzKT API error: {await response.text()}")
                        return []
                    
                    return await response.json()
                    
        except Exception as e:
            logger.error(f"Error fetching token transfers: {str(e)}")
            return []
    
    async def get_contract_operations(
        self,
        contract_address: str,
        days: int = 30,
        types: Optional[List[str]] = None
    ) -> List[Dict[str, Any]]:
        """
        Fetch contract operations.
        
        Args:
            contract_address: The FA2 contract address
            days: Number of days to look back
            types: Optional list of operation types to filter
            
        Returns:
            List of contract operations
        """
        since = int((datetime.utcnow() - timedelta(days=days)).timestamp())
        url = f"{self.endpoint}/operations/transactions"
        params = {
            "target": contract_address,
            "timestamp.gt": since
        }
        if types:
            params["type.in"] = ",".join(types)
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    url,
                    params=params,
                    headers=self.headers
                ) as response:
                    if response.status != 200:
                        logger.error(f"TzKT API error: {await response.text()}")
                        return []
                    
                    return await response.json()
                    
        except Exception as e:
            logger.error(f"Error fetching contract operations: {str(e)}")
            return []
    
    async def get_contract_metadata(
        self,
        contract_address: str
    ) -> Optional[Dict[str, Any]]:
        """
        Fetch contract metadata.
        
        Args:
            contract_address: The FA2 contract address
            
        Returns:
            Contract metadata or None if error
        """
        url = f"{self.endpoint}/contracts/{contract_address}"
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(url, headers=self.headers) as response:
                    if response.status != 200:
                        logger.error(f"TzKT API error: {await response.text()}")
                        return None
                    
                    return await response.json()
                    
        except Exception as e:
            logger.error(f"Error fetching contract metadata: {str(e)}")
            return None

# Example usage:
async def main():
    client = TzKTClient()
    contract = "KT1test"  # Replace with actual contract address
    
    # Get token holders
    holders = await client.get_token_holders(contract)
    print(f"Found {len(holders)} token holders")
    
    # Get recent transfers
    transfers = await client.get_token_transfers(contract)
    print(f"Found {len(transfers)} recent transfers")
    
    # Get contract metadata
    metadata = await client.get_contract_metadata(contract)
    if metadata:
        print(f"Contract metadata: {metadata}")

if __name__ == "__main__":
    asyncio.run(main()) 