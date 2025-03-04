"""
FastAPI server for the Collector Split Tool.
Provides endpoints for collector ranking and split management.
"""
from fastapi import FastAPI, HTTPException, Security, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import uvicorn
import logging
import os
import sys
from dotenv import load_dotenv

# Add project root to Python path
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if project_root not in sys.path:
    sys.path.append(project_root)

# Use absolute imports
from backend.config.settings import API_HOST, API_PORT, DEBUG_MODE
from backend.api.collectors import get_top_collectors
from backend.api.middleware.rate_limit import RateLimitMiddleware
from backend.api.websocket import handle_websocket, TransactionMonitor

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Collector Split Tool API",
    description="API for ranking collectors and managing NFT splits",
    version="1.0.0"
)

# Store transaction monitor in app state
app.state.transaction_monitor = TransactionMonitor()

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with specific origin
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    allow_websockets=True  # Explicitly allow WebSocket connections
)

# Add rate limiting
app.add_middleware(
    RateLimitMiddleware,
    requests_per_minute=10,
    exclude_paths=["/health", "/docs", "/openapi.json", "/ws/transactions"]
)

@app.websocket("/ws/transactions")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for transaction monitoring."""
    try:
        await handle_websocket(websocket)
    except Exception as e:
        logger.error(f"WebSocket error: {str(e)}")
        try:
            await websocket.close(code=1011)  # Internal error
        except:
            pass

class CollectorResponse(BaseModel):
    address: str
    total_nfts: int
    lifetime_spent: float
    recent_purchases: float
    score: float
    share: Optional[float] = None

@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy"}

@app.get("/api/collectors/{collection_address}", response_model=List[CollectorResponse])
async def get_collectors(collection_address: str):
    """
    Get ranked collectors for a specific collection.
    
    Args:
        collection_address: The FA2 contract address
    
    Returns:
        List of ranked collectors with their scores and suggested split shares
    """
    try:
        collectors = await get_top_collectors(collection_address)
        return collectors
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error fetching collector data: {str(e)}"
        )

if __name__ == "__main__":
    uvicorn.run(
        "backend.server:app",
        host=API_HOST,
        port=API_PORT,
        reload=DEBUG_MODE,
        log_level="debug"
    )
