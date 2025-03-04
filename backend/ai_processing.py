"""
AI Processing API implementation for Q&A log processing using GPT-4o.
"""
from fastapi import FastAPI, HTTPException, Security, BackgroundTasks
from fastapi.security.api_key import APIKeyHeader
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import os
from openai import OpenAI  # Using new style import for v1.0+
from dotenv import load_dotenv
import logging
from datetime import datetime, timedelta
import tiktoken
import asyncio
import json
from typing import Dict, Any, List, Optional, Union
from enum import Enum
from collections import deque

# Load environment variables
load_dotenv()

# Configure OpenAI with v1.0+ style
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
MODEL_NAME = os.getenv("MODEL_NAME", "gpt-4")  # Default to gpt-4 if not specified
MAX_TOKENS = int(os.getenv("MAX_TOKENS", "8192"))
TEMPERATURE = float(os.getenv("TEMPERATURE", "0.7"))

# Cost Alert Thresholds
DAILY_COST_THRESHOLD = float(os.getenv("DAILY_COST_THRESHOLD", "10.0"))  # Alert at $10/day
HOURLY_TOKEN_THRESHOLD = int(os.getenv("HOURLY_TOKEN_THRESHOLD", "100000"))  # Alert at 100K tokens/hour

# Configure logging
logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO"),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('ai_processing.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

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
    allow_methods=["POST"],
    allow_headers=["*"],
)

class QnAType(str, Enum):
    """Types of Q&A interactions for specialized prompting."""
    GENERAL = "general"
    TECHNICAL = "technical"
    DEBUGGING = "debugging"
    PLANNING = "planning"
    REVIEW = "review"

class Message(BaseModel):
    """Model for conversation messages."""
    role: str
    content: str
    timestamp: datetime = Field(default_factory=datetime.now)

class ConversationMemory:
    """Enhanced conversation memory with token management."""
    def __init__(self, max_tokens: int = 4000):
        self.messages: deque[Message] = deque()
        self.max_tokens = max_tokens
    
    def add_message(self, role: str, content: str):
        """Add a message while maintaining token limits."""
        message = Message(role=role, content=content)
        self.messages.append(message)
        self._truncate_if_needed()
        
    def get_recent_messages(self, num_messages: Optional[int] = None) -> List[Dict[str, str]]:
        """Get recent messages in OpenAI format."""
        messages = list(self.messages)
        if num_messages:
            messages = messages[-num_messages:]
        return [{"role": msg.role, "content": msg.content} for msg in messages]
        
    def _truncate_if_needed(self):
        """Truncate conversation history if token limit exceeded."""
        total_tokens = sum(count_tokens(msg.content) for msg in self.messages)
        while total_tokens > self.max_tokens and len(self.messages) > 1:
            removed_msg = self.messages.popleft()
            total_tokens -= count_tokens(removed_msg.content)

class QnARequest(BaseModel):
    """Enhanced request model for Q&A processing."""
    content: str
    type: QnAType = QnAType.GENERAL
    context: Optional[Dict[str, Any]] = None
    conversation_id: Optional[str] = None
    max_context_messages: Optional[int] = 5
    optimize_tokens: bool = False

class Alert(BaseModel):
    """Model for usage alerts."""
    type: str
    message: str
    threshold: float
    current_value: float
    timestamp: datetime

