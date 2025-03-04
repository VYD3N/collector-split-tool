"""
Smart contract interface for OBJKT.com Open Edition with split functionality.
"""
from typing import List, Dict, Any, Optional
from dataclasses import dataclass
from pytezos import PyTezosClient
import logging
from ..config.settings import OPEN_EDITION_CONTRACT_ADDRESS, TEZOS_RPC_URL

logger = logging.getLogger(__name__)

@dataclass
class Split:
    """Split configuration for a collector."""
    address: str
    shares: int  # In basis points (1/1000)

@dataclass
class MintParams:
    """Parameters for minting with splits."""
    amount: int
    splits: List[Split]

class OpenEditionContract:
    """Interface for interacting with OBJKT Open Edition contract."""
    
    def __init__(self, client: Optional[PyTezosClient] = None):
        """
        Initialize contract interface.
        
        Args:
            client: Optional PyTezos client instance
        """
        self.client = client or PyTezosClient(shell=TEZOS_RPC_URL)
        self.contract = self.client.contract(OPEN_EDITION_CONTRACT_ADDRESS)
    
    async def mint_with_splits(
        self,
        params: MintParams,
        dry_run: bool = False
    ) -> Dict[str, Any]:
        """
        Mint tokens with collector splits.
        
        Args:
            params: Mint parameters
            dry_run: Whether to simulate the operation
            
        Returns:
            Operation details
        """
        try:
            # Prepare operation
            operation = self.contract.mint(
                amount=params.amount,
                splits=[
                    {"address": s.address, "shares": s.shares}
                    for s in params.splits
                ]
            ).autofill()
            
            # Simulate first
            simulation = operation.simulate()
            if not simulation.is_success():
                raise Exception(f"Simulation failed: {simulation.error}")
            
            # Return simulation results if dry run
            if dry_run:
                return {
                    "success": True,
                    "simulation": simulation.dict(),
                    "estimated_fee": simulation.suggested_fee,
                    "estimated_gas": simulation.gas_used
                }
            
            # Execute operation
            operation_hash = operation.send()
            
            return {
                "success": True,
                "operation_hash": operation_hash,
                "estimated_fee": simulation.suggested_fee,
                "estimated_gas": simulation.gas_used
            }
            
        except Exception as e:
            logger.error(f"Error minting with splits: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }
    
    async def update_operators(
        self,
        operators: List[Dict[str, str]],
        dry_run: bool = False
    ) -> Dict[str, Any]:
        """
        Update contract operators.
        
        Args:
            operators: List of operator updates
            dry_run: Whether to simulate the operation
            
        Returns:
            Operation details
        """
        try:
            # Prepare operation
            operation = self.contract.update_operators(operators).autofill()
            
            # Simulate first
            simulation = operation.simulate()
            if not simulation.is_success():
                raise Exception(f"Simulation failed: {simulation.error}")
            
            # Return simulation results if dry run
            if dry_run:
                return {
                    "success": True,
                    "simulation": simulation.dict(),
                    "estimated_fee": simulation.suggested_fee,
                    "estimated_gas": simulation.gas_used
                }
            
            # Execute operation
            operation_hash = operation.send()
            
            return {
                "success": True,
                "operation_hash": operation_hash,
                "estimated_fee": simulation.suggested_fee,
                "estimated_gas": simulation.gas_used
            }
            
        except Exception as e:
            logger.error(f"Error updating operators: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }
    
    async def get_contract_storage(self) -> Dict[str, Any]:
        """
        Get contract storage data.
        
        Returns:
            Contract storage data
        """
        try:
            storage = await self.contract.storage()
            return {
                "success": True,
                "storage": storage
            }
            
        except Exception as e:
            logger.error(f"Error getting contract storage: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }

# Example usage:
async def main():
    contract = OpenEditionContract()
    
    # Example mint with splits
    mint_params = MintParams(
        amount=1,
        splits=[
            Split(address="tz1test1", shares=500),  # 5%
            Split(address="tz1test2", shares=300),  # 3%
            Split(address="tz1test3", shares=200)   # 2%
        ]
    )
    
    # Simulate first
    result = await contract.mint_with_splits(mint_params, dry_run=True)
    print(f"Simulation result: {result}")
    
    # Get contract storage
    storage = await contract.get_contract_storage()
    print(f"Contract storage: {storage}")

if __name__ == "__main__":
    import asyncio
    asyncio.run(main()) 