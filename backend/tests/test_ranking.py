"""
Unit tests for the collector ranking algorithm.
"""
import pytest
from unittest.mock import patch, MagicMock
from datetime import datetime
from ..api.ranking import CollectorRanking

# Test data
MOCK_HOLDINGS = [
    {
        "holder_address": "tz1test1",
        "quantity": 5,
        "token": {
            "token_id": 1,
            "price": 10.5
        }
    },
    {
        "holder_address": "tz1test2",
        "quantity": 3,
        "token": {
            "token_id": 2,
            "price": 15.0
        }
    },
    {
        "holder_address": "tz1test3",
        "quantity": 1,
        "token": {
            "token_id": 3,
            "price": 20.0
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
    },
    {
        "buyer_address": "tz1test1",
        "price": 20.0,
        "timestamp": "2024-02-19T00:00:00Z",
        "token": {"token_id": 3}
    }
]

MOCK_STATS = {
    "name": "Test Collection",
    "total_tokens": 100,
    "total_holders": 50,
    "floor_price": 10.0,
    "total_volume": 1000.0
}

@pytest.fixture
def ranker():
    """Create a test ranker instance."""
    return CollectorRanking()

@pytest.mark.asyncio
async def test_get_collector_data_objkt_success(ranker):
    """Test successful collector data fetch from OBJKT API."""
    with patch("backend.api.objkt_client.OBJKTClient.get_collector_holdings") as mock_holdings, \
         patch("backend.api.objkt_client.OBJKTClient.get_recent_trades") as mock_trades, \
         patch("backend.api.objkt_client.OBJKTClient.get_collection_stats") as mock_stats:
        
        mock_holdings.return_value = MOCK_HOLDINGS
        mock_trades.return_value = MOCK_TRADES
        mock_stats.return_value = MOCK_STATS
        
        data = await ranker.get_collector_data("KT1test")
        
        assert data["holdings"] == MOCK_HOLDINGS
        assert data["trades"] == MOCK_TRADES
        assert data["stats"] == MOCK_STATS

@pytest.mark.asyncio
async def test_get_collector_data_tzkt_fallback(ranker):
    """Test fallback to TzKT API when OBJKT fails."""
    with patch("backend.api.objkt_client.OBJKTClient.get_collector_holdings") as mock_objkt_holdings, \
         patch("backend.api.tzkt_client.TzKTClient.get_token_holders") as mock_tzkt_holders, \
         patch("backend.api.tzkt_client.TzKTClient.get_token_transfers") as mock_tzkt_transfers, \
         patch("backend.api.tzkt_client.TzKTClient.get_contract_metadata") as mock_tzkt_metadata, \
         patch("backend.api.tzkt_client.TzKTClient.get_contract_operations") as mock_tzkt_operations:
        
        # Make OBJKT API fail
        mock_objkt_holdings.return_value = []
        
        # Set up TzKT responses
        mock_tzkt_holders.return_value = MOCK_HOLDINGS
        mock_tzkt_transfers.return_value = MOCK_TRADES
        mock_tzkt_metadata.return_value = MOCK_STATS
        mock_tzkt_operations.return_value = []
        
        data = await ranker.get_collector_data("KT1test")
        
        assert data["holdings"] == MOCK_HOLDINGS
        assert data["trades"] == MOCK_TRADES
        assert data["metadata"] == MOCK_STATS

def test_calculate_scores_success(ranker):
    """Test successful score calculation."""
    data = {
        "holdings": MOCK_HOLDINGS,
        "trades": MOCK_TRADES,
        "stats": MOCK_STATS
    }
    
    ranked_collectors = ranker.calculate_scores(data)
    
    assert len(ranked_collectors) == 3
    assert ranked_collectors[0]["address"] == "tz1test1"  # Should be top ranked
    assert ranked_collectors[0]["total_nfts"] == 5
    assert ranked_collectors[0]["lifetime_spent"] == 30.5  # 10.5 + 20.0
    assert ranked_collectors[0]["score"] > 0

def test_calculate_scores_empty_data(ranker):
    """Test score calculation with empty data."""
    data = {
        "holdings": [],
        "trades": [],
        "stats": None
    }
    
    ranked_collectors = ranker.calculate_scores(data)
    assert len(ranked_collectors) == 0

def test_calculate_scores_missing_data(ranker):
    """Test score calculation with missing data fields."""
    data = {
        "holdings": [
            {
                "holder_address": "tz1test1",
                "quantity": 5
            }
        ],
        "trades": [
            {
                "buyer_address": "tz1test1",
                # Missing price
            }
        ],
        "stats": None
    }
    
    ranked_collectors = ranker.calculate_scores(data)
    assert len(ranked_collectors) == 1
    assert ranked_collectors[0]["address"] == "tz1test1"
    assert ranked_collectors[0]["total_nfts"] == 5
    assert ranked_collectors[0]["lifetime_spent"] == 0

def test_calculate_splits_success(ranker):
    """Test successful split calculation."""
    ranked_collectors = [
        {
            "address": "tz1test1",
            "score": 1.0,
            "total_nfts": 5,
            "lifetime_spent": 30.5
        },
        {
            "address": "tz1test2",
            "score": 0.6,
            "total_nfts": 3,
            "lifetime_spent": 15.0
        },
        {
            "address": "tz1test3",
            "score": 0.4,
            "total_nfts": 1,
            "lifetime_spent": 0
        }
    ]
    
    splits = ranker.calculate_splits(ranked_collectors, total_share=10.0)
    
    assert len(splits) == 3
    assert sum(c["share"] for c in splits) == pytest.approx(10.0)
    assert splits[0]["share"] > splits[1]["share"]  # Higher score gets higher share
    assert splits[1]["share"] > splits[2]["share"]

def test_calculate_splits_empty_collectors(ranker):
    """Test split calculation with empty collector list."""
    splits = ranker.calculate_splits([], total_share=10.0)
    assert len(splits) == 0

def test_calculate_splits_zero_scores(ranker):
    """Test split calculation when all scores are zero."""
    ranked_collectors = [
        {
            "address": "tz1test1",
            "score": 0,
            "total_nfts": 0,
            "lifetime_spent": 0
        },
        {
            "address": "tz1test2",
            "score": 0,
            "total_nfts": 0,
            "lifetime_spent": 0
        }
    ]
    
    splits = ranker.calculate_splits(ranked_collectors, total_share=10.0)
    
    assert len(splits) == 2
    assert splits[0]["share"] == splits[1]["share"]  # Equal distribution
    assert sum(c["share"] for c in splits) == pytest.approx(10.0)

def test_calculate_splits_min_max_collectors(ranker):
    """Test split calculation with min/max collector limits."""
    ranked_collectors = [
        {"address": f"tz1test{i}", "score": 1.0 / (i + 1)} 
        for i in range(20)  # Create 20 collectors
    ]
    
    # Test minimum
    min_splits = ranker.calculate_splits(
        ranked_collectors[:2],  # Only 2 collectors
        total_share=10.0,
        min_collectors=3
    )
    assert len(min_splits) == 2  # Should still only return 2 despite min=3
    
    # Test maximum
    max_splits = ranker.calculate_splits(
        ranked_collectors,
        total_share=10.0,
        max_collectors=5
    )
    assert len(max_splits) == 5  # Should limit to top 5 