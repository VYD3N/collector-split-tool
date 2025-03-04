"""
API endpoints for collector data and rankings.
"""
from fastapi import APIRouter, HTTPException, Query, Depends
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
import logging
from .ranking import CollectorRanking
from .middleware.rate_limit import RateLimiter
from .middleware.cache import cache_response

logger = logging.getLogger(__name__)
router = APIRouter()
ranker = CollectorRanking()
rate_limiter = RateLimiter()

class CollectorResponse(BaseModel):
    """Response model for collector data."""
    address: str
    total_nfts: int
    lifetime_spent: float
    recent_purchases: float
    score: float
    share: Optional[float] = None

class SplitRequest(BaseModel):
    """Request model for split calculation."""
    collection_address: str
    total_share: float = Field(10.0, ge=0.0, le=100.0)
    min_collectors: int = Field(3, ge=1)
    max_collectors: int = Field(10, ge=1)

class CollectionStats(BaseModel):
    """Response model for collection statistics."""
    name: str
    total_tokens: int
    total_holders: int
    floor_price: float
    total_volume: float

@router.get(
    "/collectors/{collection_address}",
    response_model=List[CollectorResponse],
    summary="Get ranked collectors for a collection"
)
@cache_response(ttl=300)  # Cache for 5 minutes
async def get_collectors(
    collection_address: str,
    limit: int = Query(10, ge=1, le=100),
    days: int = Query(30, ge=1, le=365),
    rate_limit: bool = Depends(rate_limiter.check)
):
    """
    Get ranked collectors for a specific collection.
    
    Args:
        collection_address: The FA2 contract address
        limit: Maximum number of collectors to return
        days: Number of days to look back for recent activity
        
    Returns:
        List of ranked collectors with their scores
    """
    try:
        data = await ranker.get_collector_data(collection_address, days)
        ranked_collectors = ranker.calculate_scores(data)
        return ranked_collectors[:limit]
        
    except Exception as e:
        logger.error(f"Error getting collectors: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error getting collectors: {str(e)}"
        )

@router.post(
    "/calculate-splits",
    response_model=List[CollectorResponse],
    summary="Calculate splits for top collectors"
)
@cache_response(ttl=300)  # Cache for 5 minutes
async def calculate_splits(
    request: SplitRequest,
    rate_limit: bool = Depends(rate_limiter.check)
):
    """
    Calculate split percentages for top collectors.
    
    Args:
        request: Split calculation parameters
        
    Returns:
        List of collectors with assigned split percentages
    """
    try:
        data = await ranker.get_collector_data(request.collection_address)
        ranked_collectors = ranker.calculate_scores(data)
        splits = ranker.calculate_splits(
            ranked_collectors,
            total_share=request.total_share,
            min_collectors=request.min_collectors,
            max_collectors=request.max_collectors
        )
        return splits
        
    except Exception as e:
        logger.error(f"Error calculating splits: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error calculating splits: {str(e)}"
        )

@router.get(
    "/stats/{collection_address}",
    response_model=CollectionStats,
    summary="Get collection statistics"
)
@cache_response(ttl=300)  # Cache for 5 minutes
async def get_stats(
    collection_address: str,
    rate_limit: bool = Depends(rate_limiter.check)
):
    """
    Get statistics for a collection.
    
    Args:
        collection_address: The FA2 contract address
        
    Returns:
        Collection statistics
    """
    try:
        data = await ranker.get_collector_data(collection_address)
        stats = data.get("stats") or data.get("metadata")
        
        if not stats:
            raise HTTPException(
                status_code=404,
                detail="Collection stats not found"
            )
        
        return CollectionStats(
            name=stats["name"],
            total_tokens=stats["total_tokens"],
            total_holders=stats["total_holders"],
            floor_price=stats.get("floor_price", 0.0),
            total_volume=stats.get("total_volume", 0.0)
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting collection stats: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error getting collection stats: {str(e)}"
        ) 