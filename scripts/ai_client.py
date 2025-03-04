import os
import asyncio
import aiohttp
from datetime import datetime
import logging
from typing import Optional
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('ai_client.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class AIPipelineClient:
    def __init__(
        self,
        api_url: str = os.getenv("API_URL", "http://localhost:8000"),
        api_key: str = os.getenv("API_KEY", "your-secure-api-key")
    ):
        self.api_url = api_url.rstrip('/')
        self.api_key = api_key
        self.qna_file = "Cursor AI Q&A Log.txt"
        self.backup_dir = "qna_backups"
        self.headers = {
            "X-API-Key": self.api_key
        }
        
        # Create backup directory if it doesn't exist
        os.makedirs(self.backup_dir, exist_ok=True)
    
    async def check_health(self) -> bool:
        """Check API health status"""
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    f"{self.api_url}/health"
                ) as response:
                    if response.status == 200:
                        data = await response.json()
                        logger.info(f"API health check passed: {data}")
                        return True
                    else:
                        logger.error(f"API health check failed: {await response.text()}")
                        return False
        except Exception as e:
            logger.error(f"Error checking API health: {str(e)}")
            return False
    
    async def backup_current_log(self):
        """Create a backup of the current Q&A log"""
        if os.path.exists(self.qna_file):
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            backup_path = os.path.join(
                self.backup_dir,
                f"qna_backup_{timestamp}.txt"
            )
            try:
                with open(self.qna_file, 'r') as src, open(backup_path, 'w') as dst:
                    dst.write(src.read())
                logger.info(f"Created backup: {backup_path}")
            except Exception as e:
                logger.error(f"Failed to create backup: {str(e)}")
                raise
    
    async def upload_qna_log(self) -> bool:
        """Upload the current Q&A log to the API"""
        if not os.path.exists(self.qna_file):
            logger.error("Q&A log file not found")
            return False
            
        try:
            async with aiohttp.ClientSession() as session:
                with open(self.qna_file, 'rb') as f:
                    data = aiohttp.FormData()
                    data.add_field('file',
                                 f,
                                 filename=self.qna_file)
                    
                    start_time = datetime.now()
                    async with session.post(
                        f"{self.api_url}/upload_qna",
                        data=data,
                        headers=self.headers,
                        timeout=60  # 60 second timeout
                    ) as response:
                        processing_time = (datetime.now() - start_time).total_seconds()
                        
                        if response.status == 200:
                            result = await response.json()
                            logger.info(
                                f"Successfully uploaded Q&A log "
                                f"(API processing time: {result.get('processing_time', 0):.2f}s, "
                                f"Total time: {processing_time:.2f}s)"
                            )
                            return True
                        else:
                            error_text = await response.text()
                            logger.error(
                                f"Failed to upload Q&A log: {error_text} "
                                f"(took {processing_time:.2f}s)"
                            )
                            return False
        except asyncio.TimeoutError:
            logger.error("Upload timeout after 60 seconds")
            return False
        except Exception as e:
            logger.error(f"Error uploading Q&A log: {str(e)}")
            return False
    
    async def get_latest_qna(self) -> Optional[str]:
        """Retrieve the latest Q&A log from the API"""
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    f"{self.api_url}/get_qna",
                    headers=self.headers,
                    timeout=30
                ) as response:
                    if response.status == 200:
                        data = await response.json()
                        logger.info(
                            f"Retrieved Q&A log from {data.get('timestamp', 'unknown')}"
                        )
                        return data.get("qna_log")
                    else:
                        logger.error(
                            f"Failed to get Q&A log: {await response.text()}"
                        )
                        return None
        except asyncio.TimeoutError:
            logger.error("Get Q&A timeout after 30 seconds")
            return None
        except Exception as e:
            logger.error(f"Error getting Q&A log: {str(e)}")
            return None
    
    async def sync_qna_log(self):
        """
        Full sync process:
        1. Check API health
        2. Backup current log
        3. Upload to API
        4. Get processed version
        5. Update local file
        """
        try:
            # Check API health first
            if not await self.check_health():
                logger.error("API health check failed, aborting sync")
                return False
            
            # Backup current log
            await self.backup_current_log()
            
            # Upload current log
            if not await self.upload_qna_log():
                return False
            
            # Get processed version
            updated_content = await self.get_latest_qna()
            if not updated_content:
                return False
            
            # Update local file
            with open(self.qna_file, 'w') as f:
                f.write(updated_content)
            
            logger.info("Successfully synced Q&A log")
            return True
            
        except Exception as e:
            logger.error(f"Error during sync: {str(e)}")
            return False

async def main():
    """Main entry point for the client"""
    client = AIPipelineClient()
    await client.sync_qna_log()

if __name__ == "__main__":
    asyncio.run(main()) 