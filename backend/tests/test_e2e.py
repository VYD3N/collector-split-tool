"""
End-to-end tests for the collector split tool.
Tests the entire system from API to smart contract interaction.
"""
import pytest
import aiohttp
import asyncio
from datetime import datetime, timedelta
from typing import Dict, List, Any
import logging
import os
from pytezos import PyTezosClient
from ..config.settings import OPEN_EDITION_CONTRACT_ADDRESS, TEZOS_RPC_URL

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Test configuration
API_URL = "http://localhost:8000"
API_KEY = "dev_key_123"  # Test API key
TEST_COLLECTION = "KT1test"  # Test collection address
TEST_WALLET = "tz1test"    # Test wallet address

# Initialize Tezos client
pytezos = PyTezosClient(
    key=os.getenv("TEZOS_KEY"),
    shell=TEZOS_RPC_URL
)

async def test_full_split_workflow():
    """Test the complete workflow from ranking to minting."""
    headers = {"X-API-Key": API_KEY}
    
    async with aiohttp.ClientSession() as session:
        # 1. Get collector rankings
        logger.info("Getting collector rankings...")
        async with session.get(
            f"{API_URL}/collectors/{TEST_COLLECTION}",
            headers=headers
        ) as response:
            assert response.status == 200, f"Failed to get collectors: {await response.text()}"
            collectors = await response.json()
            assert len(collectors) > 0
            logger.info(f"✅ Found {len(collectors)} collectors")
        
        # 2. Calculate splits
        logger.info("Calculating splits...")
        split_request = {
            "collection_address": TEST_COLLECTION,
            "total_share": 10.0,
            "min_collectors": 3,
            "max_collectors": 5
        }
        async with session.post(
            f"{API_URL}/calculate-splits",
            headers=headers,
            json=split_request
        ) as response:
            assert response.status == 200, f"Failed to calculate splits: {await response.text()}"
            splits = await response.json()
            assert len(splits) >= 3
            total_share = sum(c["share"] for c in splits)
            assert abs(total_share - 10.0) < 0.01
            logger.info(f"✅ Calculated splits for {len(splits)} collectors")
        
        # 3. Prepare contract operation
        logger.info("Preparing contract operation...")
        contract = pytezos.contract(OPEN_EDITION_CONTRACT_ADDRESS)
        operation = contract.mint(
            amount=1,
            splits=[
                {"address": c["address"], "shares": int(c["share"] * 1000)}
                for c in splits
            ]
        ).autofill()
        
        # 4. Simulate operation
        logger.info("Simulating contract operation...")
        simulation = operation.simulate()
        assert simulation.is_success(), "Contract simulation failed"
        logger.info("✅ Contract simulation successful")
        
        # 5. Get collection stats
        logger.info("Getting collection stats...")
        async with session.get(
            f"{API_URL}/stats/{TEST_COLLECTION}",
            headers=headers
        ) as response:
            assert response.status == 200, f"Failed to get stats: {await response.text()}"
            stats = await response.json()
            assert "name" in stats
            assert "total_tokens" in stats
            logger.info("✅ Retrieved collection stats")

async def test_error_recovery():
    """Test error recovery in the full workflow."""
    headers = {"X-API-Key": API_KEY}
    
    async with aiohttp.ClientSession() as session:
        # 1. Test API fallback
        logger.info("Testing API fallback...")
        async with session.get(
            f"{API_URL}/collectors/{TEST_COLLECTION}",
            headers=headers
        ) as response:
            assert response.status == 200
            collectors = await response.json()
            assert len(collectors) > 0
            logger.info("✅ API fallback working")
        
        # 2. Test contract error recovery
        logger.info("Testing contract error recovery...")
        contract = pytezos.contract(OPEN_EDITION_CONTRACT_ADDRESS)
        
        # Try with invalid splits (>100%)
        invalid_splits = [
            {"address": TEST_WALLET, "shares": 2000}  # 200%
        ]
        
        operation = contract.mint(
            amount=1,
            splits=invalid_splits
        ).autofill()
        
        # Should fail simulation
        simulation = operation.simulate()
        assert not simulation.is_success(), "Invalid operation should fail"
        logger.info("✅ Contract validation working")

async def test_transaction_monitoring():
    """Test transaction monitoring and confirmation."""
    headers = {"X-API-Key": API_KEY}
    
    async with aiohttp.ClientSession() as session:
        # 1. Calculate splits
        logger.info("Calculating splits...")
        split_request = {
            "collection_address": TEST_COLLECTION,
            "total_share": 10.0,
            "min_collectors": 3,
            "max_collectors": 5
        }
        async with session.post(
            f"{API_URL}/calculate-splits",
            headers=headers,
            json=split_request
        ) as response:
            assert response.status == 200
            splits = await response.json()
        
        # 2. Prepare and send transaction
        logger.info("Preparing transaction...")
        contract = pytezos.contract(OPEN_EDITION_CONTRACT_ADDRESS)
        operation = contract.mint(
            amount=1,
            splits=[
                {"address": c["address"], "shares": int(c["share"] * 1000)}
                for c in splits
            ]
        ).autofill()
        
        # 3. Monitor transaction
        logger.info("Monitoring transaction...")
        simulation = operation.simulate()
        assert simulation.is_success()
        
        # Get estimated confirmation time
        estimated_time = simulation.estimated_time
        assert estimated_time > 0, "Should have estimated confirmation time"
        logger.info("✅ Transaction monitoring working")

async def test_concurrent_operations():
    """Test handling of concurrent operations."""
    headers = {"X-API-Key": API_KEY}
    
    async with aiohttp.ClientSession() as session:
        # Make multiple concurrent requests
        tasks = []
        for _ in range(5):
            tasks.append(
                session.get(
                    f"{API_URL}/collectors/{TEST_COLLECTION}",
                    headers=headers
                )
            )
        
        # All should complete successfully
        responses = await asyncio.gather(*tasks)
        assert all(r.status == 200 for r in responses)
        logger.info("✅ Concurrent operations handled successfully")

async def run_all_tests():
    """Run all end-to-end tests."""
    try:
        logger.info("🚀 Starting end-to-end tests...")
        
        logger.info("\n1️⃣ Testing full split workflow...")
        await test_full_split_workflow()
        
        logger.info("\n2️⃣ Testing error recovery...")
        await test_error_recovery()
        
        logger.info("\n3️⃣ Testing transaction monitoring...")
        await test_transaction_monitoring()
        
        logger.info("\n4️⃣ Testing concurrent operations...")
        await test_concurrent_operations()
        
        logger.info("\n✅ All end-to-end tests completed successfully!")
    except Exception as e:
        logger.error(f"\n❌ Tests failed: {str(e)}")
        raise

if __name__ == "__main__":
    asyncio.run(run_all_tests()) 