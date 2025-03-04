"""
Rate limiting middleware for FastAPI.
Implements a sliding window rate limit using Redis or in-memory storage.
"""
import time
from collections import defaultdict
from datetime import datetime
from typing import Dict, Optional, Tuple
import logging
from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger(__name__)

class RateLimiter:
    """
    Sliding window rate limiter.
    Can be extended to use Redis for distributed deployments.
    """
    def __init__(
        self,
        requests_per_minute: int = 10,
        window_size: int = 60,
        cleanup_interval: int = 300
    ):
        self.requests_per_minute = requests_per_minute
        self.window_size = window_size  # in seconds
        self.cleanup_interval = cleanup_interval  # in seconds
        self.last_cleanup = time.time()
        
        # Store request timestamps per IP
        # Format: {ip: [(timestamp, request_count), ...]}
        self._requests: Dict[str, list] = defaultdict(list)

    def _cleanup_old_requests(self, current_time: float):
        """Remove request records older than window_size."""
        if current_time - self.last_cleanup > self.cleanup_interval:
            cutoff = current_time - self.window_size
            for ip in list(self._requests.keys()):
                self._requests[ip] = [
                    r for r in self._requests[ip]
                    if r[0] > cutoff
                ]
                if not self._requests[ip]:
                    del self._requests[ip]
            self.last_cleanup = current_time

    def is_rate_limited(self, ip: str) -> Tuple[bool, Optional[float]]:
        """
        Check if the IP has exceeded its rate limit.
        
        Returns:
            Tuple of (is_limited, retry_after)
        """
        current_time = time.time()
        self._cleanup_old_requests(current_time)
        
        # Get requests in current window
        window_start = current_time - self.window_size
        requests = self._requests[ip]
        
        # Remove old requests
        requests = [r for r in requests if r[0] > window_start]
        self._requests[ip] = requests
        
        # Calculate current request count
        total_requests = sum(r[1] for r in requests)
        
        if total_requests >= self.requests_per_minute:
            # Calculate when the oldest request will expire
            if requests:
                oldest_timestamp = requests[0][0]
                retry_after = oldest_timestamp + self.window_size - current_time
                return True, max(0, retry_after)
            return True, float(self.window_size)
        
        # Add current request
        requests.append((current_time, 1))
        return False, None

class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    FastAPI middleware for rate limiting.
    """
    def __init__(
        self,
        app,
        requests_per_minute: int = 10,
        exclude_paths: Optional[list] = None
    ):
        super().__init__(app)
        self.limiter = RateLimiter(requests_per_minute=requests_per_minute)
        self.exclude_paths = exclude_paths or ["/health"]

    async def dispatch(self, request: Request, call_next):
        """Process each request through the rate limiter."""
        # Skip rate limiting for excluded paths
        if request.url.path in self.exclude_paths:
            return await call_next(request)

        # Get client IP
        client_ip = request.client.host if request.client else "unknown"
        
        # Check rate limit
        is_limited, retry_after = self.limiter.is_rate_limited(client_ip)
        
        if is_limited:
            logger.warning(f"Rate limit exceeded for IP: {client_ip}")
            headers = {
                "Retry-After": str(int(retry_after)) if retry_after else "60"
            }
            raise HTTPException(
                status_code=429,
                detail="Too many requests",
                headers=headers
            )

        # Process the request
        response = await call_next(request)
        return response

# Example usage in FastAPI app:
"""
from fastapi import FastAPI
from api.middleware.rate_limit import RateLimitMiddleware

app = FastAPI()
app.add_middleware(
    RateLimitMiddleware,
    requests_per_minute=10,
    exclude_paths=["/health", "/docs"]
)
""" 