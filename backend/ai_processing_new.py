"""
AI Processing API implementation for Q&A processing.
"""
from fastapi import FastAPI, HTTPException, Security
from fastapi.security.api_key import APIKeyHeader
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import os
import traceback
from dotenv import load_dotenv
import logging
from datetime import datetime
from typing import Dict, Any, Optional, List, Union
from enum import Enum
from openai import AsyncOpenAI
import tiktoken

# Configure logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# Initialize OpenAI client
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
if not OPENAI_API_KEY:
    logger.error("OpenAI API key not found in environment variables")
    raise RuntimeError("OpenAI API key not found")

logger.info("OpenAI API key loaded successfully")
client = AsyncOpenAI(api_key=OPENAI_API_KEY)
MODEL_NAME = os.getenv("MODEL_NAME", "gpt-4")

# Token management constants
MAX_TOTAL_TOKENS = 8192  # OpenAI's max token limit
MAX_COMPLETION_TOKENS = 2048  # Maximum tokens to request for completion
MIN_COMPLETION_TOKENS = 256  # Minimum tokens needed for completion
BUFFER_TOKENS = 200  # Safety margin for OpenAI's internal use
TEMPERATURE = float(os.getenv("TEMPERATURE", "0.7"))

# Initialize tokenizer
try:
    TOKENIZER = tiktoken.encoding_for_model(MODEL_NAME)
    logger.info("Initialized tiktoken tokenizer successfully")
except Exception as e:
    logger.warning(f"Failed to initialize tiktoken: {str(e)}")
    TOKENIZER = None

logger.info(f"Using model: {MODEL_NAME}")
logger.info(f"Max total tokens: {MAX_TOTAL_TOKENS}")
logger.info(f"Max completion tokens: {MAX_COMPLETION_TOKENS}")
logger.info(f"Temperature: {TEMPERATURE}")

# Initialize FastAPI app
app = FastAPI(title="AI Processing API")

# Security settings
API_KEY = os.getenv("API_KEY", "dev_key_123")
api_key_header = APIKeyHeader(name="X-API-Key")

# CORS settings
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)

class QnAType(str, Enum):
    """Types of Q&A interactions for specialized prompting."""
    GENERAL = "general"
    TECHNICAL = "technical"
    DEBUGGING = "debugging"
    PLANNING = "planning"
    REVIEW = "review"

class QnARequest(BaseModel):
    """Enhanced request model for Q&A processing."""
    content: str
    type: QnAType = QnAType.GENERAL
    context: Optional[Dict[str, Any]] = None

def count_tokens(text: str) -> int:
    """
    Count tokens accurately using tiktoken or estimate if not available.
    """
    if TOKENIZER:
        return len(TOKENIZER.encode(text))
    else:
        # Fallback to estimation
        return int(len(text.split()) * 1.5)  # Approximation

def count_message_tokens(messages: List[Dict[str, str]]) -> int:
    """
    Count total tokens in messages, including formatting tokens.
    """
    total_tokens = 0
    for message in messages:
        # Count content tokens
        content_tokens = count_tokens(message["content"])
        # Add message formatting tokens (role, content markers, etc.)
        format_tokens = 4  # OpenAI's format tokens per message
        total_tokens += content_tokens + format_tokens
        
    logger.debug(f"Total message tokens: {total_tokens}")
    return total_tokens

def get_prompt_template(qna_type: QnAType) -> str:
    """Get appropriate prompt template based on Q&A type."""
    templates = {
        QnAType.TECHNICAL: """You are a technical expert. Provide a concise response focusing on:
1. Core solution
2. Best practices
3. Key considerations

Content to process:
{content}""",
        QnAType.DEBUGGING: """You are a debugging expert. Provide a concise response focusing on:
1. Likely causes
2. Debug steps
3. Solution steps

Content to process:
{content}""",
        QnAType.GENERAL: """You are a helpful AI assistant. Provide a clear and concise response.

Content to process:
{content}"""
    }
    return templates.get(qna_type, templates[QnAType.GENERAL])

