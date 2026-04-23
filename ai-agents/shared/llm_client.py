from typing import Optional
from config import OPENAI_API_KEY, LLM_MODEL

try:
    from openai import AsyncOpenAI  # type: ignore
except Exception:  # pragma: no cover - runtime fallback for environments without the package
    AsyncOpenAI = None  # type: ignore

_client: Optional[object] = None


def has_llm() -> bool:
    return bool(AsyncOpenAI is not None and OPENAI_API_KEY and OPENAI_API_KEY.strip() and OPENAI_API_KEY != 'your_openai_api_key_here')


def get_client():
    global _client
    if not has_llm():
        raise RuntimeError('OPENAI_API_KEY is not configured or openai package is unavailable')
    if _client is None:
        _client = AsyncOpenAI(api_key=OPENAI_API_KEY)
    return _client


async def chat_complete(messages: list[dict], model: str = None, temperature: float = 0.2) -> str:
    response = await get_client().chat.completions.create(
        model=model or LLM_MODEL,
        messages=messages,
        temperature=temperature,
    )
    return response.choices[0].message.content or ''
