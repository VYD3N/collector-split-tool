import requests
import json
import time
from typing import Dict, Any

def check_health() -> bool:
    """Check if the API is healthy."""
    url = "http://localhost:8000/health"
    try:
        print("\nChecking API health...")
        response = requests.get(url)
        if response.status_code == 200:
            data = response.json()
            print(f"✅ API is healthy (status: {data['status']}, time: {data['timestamp']})")
            return True
        else:
            print(f"❌ API health check failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Error checking API health: {str(e)}")
        return False

def check_routes():
    """Check available API routes."""
    url = "http://localhost:8000/openapi.json"
    try:
        print("\nChecking available routes...")
        response = requests.get(url)
        if response.status_code == 200:
            routes = response.json()
            print("\nAvailable routes:")
            for path, methods in routes["paths"].items():
                print(f"\n📍 Path: {path}")
                for method, details in methods.items():
                    print(f"  • Method: {method.upper()}")
                    print(f"  • Summary: {details.get('summary', 'No summary')}")
            return True
        else:
            print(f"❌ Error getting routes: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Error checking routes: {str(e)}")
        return False

def test_qna(content: str, qna_type: str = "general") -> Dict[str, Any]:
    """Test the Q&A processing endpoint."""
    url = "http://localhost:8000/process_qna"
    headers = {
        "Content-Type": "application/json",
        "X-API-Key": "dev_key_123"
    }
    data = {
        "content": content,
        "type": qna_type
    }
    
    try:
        print(f"\nTesting Q&A processing...")
        print(f"Request:")
        print(f"• URL: {url}")
        print(f"• Type: {qna_type}")
        print(f"• Content: {content}")
        
        start_time = time.time()
        response = requests.post(url, headers=headers, json=data)
        processing_time = time.time() - start_time
        
        print(f"\nResponse (took {processing_time:.2f}s):")
        print(f"• Status Code: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print(f"• Processing Time: {result.get('processing_time', 0):.2f}s")
            print(f"• Content:\n{result.get('content', '')}")
            return result
        else:
            print(f"❌ Error: {response.text}")
            return {}
            
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return {}

def main():
    """Run all API tests."""
    print("🚀 Starting API tests...")
    
    # Check health
    if not check_health():
        print("❌ Stopping tests due to health check failure")
        return
    
    # Check routes
    if not check_routes():
        print("❌ Stopping tests due to route check failure")
        return
    
    # Test short query
    test_qna("What is the current time?", "general")
    
    # Test technical query
    test_qna(
        "How does the token counting system work in this API?",
        "technical"
    )
    
    print("\n✅ Tests completed!")

if __name__ == "__main__":
    main() 