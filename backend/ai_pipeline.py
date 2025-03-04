from fastapi import FastAPI, File, UploadFile, HTTPException, Security, Depends
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security.api_key import APIKeyHeader
import os
import aiohttp
import json
from typing import Optional, List
from datetime import datetime
import logging
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('ai_pipeline.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(title="AI Pipeline API")

# Security settings
API_KEY = os.getenv("API_KEY", "your-secure-api-key")  # Change in production
api_key_header = APIKeyHeader(name="X-API-Key")

# CORS settings - restrict to specific origins in production
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)

# Directory to store logs
LOGS_DIR = os.path.join(os.path.dirname(__file__), "qna_logs")
os.makedirs(LOGS_DIR, exist_ok=True)

# AI processing endpoint
AI_PROCESSING_URL = os.getenv("AI_PROCESSING_URL", "https://YOUR_AI_PROCESSING_ENDPOINT")

async def verify_api_key(api_key: str = Security(api_key_header)) -> bool:
    """Verify the API key"""
    if api_key != API_KEY:
        logger.warning(f"Invalid API key attempt")
        raise HTTPException(
            status_code=403,
            detail="Invalid API key"
        )
    return True

async def process_qna_with_ai(content: str) -> Optional[str]:
    """Send Q&A content to AI for processing"""
    start_time = datetime.now()
    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(
                AI_PROCESSING_URL,
                json={"content": content},
                timeout=30  # 30 second timeout
            ) as response:
                if response.status == 200:
                    result = await response.text()
                    processing_time = (datetime.now() - start_time).total_seconds()
                    logger.info(f"AI processing completed in {processing_time:.2f} seconds")
                    return result
                else:
                    error_text = await response.text()
                    logger.error(f"AI processing failed: {error_text}")
                    raise HTTPException(
                        status_code=500,
                        detail=f"AI processing failed: {error_text}"
                    )
    except asyncio.TimeoutError:
        logger.error("AI processing timeout")
        raise HTTPException(
            status_code=504,
            detail="AI processing timeout"
        )
    except Exception as e:
        logger.error(f"Error communicating with AI service: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error communicating with AI service: {str(e)}"
        )

@app.post("/upload_qna")
async def upload_qna(
    file: UploadFile = File(...),
    authenticated: bool = Depends(verify_api_key)
):
    """Endpoint to receive Q&A log from Cursor AI and process it"""
    start_time = datetime.now()
    try:
        content = await file.read()
        content_str = content.decode()
        
        # Process with AI
        updated_content = await process_qna_with_ai(content_str)
        
        if updated_content:
            # Save with timestamp
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            file_path = os.path.join(LOGS_DIR, f"qna_log_{timestamp}.txt")
            
            with open(file_path, "w") as f:
                f.write(updated_content)
            
            processing_time = (datetime.now() - start_time).total_seconds()
            logger.info(f"File processed and saved in {processing_time:.2f} seconds")
            
            return JSONResponse(
                content={
                    "message": "Q&A Log processed and saved successfully",
                    "processing_time": processing_time
                },
                status_code=200
            )
        
        return JSONResponse(
            content={"error": "Failed to process Q&A log"},
            status_code=500
        )
        
    except Exception as e:
        logger.error(f"Error processing file: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error processing file: {str(e)}"
        )

@app.get("/get_qna")
async def get_qna(authenticated: bool = Depends(verify_api_key)):
    """Endpoint to fetch the latest Q&A log"""
    try:
        # Get the most recent log file
        files = os.listdir(LOGS_DIR)
        if not files:
            raise HTTPException(
                status_code=404,
                detail="No Q&A logs found"
            )
            
        latest_file = max(
            [f for f in files if f.startswith("qna_log_")],
            key=lambda x: os.path.getctime(os.path.join(LOGS_DIR, x))
        )
        
        file_path = os.path.join(LOGS_DIR, latest_file)
        with open(file_path, "r") as f:
            content = f.read()
            
        return JSONResponse(
            content={
                "qna_log": content,
                "timestamp": datetime.fromtimestamp(
                    os.path.getctime(file_path)
                ).isoformat()
            },
            status_code=200
        )
        
    except Exception as e:
        logger.error(f"Error retrieving Q&A log: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error retrieving Q&A log: {str(e)}"
        )

@app.get("/health")
async def health_check():
    """Health check endpoint - no authentication required"""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat()
    } 