"""
Unit tests for the TzKT API client.
"""
import pytest
import aiohttp
from datetime import datetime, timedelta
from unittest.mock import patch, MagicMock
from ..api.tzkt_client import TzKTClient

# Test data
MOCK_CONTRACT = "KT1test"
MOCK_HOLDERS = [
    {
        "address": "tz1test1",
        "balance": 5,
        "token": {
            "token_id": 1,
            "contract": "KT1test"
        }
    },
    {
        "address": "tz1test2",
        "balance": 3,
        "token": {
            "token_id": 2,
            "contract": "KT1test"
        }
    }
]

MOCK_TRANSFERS = [
    {
        "from": "tz1seller1",
        "to": "tz1test1",
        "amount": 1,
        "token": {
            "token_id": 1,
            "contract": "KT1test"
        },
        "timestamp": "2024-02-19T00:00:00Z"
    },
    {
        "from": "tz1seller2",
        "to": "tz1test2",
        "amount": 1,
        "token": {
            "token_id": 2,
            "contract": "KT1test"
        },
        "timestamp": "2024-02-19T00:00:00Z"
    }
]

MOCK_OPERATIONS = [
    {
        "type": "transaction",
        "hash": "op1",
        "target": "KT1test",
        "amount": 10000000,  # 10 tez in mutez
        "timestamp": "2024-02-19T00:00:00Z"
    },
    {
        "type": "transaction",
        "hash": "op2",
        "target": "KT1test",
        "amount": 15000000,  # 15 tez in mutez
        "timestamp": "2024-02-19T00:00:00Z"
    }
]

MOCK_METADATA = {
    "address": "KT1test",
    "alias": "Test Collection",
    "tzips": ["fa2"],
    "creator": {
        "address": "tz1creator"
    }
}

@pytest.fixture
def client():
    """Create a test client instance."""
    return TzKTClient()

@pytest.mark.asyncio
async def test_get_token_holders_success(client):
    """Test successful token holders fetch."""
    mock_response = MagicMock()
    mock_response.status = 200
    mock_response.json = MagicMock(return_value=MOCK_HOLDERS)
    
    with patch("aiohttp.ClientSession.get") as mock_get:
        mock_get.return_value.__aenter__.return_value = mock_response
        holders = await client.get_token_holders(MOCK_CONTRACT)
        
        assert len(holders) == 2
        assert holders[0]["address"] == "tz1test1"
        assert holders[0]["balance"] == 5
        assert holders[1]["address"] == "tz1test2"
        assert holders[1]["balance"] == 3

@pytest.mark.asyncio
async def test_get_token_holders_with_token_id(client):
    """Test token holders fetch with specific token ID."""
    mock_response = MagicMock()
    mock_response.status = 200
    mock_response.json = MagicMock(return_value=[MOCK_HOLDERS[0]])
    
    with patch("aiohttp.ClientSession.get") as mock_get:
        mock_get.return_value.__aenter__.return_value = mock_response
        holders = await client.get_token_holders(MOCK_CONTRACT, token_id=1)
        
        assert len(holders) == 1
        assert holders[0]["address"] == "tz1test1"
        assert holders[0]["balance"] == 5

@pytest.mark.asyncio
async def test_get_token_holders_error(client):
    """Test error handling in token holders fetch."""
    mock_response = MagicMock()
    mock_response.status = 500
    mock_response.text = MagicMock(return_value="Server error")
    
    with patch("aiohttp.ClientSession.get") as mock_get:
        mock_get.return_value.__aenter__.return_value = mock_response
        holders = await client.get_token_holders(MOCK_CONTRACT)
        
        assert len(holders) == 0

@pytest.mark.asyncio
async def test_get_token_transfers_success(client):
    """Test successful token transfers fetch."""
    mock_response = MagicMock()
    mock_response.status = 200
    mock_response.json = MagicMock(return_value=MOCK_TRANSFERS)
    
    with patch("aiohttp.ClientSession.get") as mock_get:
        mock_get.return_value.__aenter__.return_value = mock_response
        transfers = await client.get_token_transfers(MOCK_CONTRACT)
        
        assert len(transfers) == 2
        assert transfers[0]["to"] == "tz1test1"
        assert transfers[0]["amount"] == 1
        assert transfers[1]["to"] == "tz1test2"
        assert transfers[1]["amount"] == 1

