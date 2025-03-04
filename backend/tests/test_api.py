"""
Tests for API functionality, including rate limiting and retry mechanisms.
"""
import pytest
from fastapi.testclient import TestClient
import asyncio
from unittest.mock import patch, MagicMock
from datetime import datetime, timedelta

from ..server import app
from ..api.collectors import CollectorRanking
from ..api.middleware.rate_limit import RateLimiter

client = TestClient(app)

def test_health_check():
    """Test health check endpoint."""
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "healthy"}

def test_rate_limiter():
    """Test rate limiting functionality."""
    limiter = RateLimiter(requests_per_minute=2, window_size=60)
    
    # First request should pass
    is_limited, retry_after = limiter.is_rate_limited("test_ip")
    assert not is_limited
    assert retry_after is None
    
    # Second request should pass
    is_limited, retry_after = limiter.is_rate_limited("test_ip")
    assert not is_limited
    assert retry_after is None
    
    # Third request should be limited
    is_limited, retry_after = limiter.is_rate_limited("test_ip")
    assert is_limited
    assert retry_after is not None
    assert retry_after > 0

def test_rate_limit_middleware():
    """Test rate limiting middleware integration."""
    # Make multiple requests to trigger rate limit
    for _ in range(10):
        response = client.get("/api/collectors/KT1test")
    
    # Next request should be rate limited
    response = client.get("/api/collectors/KT1test")
    assert response.status_code == 429
    assert "Retry-After" in response.headers

@pytest.mark.asyncio
async def test_retry_mechanism():
    """Test retry mechanism with mocked API responses."""
    collector_ranking = CollectorRanking()
    
    # Mock OBJKT API to fail twice then succeed
    mock_responses = [
        Exception("API Error"),  # First attempt fails
        Exception("API Error"),  # Second attempt fails
        {"data": {  # Third attempt succeeds
            "holdings": [],
            "trades": []
        }}
    ]
    
    with patch('aiohttp.ClientSession.post') as mock_post:
        async def mock_response():
            response = mock_responses.pop(0)
            if isinstance(response, Exception):
                raise response
            return MagicMock(
                status=200,
                json=MagicMock(return_value=response)
            )
        
        mock_post.return_value.__aenter__.side_effect = mock_response
        
        # Should succeed after retries
        result = await collector_ranking.fetch_collector_data("KT1test")
        assert result == []  # Empty result for empty mock data
        assert mock_post.call_count == 3  # Called three times total

@pytest.mark.asyncio
async def test_circuit_breaker():
    """Test circuit breaker functionality."""
    collector_ranking = CollectorRanking()
    
    # Mock API to always fail
    with patch('aiohttp.ClientSession.post') as mock_post:
        async def mock_failed_response():
            raise Exception("API Error")
        
        mock_post.return_value.__aenter__.side_effect = mock_failed_response
        
        # Make enough requests to trigger circuit breaker
        for _ in range(6):
            try:
                await collector_ranking.fetch_collector_data("KT1test")
            except Exception:
                pass
        
        # Next request should fail immediately with circuit breaker error
        with pytest.raises(Exception) as exc_info:
            await collector_ranking.fetch_collector_data("KT1test")
        assert "Circuit breaker is open" in str(exc_info.value)

@pytest.mark.asyncio
async def test_fallback_api():
    """Test fallback to TzKT API when OBJKT API fails."""
    collector_ranking = CollectorRanking()
    
    # Mock OBJKT API to fail and TzKT API to succeed
    with patch('aiohttp.ClientSession.post') as mock_objkt, \
         patch('aiohttp.ClientSession.get') as mock_tzkt:
        
        # OBJKT API fails
        async def mock_objkt_error():
            raise Exception("OBJKT API Error")
        
        # TzKT API succeeds
        async def mock_tzkt_success():
            return MagicMock(
                status=200,
                json=MagicMock(return_value=[
                    {"address": "tz1test", "balance": 5}
                ])
            )
        
        mock_objkt.return_value.__aenter__.side_effect = mock_objkt_error
        mock_tzkt.return_value.__aenter__.side_effect = mock_tzkt_success
        
        # Should fall back to TzKT API
        result = await collector_ranking.fetch_collector_data("KT1test")
        assert len(result) == 1
        assert result[0]["address"] == "tz1test"
        assert result[0]["total_nfts"] == 5

def test_excluded_paths_not_rate_limited():
    """Test that excluded paths bypass rate limiting."""
    # Health check should never be rate limited
    for _ in range(20):
        response = client.get("/health")
        assert response.status_code == 200

    # Docs should never be rate limited
    for _ in range(20):
        response = client.get("/docs")
        assert response.status_code == 200
