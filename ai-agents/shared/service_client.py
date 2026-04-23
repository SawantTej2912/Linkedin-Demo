import httpx
from config import PROFILE_SERVICE_URL, JOB_SERVICE_URL, APPLICATION_SERVICE_URL

async def get_member(member_id: str) -> dict:
    async with httpx.AsyncClient() as client:
        r = await client.post(f"{PROFILE_SERVICE_URL}/members/get", json={"member_id": member_id})
        r.raise_for_status()
        return r.json()

async def get_job(job_id: str) -> dict:
    async with httpx.AsyncClient() as client:
        r = await client.post(f"{JOB_SERVICE_URL}/jobs/get", json={"job_id": job_id})
        r.raise_for_status()
        return r.json()

async def get_applications_by_job(job_id: str, limit: int = 50) -> list[dict]:
    async with httpx.AsyncClient() as client:
        r = await client.post(f"{APPLICATION_SERVICE_URL}/applications/byJob", json={"job_id": job_id, "limit": limit})
        r.raise_for_status()
        return r.json().get("results", [])
