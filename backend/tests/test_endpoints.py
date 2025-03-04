"""
Unit tests for the API endpoints.
"""
import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock
from ..api.endpoints import router
from ..api.ranking import CollectorRanking

# Create test client
client = TestClient(router)

# Test data
MOCK_COLLECTORS = [
    {
        "address": "tz1test1",
        "total_nfts": 5,
        "lifetime_spent": 30.5,
        "recent_purchases": 20.0,
        "score": 1.0
    },
    {
        "address": "tz1test2",
        "total_nfts": 3,
        "lifetime_spent": 15.0,
        "recent_purchases": 15.0,
        "score": 0.6
    }
]

MOCK_STATS = {
    "name": "Test Collection",
    "total_tokens": 100,
    "total_holders": 50,
    "floor_price": 10.0,
    "total_volume": 1000.0
}

@pytest.mark.asyncio
async def test_get_collectors_success():
    """Test successful collector ranking fetch."""
    with patch("backend.api.ranking.CollectorRanking.get_collector_data") as mock_data, \
         patch("backend.api.ranking.CollectorRanking.calculate_scores") as mock_scores:
        
        mock_data.return_value = {
            "holdings": [],
            "trades": [],
            "stats": MOCK_STATS
        }
        mock_scores.return_value = MOCK_COLLECTORS
        
        response = client.get("/collectors/KT1test")
        
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2
        assert data[0]["address"] == "tz1test1"
        assert data[0]["total_nfts"] == 5
        assert data[1]["address"] == "tz1test2"
        assert data[1]["total_nfts"] == 3

@pytest.mark.asyncio
async def test_get_collectors_with_limit():
    """Test collector ranking fetch with limit parameter."""
    with patch("backend.api.ranking.CollectorRanking.get_collector_data") as mock_data, \
         patch("backend.api.ranking.CollectorRanking.calculate_scores") as mock_scores:
        
        mock_data.return_value = {
            "holdings": [],
            "trades": [],
            "stats": MOCK_STATS
        }
        mock_scores.return_value = MOCK_COLLECTORS
        
        response = client.get("/collectors/KT1test?limit=1")
        
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["address"] == "tz1test1"

@pytest.mark.asyncio
async def test_get_collectors_error():
    """Test error handling in collector ranking fetch."""
    with patch("backend.api.ranking.CollectorRanking.get_collector_data") as mock_data:
        mock_data.side_effect = Exception("API error")
        
        response = client.get("/collectors/KT1test")
        
        assert response.status_code == 500
        assert "error" in response.json()["detail"].lower()

@pytest.mark.asyncio
async def test_calculate_splits_success():
    """Test successful split calculation."""
    with patch("backend.api.ranking.CollectorRanking.get_collector_data") as mock_data, \
         patch("backend.api.ranking.CollectorRanking.calculate_scores") as mock_scores, \
         patch("backend.api.ranking.CollectorRanking.calculate_splits") as mock_splits:
        
        mock_data.return_value = {
            "holdings": [],
            "trades": [],
            "stats": MOCK_STATS
        }
        mock_scores.return_value = MOCK_COLLECTORS
        mock_splits.return_value = [
            {**MOCK_COLLECTORS[0], "share": 6.0},
            {**MOCK_COLLECTORS[1], "share": 4.0}
        ]
        
        response = client.post(
            "/calculate-splits",
            json={
                "collection_address": "KT1test",
                "total_share": 10.0,
                "min_collectors": 2,
                "max_collectors": 5
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2
        assert data[0]["address"] == "tz1test1"
        assert data[0]["share"] == 6.0
        assert data[1]["address"] == "tz1test2"
        assert data[1]["share"] == 4.0

@pytest.mark.asyncio
async def test_calculate_splits_validation():
    """Test input validation in split calculation."""
    response = client.post(
        "/calculate-splits",
        json={
            "collection_address": "KT1test",
            "total_share": 101.0,  # Invalid: > 100%
            "min_collectors": 0,    # Invalid: < 1
            "max_collectors": 0     # Invalid: < 1
        }
    )
    
    assert response.status_code == 422  # Validation error
    errors = response.json()["detail"]
    assert any("total_share" in e["loc"] for e in errors)
    assert any("min_collectors" in e["loc"] for e in errors)
    assert any("max_collectors" in e["loc"] for e in errors)

@pytest.mark.asyncio
async def test_calculate_splits_error():
    """Test error handling in split calculation."""
    with patch("backend.api.ranking.CollectorRanking.get_collector_data") as mock_data:
        mock_data.side_effect = Exception("API error")
        
        response = client.post(
            "/calculate-splits",
            json={
                "collection_address": "KT1test",
                "total_share": 10.0,
                "min_collectors": 2,
                "max_collectors": 5
            }
        )
        
        assert response.status_code == 500
        assert "error" in response.json()["detail"].lower()

@pytest.mark.asyncio
async def test_get_stats_success():
    """Test successful collection stats fetch."""
    with patch("backend.api.ranking.CollectorRanking.get_collector_data") as mock_data:
        mock_data.return_value = {
            "holdings": [],
            "trades": [],
            "stats": MOCK_STATS
        }
        
        response = client.get("/stats/KT1test")
        
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Test Collection"
        assert data["total_tokens"] == 100
        assert data["total_holders"] == 50
        assert data["floor_price"] == 10.0
        assert data["total_volume"] == 1000.0

@pytest.mark.asyncio
async def test_get_stats_not_found():
    """Test handling of missing collection stats."""
    with patch("backend.api.ranking.CollectorRanking.get_collector_data") as mock_data:
        mock_data.return_value = {
            "holdings": [],
            "trades": [],
            "stats": None
        }
        
        response = client.get("/stats/KT1test")
        
        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()

@pytest.mark.asyncio
async def test_get_stats_error():
    """Test error handling in collection stats fetch."""
    with patch("backend.api.ranking.CollectorRanking.get_collector_data") as mock_data:
        mock_data.side_effect = Exception("API error")
        
        response = client.get("/stats/KT1test")
        
        assert response.status_code == 500
        assert "error" in response.json()["detail"].lower()

@pytest.mark.asyncio
async def test_rate_limiting():
    """Test rate limiting middleware."""
    # Make multiple requests quickly
    for _ in range(15):  # Exceeds default limit of 10 per minute
        response = client.get("/collectors/KT1test")
    
    assert response.status_code == 429  # Too many requests
    assert "retry-after" in response.headers.lower()

@pytest.mark.asyncio
async def test_caching():
    """Test response caching."""
    with patch("backend.api.ranking.CollectorRanking.get_collector_data") as mock_data, \
         patch("backend.api.ranking.CollectorRanking.calculate_scores") as mock_scores:
        
        mock_data.return_value = {
            "holdings": [],
            "trades": [],
            "stats": MOCK_STATS
        }
        mock_scores.return_value = MOCK_COLLECTORS
        
        # First request should hit the API
        response1 = client.get("/collectors/KT1test")
        assert response1.status_code == 200
        assert mock_data.call_count == 1
        
        # Second request should use cache
        response2 = client.get("/collectors/KT1test")
        assert response2.status_code == 200
        assert mock_data.call_count == 1  # No additional API calls 