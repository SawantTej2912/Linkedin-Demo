from contextlib import asynccontextmanager
from threading import Thread
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from skills.resume_parser.router import router as resume_parser_router
from skills.job_candidate_matcher.router import router as matcher_router
from agents.hiring_assistant.router import router as hiring_router
from agents.career_coach.router import router as career_router
from app_kafka.consumer import start_ai_consumer

_consumer_thread = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _consumer_thread
    if _consumer_thread is None or not _consumer_thread.is_alive():
        _consumer_thread = Thread(target=start_ai_consumer, daemon=True)
        _consumer_thread.start()
    yield


app = FastAPI(
    title='LinkedIn DS — AI Agent Service',
    description='Agentic AI layer: Resume Parser, Job-Candidate Matcher, Hiring Assistant, Career Coach',
    version='1.0.0',
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_methods=['*'],
    allow_headers=['*'],
)

app.include_router(resume_parser_router)
app.include_router(matcher_router)
app.include_router(hiring_router)
app.include_router(career_router)


@app.get('/health')
def health():
    return {'status': 'ok', 'service': 'ai-agent-service'}