@pytest.mark.asyncio
async def test_get_token_transfers_with_token_id(client):
    """Test token transfers fetch with specific token ID."""
    mock_response = MagicMock()
    mock_response.status = 200
    mock_response.json = MagicMock(return_value=[MOCK_TRANSFERS[0]])
    
    with patch("aiohttp.ClientSession.get") as mock_get:
        mock_get.return_value.__aenter__.return_value = mock_response
        transfers = await client.get_token_transfers(MOCK_CONTRACT, token_id=1)
        
        assert len(transfers) == 1
        assert transfers[0]["to"] == "tz1test1"
        assert transfers[0]["amount"] == 1

@pytest.mark.asyncio
async def test_get_token_transfers_error(client):
    """Test error handling in token transfers fetch."""
    mock_response = MagicMock()
    mock_response.status = 500
    mock_response.text = MagicMock(return_value="Server error")
    
    with patch("aiohttp.ClientSession.get") as mock_get:
        mock_get.return_value.__aenter__.return_value = mock_response
        transfers = await client.get_token_transfers(MOCK_CONTRACT)
        
        assert len(transfers) == 0

@pytest.mark.asyncio
async def test_get_contract_operations_success(client):
    """Test successful contract operations fetch."""
    mock_response = MagicMock()
    mock_response.status = 200
    mock_response.json = MagicMock(return_value=MOCK_OPERATIONS)
    
    with patch("aiohttp.ClientSession.get") as mock_get:
        mock_get.return_value.__aenter__.return_value = mock_response
        operations = await client.get_contract_operations(MOCK_CONTRACT)
        
        assert len(operations) == 2
        assert operations[0]["type"] == "transaction"
        assert operations[0]["amount"] == 10000000
        assert operations[1]["type"] == "transaction"
        assert operations[1]["amount"] == 15000000

@pytest.mark.asyncio
async def test_get_contract_operations_with_types(client):
    """Test contract operations fetch with type filter."""
    mock_response = MagicMock()
    mock_response.status = 200
    mock_response.json = MagicMock(return_value=[MOCK_OPERATIONS[0]])
    
    with patch("aiohttp.ClientSession.get") as mock_get:
        mock_get.return_value.__aenter__.return_value = mock_response
        operations = await client.get_contract_operations(
            MOCK_CONTRACT,
            types=["transaction"]
        )
        
        assert len(operations) == 1
        assert operations[0]["type"] == "transaction"
        assert operations[0]["amount"] == 10000000

@pytest.mark.asyncio
async def test_get_contract_operations_error(client):
    """Test error handling in contract operations fetch."""
    mock_response = MagicMock()
    mock_response.status = 500
    mock_response.text = MagicMock(return_value="Server error")
    
    with patch("aiohttp.ClientSession.get") as mock_get:
        mock_get.return_value.__aenter__.return_value = mock_response
        operations = await client.get_contract_operations(MOCK_CONTRACT)
        
        assert len(operations) == 0

@pytest.mark.asyncio
async def test_get_contract_metadata_success(client):
    """Test successful contract metadata fetch."""
    mock_response = MagicMock()
    mock_response.status = 200
    mock_response.json = MagicMock(return_value=MOCK_METADATA)
    
    with patch("aiohttp.ClientSession.get") as mock_get:
        mock_get.return_value.__aenter__.return_value = mock_response
        metadata = await client.get_contract_metadata(MOCK_CONTRACT)
        
        assert metadata is not None
        assert metadata["address"] == "KT1test"
        assert metadata["alias"] == "Test Collection"
        assert metadata["tzips"] == ["fa2"]
        assert metadata["creator"]["address"] == "tz1creator"

@pytest.mark.asyncio
async def test_get_contract_metadata_error(client):
    """Test error handling in contract metadata fetch."""
    mock_response = MagicMock()
    mock_response.status = 500
    mock_response.text = MagicMock(return_value="Server error")
    
    with patch("aiohttp.ClientSession.get") as mock_get:
        mock_get.return_value.__aenter__.return_value = mock_response
        metadata = await client.get_contract_metadata(MOCK_CONTRACT)
        
        assert metadata is None

@pytest.mark.asyncio
async def test_network_error_handling(client):
    """Test handling of network errors."""
    with patch("aiohttp.ClientSession.get") as mock_get:
        mock_get.side_effect = aiohttp.ClientError("Network error")
        
        holders = await client.get_token_holders(MOCK_CONTRACT)
        assert len(holders) == 0
        
        transfers = await client.get_token_transfers(MOCK_CONTRACT)
        assert len(transfers) == 0
        
        operations = await client.get_contract_operations(MOCK_CONTRACT)
        assert len(operations) == 0
        
        metadata = await client.get_contract_metadata(MOCK_CONTRACT)
        assert metadata is None 