async def verify_api_key(api_key: str = Security(api_key_header)) -> bool:
    """Verify the API key."""
    if api_key != API_KEY:
        logger.warning(f"Invalid API key attempt")
        raise HTTPException(
            status_code=403,
            detail="Invalid API key"
        )
    return True

@app.post("/process_qna")
async def process_qna(
    request: QnARequest,
    authenticated: bool = Security(verify_api_key)
):
    """
    Process Q&A content with improved token management.
    """
    try:
        logger.info(f"Processing {request.type} Q&A content of length: {len(request.content)}")
        
        # Verify OpenAI API key is set
        if not OPENAI_API_KEY:
            error_msg = "OpenAI API key not found in environment"
            logger.error(f"🚨 {error_msg}")
            return JSONResponse(
                status_code=500,
                content={"detail": f"Configuration error: {error_msg}"}
            )
        
        # Prepare prompt and count tokens early
        prompt = get_prompt_template(request.type).format(content=request.content)
        messages = [{"role": "user", "content": prompt}]
        input_tokens = count_message_tokens(messages)
        
        # Early token limit validation
        if input_tokens >= MAX_TOTAL_TOKENS - MIN_COMPLETION_TOKENS - BUFFER_TOKENS:
            error_msg = (
                f"Input exceeds maximum token limit. "
                f"Input tokens: {input_tokens}, "
                f"Maximum allowed input: {MAX_TOTAL_TOKENS - MIN_COMPLETION_TOKENS - BUFFER_TOKENS} tokens"
            )
            logger.error(f"🚨 {error_msg}")
            return JSONResponse(
                status_code=400,
                content={"detail": error_msg}
            )
            
        logger.info(f"📌 Input tokens: {input_tokens}")
        
        # Calculate available tokens for completion
        available_tokens = MAX_TOTAL_TOKENS - input_tokens - BUFFER_TOKENS
        
        # Cap completion tokens to available space
        max_completion_tokens = min(available_tokens, MAX_COMPLETION_TOKENS)
        
        # Log token calculations
        logger.info(f"📌 Available tokens: {available_tokens}")
        logger.info(f"📌 Max completion tokens: {max_completion_tokens}")
        logger.info(f"📌 Total request tokens: {input_tokens + max_completion_tokens}")
        logger.info(f"📌 Buffer tokens: {BUFFER_TOKENS}")
        
        # Make API call
        try:
            logger.info("Making OpenAI API call...")
            logger.debug(f"Request: model={MODEL_NAME}, max_tokens={max_completion_tokens}, temperature={TEMPERATURE}")
            
            response = await client.chat.completions.create(
                model=MODEL_NAME,
                messages=messages,
                max_tokens=max_completion_tokens,
                temperature=TEMPERATURE,
                timeout=30
            )
            
            content = response.choices[0].message.content
            processing_time = response.response_ms / 1000 if hasattr(response, 'response_ms') else 0.1
            
            logger.info(f"OpenAI API call successful (took {processing_time:.2f}s)")
            return {
                "content": content,
                "processing_time": processing_time,
                "token_info": {
                    "input_tokens": input_tokens,
                    "completion_tokens": max_completion_tokens,
                    "total_tokens": input_tokens + max_completion_tokens,
                    "max_tokens": MAX_TOTAL_TOKENS,
                    "buffer_tokens": BUFFER_TOKENS,
                    "available_tokens": available_tokens
                }
            }
        except Exception as api_error:
            error_msg = f"OpenAI API error: {str(api_error)}"
            logger.error(f"🚨 {error_msg}")
            logger.error(traceback.format_exc())
            return JSONResponse(
                status_code=500,
                content={"detail": error_msg}
            )
            
    except HTTPException:
        raise
    except Exception as e:
        error_msg = f"Error processing Q&A content: {str(e)}"
        logger.error(f"🚨 {error_msg}")
        logger.error(traceback.format_exc())
        return JSONResponse(
            status_code=500,
            content={"detail": error_msg}
        )

@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat()
    }