"""
Benchmark scenarios:
  A — job search + job detail view (read-heavy)
  B — apply submit (DB write + Kafka event)

Usage:
  python benchmark_api.py --scenario A --concurrency 100 --requests 1000
  python benchmark_api.py --scenario B --concurrency 100 --requests 500
"""
import argparse
import time
import uuid
import statistics
import concurrent.futures
import requests

BASE_URL = 'http://localhost:3000/api'
HEADERS = {'Content-Type': 'application/json'}
_MEMBER_IDS = []
_JOB_IDS = []


def fetch_seeded_ids():
    global _MEMBER_IDS, _JOB_IDS
    if _MEMBER_IDS and _JOB_IDS:
        return _MEMBER_IDS, _JOB_IDS

    jobs_resp = requests.post(f'{BASE_URL}/jobs/search', json={'limit': 500}, headers=HEADERS, timeout=20)
    jobs_resp.raise_for_status()
    _JOB_IDS = [row['job_id'] for row in jobs_resp.json().get('results', []) if row.get('job_id')]

    members_resp = requests.post(f'{BASE_URL}/members/search', json={'limit': 500}, headers=HEADERS, timeout=20)
    members_resp.raise_for_status()
    _MEMBER_IDS = [row['member_id'] for row in members_resp.json().get('results', []) if row.get('member_id')]

    if not _JOB_IDS or not _MEMBER_IDS:
        raise RuntimeError('No seeded jobs or members were found. Run the seed script first.')
    return _MEMBER_IDS, _JOB_IDS


def scenario_a(index: int):
    """Job search + job detail view."""
    t0 = time.time()
    r1 = requests.post(
        f'{BASE_URL}/jobs/search',
        json={'keyword': 'engineer', 'limit': 10, 'page': (index % 5) + 1},
        headers=HEADERS,
        timeout=20,
    )
    jobs = r1.json().get('results', []) if r1.ok else []
    detail_status = 200
    if jobs:
        r2 = requests.post(
            f'{BASE_URL}/jobs/get',
            json={'job_id': jobs[0]['job_id']},
            headers=HEADERS,
            timeout=20,
        )
        detail_status = r2.status_code
    status = r1.status_code if r1.status_code >= 400 else detail_status
    return time.time() - t0, status


def scenario_b(index: int):
    """Apply submit — DB write + Kafka event using pre-seeded members/jobs."""
    members, jobs = fetch_seeded_ids()
    t0 = time.time()

    # Spread requests over many unique member/job pairs to avoid duplicate-app conflicts.
    member_id = members[index % len(members)]
    job_id = jobs[(index // max(len(members), 1)) % len(jobs)]

    r = requests.post(
        f'{BASE_URL}/applications/submit',
        json={
            'job_id': job_id,
            'member_id': member_id,
            'resume_text': 'Experienced software engineer with 5 years in Python, Kafka, Redis, and distributed systems.',
            'idempotency_key': str(uuid.uuid4()),
        },
        headers=HEADERS,
        timeout=20,
    )
    return time.time() - t0, r.status_code


def run_benchmark(scenario_fn, concurrency: int, total_requests: int, label: str):
    print(f"\n{'=' * 50}")
    print(f'Scenario: {label} | Concurrency: {concurrency} | Total: {total_requests}')
    latencies = []
    errors = 0
    start = time.time()
    with concurrent.futures.ThreadPoolExecutor(max_workers=concurrency) as pool:
        futures = [pool.submit(scenario_fn, i) for i in range(total_requests)]
        for future in concurrent.futures.as_completed(futures):
            latency, status = future.result()
            latencies.append(latency)
            if status >= 400:
                errors += 1
    elapsed = time.time() - start
    throughput = total_requests / max(elapsed, 0.001)
    p95 = sorted(latencies)[int(len(latencies) * 0.95)] * 1000 if latencies else 0
    p99 = sorted(latencies)[int(len(latencies) * 0.99)] * 1000 if latencies else 0
    avg = statistics.mean(latencies) * 1000 if latencies else 0

    print(f'  Total time:  {elapsed:.2f}s')
    print(f'  Throughput:  {throughput:.1f} req/s')
    print(f'  Avg latency: {avg:.1f}ms')
    print(f'  P95 latency: {p95:.1f}ms')
    print(f'  P99 latency: {p99:.1f}ms')
    print(f'  Errors:      {errors}')
    return {
        'label': label,
        'throughput': round(throughput, 1),
        'avg_ms': round(avg, 1),
        'p95_ms': round(p95, 1),
        'p99_ms': round(p99, 1),
        'errors': errors,
    }


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--scenario', choices=['A', 'B', 'both'], default='both')
    parser.add_argument('--concurrency', type=int, default=100)
    parser.add_argument('--requests', type=int, default=500)
    args = parser.parse_args()

    if args.scenario in ('B', 'both'):
        fetch_seeded_ids()

    results = []
    if args.scenario in ('A', 'both'):
        results.append(run_benchmark(scenario_a, args.concurrency, args.requests, 'Scenario A: Job Search + View'))
    if args.scenario in ('B', 'both'):
        results.append(run_benchmark(scenario_b, args.concurrency, args.requests, 'Scenario B: Apply Submit'))

    print('\n=== SUMMARY ===')
    for result in results:
        print(
            f"  {result['label']}: {result['throughput']} req/s | avg {result['avg_ms']}ms | "
            f"p95 {result['p95_ms']}ms | errors {result['errors']}"
        )