class APIUsageTracker:
    """Enhanced API usage tracking with alerts."""
    def __init__(self):
        self.total_tokens = 0
        self.total_cost = 0
        self.total_calls = 0
        self.failures = 0
        self.response_times = []
        self.hourly_tokens = []
        self.daily_costs = []
        self.alerts: List[Alert] = []
        self.last_alert_check = datetime.now()

    def update(self, tokens: int, cost: float, response_time: float):
        """Update usage statistics and check thresholds."""
        self.total_tokens += tokens
        self.total_cost += cost
        self.total_calls += 1
        self.response_times.append(response_time)

        # Track hourly token usage
        current_hour = datetime.now().replace(minute=0, second=0, microsecond=0)
        self.hourly_tokens.append((current_hour, tokens))
        self.daily_costs.append((datetime.now(), cost))

        # Clean up old data
        self._cleanup_old_data()

        # Check thresholds
        self._check_thresholds()

    def _cleanup_old_data(self):
        """Remove data older than retention period."""
        now = datetime.now()
        hour_ago = now - timedelta(hours=1)
        day_ago = now - timedelta(days=1)

        self.hourly_tokens = [(t, c) for t, c in self.hourly_tokens if t > hour_ago]
        self.daily_costs = [(t, c) for t, c in self.daily_costs if t > day_ago]
        self.response_times = self.response_times[-1000:]  # Keep last 1000 response times

    def _check_thresholds(self):
        """Check usage against thresholds and generate alerts."""
        now = datetime.now()
        
        # Check only every 5 minutes
        if (now - self.last_alert_check).total_seconds() < 300:
            return

        # Check hourly token usage
        hourly_total = sum(tokens for _, tokens in self.hourly_tokens)
        if hourly_total > HOURLY_TOKEN_THRESHOLD:
            self._add_alert("TOKEN_USAGE", f"Hourly token usage ({hourly_total}) exceeded threshold",
                          HOURLY_TOKEN_THRESHOLD, hourly_total)

        # Check daily cost
        daily_total = sum(cost for _, cost in self.daily_costs)
        if daily_total > DAILY_COST_THRESHOLD:
            self._add_alert("COST", f"Daily cost (${daily_total:.2f}) exceeded threshold",
                          DAILY_COST_THRESHOLD, daily_total)

        self.last_alert_check = now

    def _add_alert(self, alert_type: str, message: str, threshold: float, current_value: float):
        """Add a new alert."""
        alert = Alert(
            type=alert_type,
            message=message,
            threshold=threshold,
            current_value=current_value,
            timestamp=datetime.now()
        )
        self.alerts.append(alert)
        logger.warning(f"Alert generated: {message}")

    def get_stats(self) -> Dict[str, Any]:
        """Get enhanced usage statistics."""
        avg_response_time = sum(self.response_times) / len(self.response_times) if self.response_times else 0
        hourly_total = sum(tokens for _, tokens in self.hourly_tokens)
        daily_total_cost = sum(cost for _, cost in self.daily_costs)

        return {
            "total_tokens": self.total_tokens,
            "total_cost": self.total_cost,
            "total_calls": self.total_calls,
            "failures": self.failures,
            "average_response_time": avg_response_time,
            "last_hour_tokens": hourly_total,
            "last_24h_cost": daily_total_cost,
            "recent_alerts": [alert.dict() for alert in self.alerts[-5:]],  # Last 5 alerts
            "performance_metrics": {
                "avg_tokens_per_call": self.total_tokens / self.total_calls if self.total_calls else 0,
                "success_rate": (self.total_calls - self.failures) / self.total_calls if self.total_calls else 0,
                "avg_cost_per_call": self.total_cost / self.total_calls if self.total_calls else 0
            }
        }

# Initialize usage tracker
usage_tracker = APIUsageTracker()

# Initialize conversation memory store
conversation_store: Dict[str, ConversationMemory] = {}

def count_tokens(text: str) -> int:
    """Count tokens in text using tiktoken."""
    try:
        encoding = tiktoken.encoding_for_model(MODEL_NAME)
        return len(encoding.encode(text))
    except Exception as e:
        logger.warning(f"Error counting tokens: {str(e)}")
        return len(text.split()) * 2  # Rough estimation

def get_prompt_template(qna_type: QnAType, context: Optional[Dict[str, Any]] = None) -> str:
    """Get enhanced prompt template based on Q&A type and context."""
    base_prompts = {
        QnAType.GENERAL: """You are an AI assistant processing Q&A logs. 
Focus on providing clear, structured responses with actionable next steps.
When appropriate, include:
1. Summary of key points
2. Specific recommendations
3. Potential challenges to consider
4. Next steps or action items""",
        
        QnAType.TECHNICAL: """You are a technical expert processing Q&A logs.
Provide detailed technical analysis with:
1. Code examples and best practices
2. Error handling considerations
3. Performance implications
4. Security considerations
5. Testing recommendations""",
        
        QnAType.DEBUGGING: """You are a debugging specialist analyzing issues.
Follow this structured approach:
1. Problem identification
2. Root cause analysis
3. Step-by-step troubleshooting
4. Solution implementation
5. Prevention strategies""",
        
        QnAType.PLANNING: """You are a planning specialist.
Break down the request into:
1. Task decomposition
2. Complexity assessment
3. Resource requirements
4. Timeline estimates
5. Risk analysis
6. Implementation strategy""",
        
        QnAType.REVIEW: """You are a code review specialist.
Evaluate the code considering:
1. Code quality and style
2. Performance optimization
3. Security vulnerabilities
4. Maintainability
5. Test coverage
6. Documentation needs"""
    }
    
    prompt = base_prompts.get(qna_type, base_prompts[QnAType.GENERAL])
    
    if context:
        prompt += f"\n\nContext: {json.dumps(context)}"
    
    return prompt

