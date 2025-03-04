"""
Retry utility with exponential backoff and circuit breaker pattern.
"""
import asyncio
import logging
from datetime import datetime, timedelta
from functools import wraps
from typing import Any, Callable, Dict, Optional, TypeVar

logger = logging.getLogger(__name__)

T = TypeVar('T')

class CircuitBreaker:
    """Circuit breaker to prevent repeated failed API calls."""
    
    def __init__(self, failure_threshold: int = 5, reset_timeout: int = 60):
        self.failure_count = 0
        self.failure_threshold = failure_threshold
        self.reset_timeout = reset_timeout
        self.last_failure_time: Optional[datetime] = None
        self.is_open = False

    def record_failure(self):
        """Record a failure and potentially open the circuit."""
        self.failure_count += 1
        self.last_failure_time = datetime.utcnow()
        
        if self.failure_count >= self.failure_threshold:
            self.is_open = True
            logger.warning(f"Circuit breaker opened after {self.failure_count} failures")

    def record_success(self):
        """Record a success and reset the failure count."""
        self.failure_count = 0
        self.last_failure_time = None
        self.is_open = False

    def can_execute(self) -> bool:
        """Check if the circuit is closed or can be reset."""
        if not self.is_open:
            return True

        # Check if enough time has passed to try again
        if self.last_failure_time and \
           datetime.utcnow() - self.last_failure_time > timedelta(seconds=self.reset_timeout):
            logger.info("Circuit breaker reset timeout reached, allowing retry")
            self.is_open = False
            self.failure_count = 0
            return True

        return False

class RetryWithBackoff:
    """Implements retry logic with exponential backoff."""
    
    def __init__(
        self,
        max_retries: int = 5,
        initial_delay: float = 1.0,
        max_delay: float = 30.0,
        exponential_base: float = 2.0,
        circuit_breaker: Optional[CircuitBreaker] = None
    ):
        self.max_retries = max_retries
        self.initial_delay = initial_delay
        self.max_delay = max_delay
        self.exponential_base = exponential_base
        self.circuit_breaker = circuit_breaker or CircuitBreaker()
        self._retry_state: Dict[str, Any] = {}

    def calculate_delay(self, attempt: int) -> float:
        """Calculate the delay for the current retry attempt."""
        delay = min(
            self.initial_delay * (self.exponential_base ** attempt),
            self.max_delay
        )
        # Add some jitter to prevent thundering herd
        jitter = delay * 0.1  # 10% jitter
        return delay + (jitter * (datetime.utcnow().microsecond / 1000000))

    def __call__(self, func: Callable[..., T]) -> Callable[..., T]:
        """Decorator to add retry logic to a function."""
        
        @wraps(func)
        async def wrapper(*args, **kwargs) -> T:
            attempt = 0
            
            while attempt <= self.max_retries:
                if not self.circuit_breaker.can_execute():
                    raise Exception("Circuit breaker is open")

                try:
                    result = await func(*args, **kwargs)
                    self.circuit_breaker.record_success()
                    return result

                except Exception as e:
                    attempt += 1
                    self.circuit_breaker.record_failure()
                    
                    if attempt > self.max_retries:
                        logger.error(
                            f"Max retries ({self.max_retries}) exceeded for {func.__name__}",
                            exc_info=True
                        )
                        raise

                    delay = self.calculate_delay(attempt)
                    logger.warning(
                        f"Attempt {attempt} failed for {func.__name__}. "
                        f"Retrying in {delay:.2f} seconds. Error: {str(e)}"
                    )
                    
                    # Check for retry-after header
                    if hasattr(e, 'response') and 'retry-after' in e.response.headers:
                        try:
                            retry_after = float(e.response.headers['retry-after'])
                            delay = max(delay, retry_after)
                        except (ValueError, TypeError):
                            pass

                    await asyncio.sleep(delay)

        return wrapper

# Example usage:
# @RetryWithBackoff(max_retries=3)
# async def fetch_data():
#     # API call here
#     pass 