"""
WebSocket server for real-time transaction monitoring.
"""
from fastapi import WebSocket, WebSocketDisconnect
from typing import Dict, Set
import logging
import json
from datetime import datetime

logger = logging.getLogger(__name__)

class TransactionMonitor:
    """Manages WebSocket connections and transaction updates."""
    
    def __init__(self):
        # Store active connections
        # Format: {operation_hash: set(WebSocket)}
        self.connections: Dict[str, Set[WebSocket]] = {}
        
        # Store transaction statuses
        # Format: {operation_hash: TransactionStatus}
        self.transactions: Dict[str, dict] = {}
    
    async def connect(self, websocket: WebSocket, operation_hash: str):
        """
        Connect a new WebSocket client.
        
        Args:
            websocket: The WebSocket connection
            operation_hash: The operation hash to monitor
        """
        await websocket.accept()  # Accept the connection first
        
        if operation_hash not in self.connections:
            self.connections[operation_hash] = set()
        self.connections[operation_hash].add(websocket)
        
        # Send current status if available
        if operation_hash in self.transactions:
            await websocket.send_json(self.transactions[operation_hash])
            
        # Send connection confirmation
        await websocket.send_json({
            "type": "connected",
            "operation_hash": operation_hash,
            "timestamp": datetime.utcnow().isoformat()
        })
    
    def disconnect(self, websocket: WebSocket, operation_hash: str):
        """
        Disconnect a WebSocket client.
        
        Args:
            websocket: The WebSocket connection
            operation_hash: The operation hash being monitored
        """
        if operation_hash in self.connections:
            self.connections[operation_hash].discard(websocket)
            if not self.connections[operation_hash]:
                del self.connections[operation_hash]
                # Also cleanup transaction data if no more connections
                if operation_hash in self.transactions:
                    del self.transactions[operation_hash]
    
    async def broadcast_update(self, operation_hash: str, status: dict):
        """
        Broadcast status update to all connected clients.
        
        Args:
            operation_hash: The operation hash
            status: The status update to broadcast
        """
        if operation_hash not in self.connections:
            return
            
        # Store latest status
        self.transactions[operation_hash] = status
        
        # Add timestamp
        status['timestamp'] = datetime.utcnow().isoformat()
        
        # Broadcast to all connected clients
        disconnected = set()
        for connection in self.connections[operation_hash]:
            try:
                await connection.send_json(status)
            except Exception as e:
                logger.error(f"Error sending update: {str(e)}")
                disconnected.add(connection)
                
        # Clean up disconnected clients
        for connection in disconnected:
            self.disconnect(connection, operation_hash)

async def handle_websocket(websocket: WebSocket):
    """
    Handle WebSocket connection lifecycle.
    
    Args:
        websocket: The WebSocket connection
    """
    operation_hash = None
    try:
        # Get transaction monitor from app state
        transaction_monitor = websocket.app.state.transaction_monitor
        
        # Wait for subscription message
        message = await websocket.receive_json()
        
        if message.get('type') != 'subscribe' or 'operation_hash' not in message:
            await websocket.close(code=1003)  # Unsupported data
            return
            
        operation_hash = message['operation_hash']
        
        # Connect to monitor
        await transaction_monitor.connect(websocket, operation_hash)
        
        try:
            while True:
                # Keep connection alive and handle client messages
                data = await websocket.receive_json()
                if data.get('type') == 'unsubscribe':
                    break
                    
        except WebSocketDisconnect:
            pass
            
    except Exception as e:
        logger.error(f"WebSocket error: {str(e)}")
        try:
            await websocket.close(code=1011)  # Internal error
        except:
            pass
            
    finally:
        if operation_hash:
            transaction_monitor.disconnect(websocket, operation_hash) 