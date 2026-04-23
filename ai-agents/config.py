import os
from dotenv import load_dotenv

load_dotenv()

KAFKA_BROKER = os.getenv('KAFKA_BROKER', 'localhost:9092')
REDIS_HOST = os.getenv('REDIS_HOST', 'localhost')
REDIS_PORT = int(os.getenv('REDIS_PORT', 6379))

PROFILE_SERVICE_URL = os.getenv('PROFILE_SERVICE_URL', 'http://profile-service:3001')
JOB_SERVICE_URL = os.getenv('JOB_SERVICE_URL', 'http://job-service:3002')
APPLICATION_SERVICE_URL = os.getenv('APPLICATION_SERVICE_URL', 'http://application-service:3003')

OPENAI_API_KEY = os.getenv('OPENAI_API_KEY', '')
ANTHROPIC_API_KEY = os.getenv('ANTHROPIC_API_KEY', '')
LLM_MODEL = os.getenv('LLM_MODEL', 'gpt-4o-mini')
AI_INLINE_FALLBACK = os.getenv('AI_INLINE_FALLBACK', 'true').lower() == 'true'

MONGO_DATABASE = os.getenv('MONGO_DATABASE', 'linkedin_ds_logs')
MONGO_URI = (
    f"mongodb://{os.getenv('MONGO_USER', 'appuser')}:{os.getenv('MONGO_PASSWORD', 'apppassword')}"
    f"@{os.getenv('MONGO_HOST', 'localhost')}:{os.getenv('MONGO_PORT', 27017)}"
    f"/{MONGO_DATABASE}?authSource=admin"
)
