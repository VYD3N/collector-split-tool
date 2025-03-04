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
    """Run the AI Processing API server"""
    uvicorn.run(
        "backend.ai_processing:app",
        host="0.0.0.0",
        port=8001,  # Different port from the main API
        reload=True  # Enable auto-reload during development
    )

if __name__ == "__main__":
    main() 