def calculate_cost(prompt_tokens: int, completion_tokens: int, model: str) -> float:
    """Calculate the cost of API usage based on token counts and model."""
    rates = {
        "gpt-4": {"prompt": 0.03, "completion": 0.06},  # $0.03 per 1K prompt tokens, $0.06 per 1K completion tokens
        "gpt-4-32k": {"prompt": 0.06, "completion": 0.12},
        "gpt-3.5-turbo": {"prompt": 0.001, "completion": 0.002},
        "gpt-3.5-turbo-16k": {"prompt": 0.003, "completion": 0.004}
    }
    
    model_rates = rates.get(model, rates["gpt-4"])  # Default to gpt-4 rates if model not found
    prompt_cost = (prompt_tokens / 1000) * model_rates["prompt"]
    completion_cost = (completion_tokens / 1000) * model_rates["completion"]
    
    return prompt_cost + completion_cost

async def process_with_gpt4o(
    content: str,
    qna_type: QnAType,
    context: Optional[Dict[str, Any]] = None,
    conversation_id: Optional[str] = None,
    max_context_messages: Optional[int] = 5,
    optimize_tokens: bool = False
) -> Dict[str, Any]:
    """Process Q&A content with GPT-4."""
    start_time = datetime.now()
    model = MODEL_NAME  # Use the global model name
    
    try:
        # Build message array
        messages = []
        if conversation_id and conversation_id in conversation_store:
            messages.extend(
                conversation_store[conversation_id].get_recent_messages(max_context_messages)
            )
        
        # Add current message
        prompt = get_prompt_template(qna_type, context)
        messages.append({
            "role": "user",
            "content": f"{prompt}\n\nContent to process:\n{content}"
        })
        
        # Count input tokens
        input_tokens = count_tokens("\n".join(msg["content"] for msg in messages))
        logger.info(f"Input tokens: {input_tokens}")
        
        # Make API call
        completion = client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=TEMPERATURE,
            max_tokens=MAX_TOKENS
        )
        
        # Process response
        response_message = completion.choices[0].message
        
        # Update conversation memory if needed
        if conversation_id:
            if conversation_id not in conversation_store:
                conversation_store[conversation_id] = ConversationMemory()
            conversation_store[conversation_id].add_message("user", messages[-1]["content"])
            conversation_store[conversation_id].add_message("assistant", response_message.content)
        
        # Calculate metrics
        end_time = datetime.now()
        processing_time = (end_time - start_time).total_seconds()
        total_tokens = completion.usage.total_tokens
        cost = calculate_cost(completion.usage.prompt_tokens, completion.usage.completion_tokens, model)
        
        # Update usage tracking
        usage_tracker.update(total_tokens, cost, processing_time)
        
        return {
            "content": response_message.content,
            "processing_time": processing_time,
            "total_tokens": total_tokens,
            "cost": cost
        }
        
    except Exception as e:
        logger.error(f"Error processing Q&A content: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error processing Q&A content: {str(e)}"
        )

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
    background_tasks: BackgroundTasks,
    authenticated: bool = Security(verify_api_key)
):
    """
    Enhanced Q&A processing with conversation memory and token optimization.
    """
    try:
        logger.info(f"Processing {request.type} Q&A content of length: {len(request.content)}")
        input_tokens = count_tokens(request.content)
        logger.info(f"Input tokens: {input_tokens}")

        result = await process_with_gpt4o(
            request.content,
            request.type,
            request.context,
            request.conversation_id,
            request.max_context_messages,
            request.optimize_tokens
        )
        
        logger.info(
            f"Processing completed. Type: {request.type}, Tokens: {result['total_tokens']}, "
            f"Cost: ${result['cost']:.4f}, Time: {result['processing_time']:.2f}s"
        )
        
        return result
        
    except Exception as e:
        logger.error(f"Error processing Q&A content: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error processing Q&A content: {str(e)}"
        )

@app.get("/health")
async def health_check():
    """Health check endpoint - no authentication required."""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat()
    }

@app.get("/usage_stats")
async def get_usage_stats(authenticated: bool = Security(verify_api_key)):
    """Get detailed API usage statistics."""
    return usage_tracker.get_stats()

@app.get("/alerts")
async def get_alerts(authenticated: bool = Security(verify_api_key)):
    """Get recent usage alerts."""
    return {"alerts": [alert.dict() for alert in usage_tracker.alerts]} 