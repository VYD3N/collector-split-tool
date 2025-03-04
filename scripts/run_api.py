import uvicorn
import os
import sys
from dotenv import load_dotenv

# Add project root to Python path
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(project_root)

# Load environment variables
load_dotenv()

def main():
    """Run the FastAPI server"""
    uvicorn.run(
        "backend.server:app",
        host="0.0.0.0",
        port=8000,
        reload=True,  # Enable auto-reload during development
        reload_excludes=["frontend/*", "*.pyc", "__pycache__", "node_modules"],
        ws="websockets"  # Explicitly specify WebSocket implementation
    )

if __name__ == "__main__":
    main() 