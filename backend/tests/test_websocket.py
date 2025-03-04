"""
Tests for WebSocket transaction monitoring.
"""
import pytest
import asyncio
import websockets
import json
from typing import AsyncGenerator
from fastapi import FastAPI
from fastapi.testclient import TestClient
import pytest_asyncio
import uvicorn
import multiprocessing
import time
import os
import sys
import signal
import logging
import socket
from contextlib import closing

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# Add project root to Python path
project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if project_root not in sys.path:
    sys.path.append(project_root)

from backend.server import app
from backend.api.websocket import TransactionMonitor

def find_free_port():
    """Find a free port to use for testing."""
    with closing(socket.socket(socket.AF_INET, socket.SOCK_STREAM)) as s:
        s.bind(('', 0))
        s.listen(1)
        port = s.getsockname()[1]
        return port

# Test configuration
TEST_HOST = "127.0.0.1"  # Use localhost IP explicitly
TEST_PORT = find_free_port()
WS_URL = f"ws://{TEST_HOST}:{TEST_PORT}/ws/transactions"

def run_server(host: str, port: int):
    """Run the FastAPI server."""
    # Initialize transaction monitor
    app.state.transaction_monitor = TransactionMonitor()
    
    config = uvicorn.Config(
        app,
        host=host,
        port=port,
        log_level="debug",
        loop="asyncio",
        ws="websockets"  # Explicitly specify WebSocket implementation
    )
    server = uvicorn.Server(config)
    server.run()

@pytest.fixture(scope="session", autouse=True)
def start_server():
    """Start the FastAPI server in a separate process."""
    # Start server process
    server_process = multiprocessing.Process(
        target=run_server,
        args=(TEST_HOST, TEST_PORT),
        daemon=True
    )
    server_process.start()
    
    # Wait for server to start
    max_retries = 30
    retry_interval = 0.5
    for _ in range(max_retries):
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
                if sock.connect_ex((TEST_HOST, TEST_PORT)) == 0:
                    # Wait a bit more to ensure WebSocket is ready
                    time.sleep(2)
                    break
        except:
            pass
        time.sleep(retry_interval)
    else:
        raise RuntimeError("Server startup timeout")
    
    yield
    
    # Cleanup
    if server_process.is_alive():
        server_process.terminate()
        server_process.join(timeout=5)

@pytest_asyncio.fixture
async def websocket_client() -> AsyncGenerator[websockets.WebSocketClientProtocol, None]:
    """Create a WebSocket client."""
    try:
        async with websockets.connect(
            WS_URL,
            ping_interval=None,
            close_timeout=1,
            max_size=None  # No message size limit
        ) as websocket:
            logger.info("WebSocket client connected")
            yield websocket
            logger.info("WebSocket client disconnected")
    except Exception as e:
        logger.error(f"Error in WebSocket client: {str(e)}")
        raise

@pytest.fixture
def test_client():
    """Create a test client."""
    return TestClient(app)

@pytest.mark.asyncio
async def test_websocket_connection(websocket_client):
    """Test WebSocket connection and subscription."""
    try:
        # Send subscription message
        message = {
            "type": "subscribe",
            "operation_hash": "test_hash"
        }
        logger.info(f"Sending subscription message: {message}")
        await websocket_client.send(json.dumps(message))
        
        # Wait for response
        response = await websocket_client.recv()
        logger.info(f"Received response: {response}")
        
        # Should stay connected
        assert websocket_client.open
    except Exception as e:
        logger.error(f"Error in test_websocket_connection: {str(e)}")
        raise

@pytest.mark.asyncio
async def test_invalid_subscription(websocket_client):
    """Test invalid subscription message."""
    try:
        # Send invalid message
        message = {
            "type": "invalid",
            "operation_hash": "test_hash"
        }
        logger.info(f"Sending invalid message: {message}")
        await websocket_client.send(json.dumps(message))
        
        # Should receive error and close
        try:
            response = await websocket_client.recv()
            logger.info(f"Received unexpected response: {response}")
            assert False, "Expected connection to close"
        except websockets.exceptions.ConnectionClosed as e:
            logger.info(f"Connection closed as expected with code: {e.code}")
            assert e.code == 1003  # Unsupported data
    except Exception as e:
        logger.error(f"Error in test_invalid_subscription: {str(e)}")
        raise

