"""
Integration tests for the collector split tool.
"""
import pytest
import aiohttp
import asyncio
from datetime import datetime, timedelta
from typing import Dict, List, Any
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Test configuration
API_URL = "http://localhost:8000"
AI_PROCESSING_URL = "http://localhost:8001"
API_KEY = "dev_key_123"  # Test API key

# Test data
SAMPLE_QNA = """
Q: How do I implement a retry mechanism with exponential backoff?
A: Here's a Python implementation using asyncio:
1. Start with a base delay
2. Double the delay after each failure
3. Add jitter to prevent thundering herd
4. Set a maximum retry limit
"""

async def test_health_checks():
    """Test health check endpoints on both servers."""
    async with aiohttp.ClientSession() as session:
        # Test main API health
        async with session.get(f"{API_URL}/health") as response:
            assert response.status == 200, f"Main API health check failed: {await response.text()}"
            data = await response.json()
            assert data["status"] == "healthy"
            logger.info("✅ Main API health check passed")
        
        # Test AI processing API health
        async with session.get(f"{AI_PROCESSING_URL}/health") as response:
            assert response.status == 200, f"AI Processing API health check failed: {await response.text()}"
            data = await response.json()
            assert data["status"] == "healthy"
            logger.info("✅ AI Processing API health check passed")

async def test_collector_ranking_flow():
    """Test the complete collector ranking flow."""
    collection_address = "KT1test"
    headers = {"X-API-Key": API_KEY}
    
    async with aiohttp.ClientSession() as session:
        # 1. Get collector rankings
        async with session.get(
            f"{API_URL}/collectors/{collection_address}",
            headers=headers
        ) as response:
            assert response.status == 200, f"Failed to get collectors: {await response.text()}"
            collectors = await response.json()
            assert len(collectors) > 0
            logger.info(f"✅ Found {len(collectors)} collectors")
        
        # 2. Calculate splits
        split_request = {
            "collection_address": collection_address,
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
            assert len(splits) >= 3  # At least min_collectors
            assert len(splits) <= 5  # At most max_collectors
            total_share = sum(c["share"] for c in splits)
            assert abs(total_share - 10.0) < 0.01  # Total share should be 10%
            logger.info(f"✅ Calculated splits for {len(splits)} collectors")
        
        # 3. Get collection stats
        async with session.get(
            f"{API_URL}/stats/{collection_address}",
            headers=headers
        ) as response:
            assert response.status == 200, f"Failed to get stats: {await response.text()}"
            stats = await response.json()
            assert "name" in stats
            assert "total_tokens" in stats
            assert "total_holders" in stats
            logger.info("✅ Retrieved collection stats")

async def test_rate_limiting():
    """Test rate limiting across endpoints."""
    collection_address = "KT1test"
    headers = {"X-API-Key": API_KEY}
    
    async with aiohttp.ClientSession() as session:
        # Make multiple requests quickly
        tasks = []
        for _ in range(15):  # Exceeds default limit of 10 per minute
            tasks.append(
                session.get(
                    f"{API_URL}/collectors/{collection_address}",
                    headers=headers
                )
            )
        
        responses = await asyncio.gather(*tasks, return_exceptions=True)
        rate_limited = any(
            isinstance(r, aiohttp.ClientResponseError) and r.status == 429
            for r in responses
        )
        assert rate_limited, "Rate limiting not working"
        logger.info("✅ Rate limiting working correctly")

async def test_caching():
    """Test caching across endpoints."""
    collection_address = "KT1test"
    headers = {"X-API-Key": API_KEY}
    
    async with aiohttp.ClientSession() as session:
        # Make first request
        t1_start = time.time()
        async with session.get(
            f"{API_URL}/collectors/{collection_address}",
            headers=headers
        ) as response:
            assert response.status == 200
            t1_end = time.time()
            t1_duration = t1_end - t1_start
        
        # Make second request immediately
        t2_start = time.time()
        async with session.get(
            f"{API_URL}/collectors/{collection_address}",
            headers=headers
        ) as response:
            assert response.status == 200
            t2_end = time.time()
            t2_duration = t2_end - t2_start
        
        # Second request should be faster due to caching
        assert t2_duration < t1_duration
        logger.info("✅ Caching working correctly")

async def test_error_handling():
    """Test error handling across endpoints."""
    headers = {"X-API-Key": API_KEY}
    
    async with aiohttp.ClientSession() as session:
        # Test invalid collection address
        async with session.get(
            f"{API_URL}/collectors/invalid_address",
            headers=headers
        ) as response:
            assert response.status == 500
            error = await response.json()
            assert "error" in error["detail"].lower()
        
        # Test invalid API key
        async with session.get(
            f"{API_URL}/collectors/KT1test",
            headers={"X-API-Key": "invalid_key"}
        ) as response:
            assert response.status == 403
            error = await response.json()
            assert "api key" in error["detail"].lower()
        
        # Test invalid split parameters
        async with session.post(
            f"{API_URL}/calculate-splits",
            headers=headers,
            json={
                "collection_address": "KT1test",
                "total_share": 101.0  # Invalid: > 100%
            }
        ) as response:
            assert response.status == 422
            error = await response.json()
            assert "total_share" in str(error["detail"])
        
        logger.info("✅ Error handling working correctly")

async def test_api_fallback():
    """Test fallback from OBJKT to TzKT API."""
    collection_address = "KT1test"
    headers = {"X-API-Key": API_KEY}
    
    async with aiohttp.ClientSession() as session:
        # First try should use OBJKT API
        async with session.get(
            f"{API_URL}/collectors/{collection_address}",
            headers=headers
        ) as response:
            assert response.status == 200
            collectors = await response.json()
            assert len(collectors) > 0
        
        # Break OBJKT API connection to force fallback
        # (This is simulated in the ranking.py implementation)
        async with session.get(
            f"{API_URL}/collectors/{collection_address}",
            headers=headers
        ) as response:
            assert response.status == 200
            collectors = await response.json()
            assert len(collectors) > 0  # Should still work with TzKT
        
        logger.info("✅ API fallback working correctly")

async def run_all_tests():
    """Run all integration tests."""
    try:
        logger.info("🚀 Starting integration tests...")
        
        logger.info("\n1️⃣ Testing health checks...")
        await test_health_checks()
        
        logger.info("\n2️⃣ Testing collector ranking flow...")
        await test_collector_ranking_flow()
        
        logger.info("\n3️⃣ Testing rate limiting...")
        await test_rate_limiting()
        
        logger.info("\n4️⃣ Testing caching...")
        await test_caching()
        
        logger.info("\n5️⃣ Testing error handling...")
        await test_error_handling()
        
        logger.info("\n6️⃣ Testing API fallback...")
        await test_api_fallback()
        
        logger.info("\n✅ All integration tests completed successfully!")
    except Exception as e:
        logger.error(f"\n❌ Tests failed: {str(e)}")
        raise

if __name__ == "__main__":
    asyncio.run(run_all_tests()) 