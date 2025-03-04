"""
Caching middleware for FastAPI.
Implements in-memory caching with TTL support.
"""
import time
from datetime import datetime
from typing import Dict, Any, Optional, Callable
import logging
from functools import wraps
import json
import hashlib

logger = logging.getLogger(__name__)

class Cache:
    """
    Simple in-memory cache with TTL support.
    Can be extended to use Redis for distributed deployments.
    """
    def __init__(self, cleanup_interval: int = 300):
        self.cleanup_interval = cleanup_interval  # in seconds
        self.last_cleanup = time.time()
        
        # Store cache entries
        # Format: {key: (value, expiry_time)}
        self._cache: Dict[str, tuple] = {}
    
    def _cleanup_expired(self, current_time: float):
        """Remove expired cache entries."""
        if current_time - self.last_cleanup > self.cleanup_interval:
            for key in list(self._cache.keys()):
                _, expiry = self._cache[key]
                if expiry <= current_time:
                    del self._cache[key]
            self.last_cleanup = current_time
    
    def get(self, key: str) -> Optional[Any]:
        """
        Get value from cache if not expired.
        
        Args:
            key: Cache key
            
        Returns:
            Cached value or None if expired/not found
        """
        current_time = time.time()
        self._cleanup_expired(current_time)
        
        if key in self._cache:
            value, expiry = self._cache[key]
            if expiry > current_time:
                return value
            del self._cache[key]
        return None
    
    def set(self, key: str, value: Any, ttl: int):
        """
        Set value in cache with TTL.
        
        Args:
            key: Cache key
            value: Value to cache
            ttl: Time to live in seconds
        """
        expiry = time.time() + ttl
        self._cache[key] = (value, expiry)

# Global cache instance
_cache = Cache()

def cache_response(ttl: int = 300):
    """
    Decorator to cache API responses.
    
    Args:
        ttl: Time to live in seconds
        
    Returns:
        Decorator function
    """
    def decorator(func: Callable):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Generate cache key from function name and arguments
            key_parts = [
                func.__name__,
                *[str(arg) for arg in args],
                *[f"{k}={v}" for k, v in sorted(kwargs.items())]
            ]
            key = hashlib.md5(
                json.dumps(key_parts).encode()
            ).hexdigest()
            
            # Try to get from cache
            cached = _cache.get(key)
            if cached is not None:
                logger.debug(f"Cache hit for key: {key}")
                return cached
            
            # Get fresh value
            value = await func(*args, **kwargs)
            
            # Cache the result
            try:
                _cache.set(key, value, ttl)
                logger.debug(f"Cached response for key: {key}")
            except Exception as e:
                logger.error(f"Error caching response: {str(e)}")
            
            return value
        return wrapper
    return decorator

# Example usage in FastAPI endpoint:
"""
from fastapi import APIRouter
from api.middleware.cache import cache_response

router = APIRouter()

@router.get("/data")
@cache_response(ttl=300)  # Cache for 5 minutes
async def get_data():
    # Expensive operation here
    return {"data": "expensive result"}
""" 