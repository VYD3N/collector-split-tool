"""
Configuration settings for the Collector Split Tool.
Contains constants, API endpoints, and other configuration variables.
"""
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# API Configuration
OBJKT_API_ENDPOINT = "https://api.objkt.com/v1/graphql"
TZKT_API_ENDPOINT = "https://api.tzkt.io/v1"  # Fallback API
TEZOS_RPC_URL = os.getenv("TEZOS_RPC_URL", "https://mainnet.api.tez.ie")

# Smart Contract Configuration
OPEN_EDITION_CONTRACT_ADDRESS = os.getenv("OPEN_EDITION_CONTRACT_ADDRESS")
NETWORK_TYPE = os.getenv("NETWORK_TYPE", "mainnet")  # or 'testnet'

# Collector Ranking Configuration
RANKING_WEIGHTS = {
    "total_nfts_owned": 0.40,  # 40% weight
    "lifetime_tez_spent": 0.40,  # 40% weight
    "recent_purchases": 0.20,  # 20% weight (last 30 days)
}

RECENT_PURCHASE_DAYS = 30  # Define what "recent" means in days

# API Keys and Authentication
OBJKT_API_KEY = os.getenv("OBJKT_API_KEY")
TZKT_API_KEY = os.getenv("TZKT_API_KEY")  # If needed for fallback

# Temple Wallet Configuration
TEMPLE_NETWORK = {
    "mainnet": {
        "rpc": "https://mainnet.api.tez.ie",
        "chainId": "NetXdQprcVkpaWU"
    },
    "testnet": {
        "rpc": "https://testnet.api.tez.ie",
        "chainId": "NetXm8tYqnMWky1"
    }
}

# Server Configuration
API_HOST = os.getenv("API_HOST", "0.0.0.0")
API_PORT = int(os.getenv("API_PORT", "5000"))
DEBUG_MODE = os.getenv("DEBUG_MODE", "False").lower() == "true"

# Cache Configuration
CACHE_TIMEOUT = 300  # 5 minutes cache for collector data

# Error Messages
ERROR_MESSAGES = {
    "wallet_not_connected": "Please connect your Temple Wallet to continue",
    "api_error": "Error fetching data from OBJKT API",
    "contract_error": "Error interacting with smart contract",
    "invalid_splits": "Invalid split configuration provided"
}
