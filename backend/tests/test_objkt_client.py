"""
Unit tests for the OBJKT.com API client.
"""
import pytest
import aiohttp
from datetime import datetime, timedelta
from unittest.mock import patch, MagicMock
from ..api.objkt_client import OBJKTClient

# Test data
MOCK_COLLECTION = "KT1test"
MOCK_HOLDINGS = [
    {
        "holder_address": "tz1test1",
        "quantity": 5,
        "token": {
            "token_id": 1,
            "price": 10.5,
            "timestamp": "2024-02-19T00:00:00Z"
        }
    },
    {
        "holder_address": "tz1test2",
        "quantity": 3,
        "token": {
            "token_id": 2,
            "price": 15.0,
            "timestamp": "2024-02-19T00:00:00Z"
        }
    }
]

MOCK_TRADES = [
    {
        "buyer_address": "tz1test1",
        "price": 10.5,
        "timestamp": "2024-02-19T00:00:00Z",
        "token": {"token_id": 1}
    },
    {
        "buyer_address": "tz1test2",
        "price": 15.0,
        "timestamp": "2024-02-19T00:00:00Z",
        "token": {"token_id": 2}
    }
]

MOCK_STATS = {
    "name": "Test Collection",
    "description": "A test collection",
    "total_tokens": 100,
    "total_holders": 50,
    "floor_price": 10.0,
    "total_volume": 1000.0
}

@pytest.fixture
def client():
    """Create a test client instance."""
    return OBJKTClient()

@pytest.mark.asyncio
async def test_get_collector_holdings_success(client):
    """Test successful collector holdings fetch."""
    mock_response = MagicMock()
    mock_response.status = 200
    mock_response.json = MagicMock(
        return_value={"data": {"fa2_holdings": MOCK_HOLDINGS}}
    )
    
    with patch("aiohttp.ClientSession.post") as mock_post:
        mock_post.return_value.__aenter__.return_value = mock_response
        holdings = await client.get_collector_holdings(MOCK_COLLECTION)
        
        assert len(holdings) == 2
        assert holdings[0]["holder_address"] == "tz1test1"
        assert holdings[0]["quantity"] == 5
        assert holdings[1]["holder_address"] == "tz1test2"
        assert holdings[1]["quantity"] == 3

@pytest.mark.asyncio
async def test_get_collector_holdings_error(client):
    """Test error handling in collector holdings fetch."""
    mock_response = MagicMock()
    mock_response.status = 500
    mock_response.text = MagicMock(return_value="Server error")
    
    with patch("aiohttp.ClientSession.post") as mock_post:
        mock_post.return_value.__aenter__.return_value = mock_response
        holdings = await client.get_collector_holdings(MOCK_COLLECTION)
        
        assert len(holdings) == 0

@pytest.mark.asyncio
async def test_get_recent_trades_success(client):
    """Test successful recent trades fetch."""
    mock_response = MagicMock()
    mock_response.status = 200
    mock_response.json = MagicMock(
        return_value={"data": {"fa2_trades": MOCK_TRADES}}
    )
    
    with patch("aiohttp.ClientSession.post") as mock_post:
        mock_post.return_value.__aenter__.return_value = mock_response
        trades = await client.get_recent_trades(MOCK_COLLECTION)
        
        assert len(trades) == 2
        assert trades[0]["buyer_address"] == "tz1test1"
        assert trades[0]["price"] == 10.5
        assert trades[1]["buyer_address"] == "tz1test2"
        assert trades[1]["price"] == 15.0

@pytest.mark.asyncio
async def test_get_recent_trades_error(client):
    """Test error handling in recent trades fetch."""
    mock_response = MagicMock()
    mock_response.status = 500
    mock_response.text = MagicMock(return_value="Server error")
    
    with patch("aiohttp.ClientSession.post") as mock_post:
        mock_post.return_value.__aenter__.return_value = mock_response
        trades = await client.get_recent_trades(MOCK_COLLECTION)
        
        assert len(trades) == 0

@pytest.mark.asyncio
async def test_get_collection_stats_success(client):
    """Test successful collection stats fetch."""
    mock_response = MagicMock()
    mock_response.status = 200
    mock_response.json = MagicMock(
        return_value={"data": {"fa2_collection": [MOCK_STATS]}}
    )
    
    with patch("aiohttp.ClientSession.post") as mock_post:
        mock_post.return_value.__aenter__.return_value = mock_response
        stats = await client.get_collection_stats(MOCK_COLLECTION)
        
        assert stats is not None
        assert stats["name"] == "Test Collection"
        assert stats["total_tokens"] == 100
        assert stats["total_holders"] == 50
        assert stats["floor_price"] == 10.0
        assert stats["total_volume"] == 1000.0

@pytest.mark.asyncio
async def test_get_collection_stats_error(client):
    """Test error handling in collection stats fetch."""
    mock_response = MagicMock()
    mock_response.status = 500
    mock_response.text = MagicMock(return_value="Server error")
    
    with patch("aiohttp.ClientSession.post") as mock_post:
        mock_post.return_value.__aenter__.return_value = mock_response
        stats = await client.get_collection_stats(MOCK_COLLECTION)
        
        assert stats is None

@pytest.mark.asyncio
async def test_get_collection_stats_empty(client):
    """Test handling of empty collection stats response."""
    mock_response = MagicMock()
    mock_response.status = 200
    mock_response.json = MagicMock(
        return_value={"data": {"fa2_collection": []}}
    )
    
    with patch("aiohttp.ClientSession.post") as mock_post:
        mock_post.return_value.__aenter__.return_value = mock_response
        stats = await client.get_collection_stats(MOCK_COLLECTION)
        
        assert stats is None

@pytest.mark.asyncio
async def test_network_error_handling(client):
    """Test handling of network errors."""
    with patch("aiohttp.ClientSession.post") as mock_post:
        mock_post.side_effect = aiohttp.ClientError("Network error")
        
        holdings = await client.get_collector_holdings(MOCK_COLLECTION)
        assert len(holdings) == 0
        
        trades = await client.get_recent_trades(MOCK_COLLECTION)
        assert len(trades) == 0
        
        stats = await client.get_collection_stats(MOCK_COLLECTION)
        assert stats is None 