@pytest.mark.asyncio
async def test_transaction_updates(websocket_client):
    """Test transaction status updates."""
    try:
        # Subscribe
        message = {
            "type": "subscribe",
            "operation_hash": "test_hash"
        }
        logger.info(f"Sending subscription message: {message}")
        await websocket_client.send(json.dumps(message))
        
        # Wait for subscription confirmation
        response = await websocket_client.recv()
        logger.info(f"Received subscription response: {response}")
        
        # Simulate transaction update
        update = {
            "status": "pending",
            "confirmations": 1
        }
        logger.info(f"Broadcasting update: {update}")
        await app.state.transaction_monitor.broadcast_update(
            "test_hash",
            update
        )
        
        # Receive update
        response = await websocket_client.recv()
        logger.info(f"Received update response: {response}")
        data = json.loads(response)
        assert data["status"] == "pending"
        assert data["confirmations"] == 1
    except Exception as e:
        logger.error(f"Error in test_transaction_updates: {str(e)}")
        raise

@pytest.mark.asyncio
async def test_multiple_clients():
    """Test multiple clients monitoring same transaction."""
    try:
        async with websockets.connect(WS_URL) as ws1, \
                  websockets.connect(WS_URL) as ws2:
            logger.info("Connected both WebSocket clients")
            
            # Both subscribe to same transaction
            message = json.dumps({
                "type": "subscribe",
                "operation_hash": "test_hash"
            })
            logger.info(f"Sending subscription message to both clients: {message}")
            await ws1.send(message)
            await ws2.send(message)
            
            # Wait for subscription confirmations
            response1 = await ws1.recv()
            response2 = await ws2.recv()
            logger.info(f"Received subscription responses: {response1}, {response2}")
            
            # Simulate update
            update = {
                "status": "confirmed",
                "confirmations": 3
            }
            logger.info(f"Broadcasting update: {update}")
            await app.state.transaction_monitor.broadcast_update(
                "test_hash",
                update
            )
            
            # Both should receive update
            response1 = await ws1.recv()
            response2 = await ws2.recv()
            logger.info(f"Received update responses: {response1}, {response2}")
            
            data1 = json.loads(response1)
            data2 = json.loads(response2)
            assert data1 == data2
            assert data1["status"] == "confirmed"
    except Exception as e:
        logger.error(f"Error in test_multiple_clients: {str(e)}")
        raise

@pytest.mark.asyncio
async def test_cleanup(websocket_client):
    """Test transaction cleanup."""
    try:
        # Subscribe
        message = {
            "type": "subscribe",
            "operation_hash": "test_hash"
        }
        logger.info(f"Sending subscription message: {message}")
        await websocket_client.send(json.dumps(message))
        
        # Wait for subscription confirmation
        response = await websocket_client.recv()
        logger.info(f"Received subscription response: {response}")
        
        # Simulate completed transaction
        update = {
            "status": "confirmed",
            "confirmations": 3
        }
        logger.info(f"Broadcasting update: {update}")
        await app.state.transaction_monitor.broadcast_update(
            "test_hash",
            update
        )
        
        # Clean up
        logger.info("Cleaning up transaction")
        app.state.transaction_monitor.cleanup_transaction("test_hash")
        
        # Transaction should be removed
        assert "test_hash" not in app.state.transaction_monitor.transactions
    except Exception as e:
        logger.error(f"Error in test_cleanup: {str(e)}")
        raise

@pytest.mark.asyncio
async def test_unsubscribe(websocket_client):
    """Test client unsubscription."""
    try:
        # Subscribe
        subscribe_message = {
            "type": "subscribe",
            "operation_hash": "test_hash"
        }
        logger.info(f"Sending subscription message: {subscribe_message}")
        await websocket_client.send(json.dumps(subscribe_message))
        
        # Wait for subscription confirmation
        response = await websocket_client.recv()
        logger.info(f"Received subscription response: {response}")
        
        # Unsubscribe
        unsubscribe_message = {
            "type": "unsubscribe",
            "operation_hash": "test_hash"
        }
        logger.info(f"Sending unsubscribe message: {unsubscribe_message}")
        await websocket_client.send(json.dumps(unsubscribe_message))
        
        # Connection should close
        try:
            response = await websocket_client.recv()
            logger.info(f"Received unexpected response: {response}")
            assert False, "Expected connection to close"
        except websockets.exceptions.ConnectionClosed:
            logger.info("Connection closed as expected")
            pass
    except Exception as e:
        logger.error(f"Error in test_unsubscribe: {str(e)}")
        raise 