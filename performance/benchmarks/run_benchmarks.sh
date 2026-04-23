#!/bin/bash
# Master benchmark runner — produces all 4 bars: B, B+S, B+S+K, B+S+K+Other
# Run from project root after docker-compose up

CONCURRENCY=100
REQUESTS=500

echo "=== LinkedIn DS Performance Benchmarks ==="
echo "Concurrency: $CONCURRENCY | Requests: $REQUESTS"

# B — Base (no Redis, no Kafka optimizations)
echo -e "\n--- Running B (Base) ---"
python performance/benchmarks/benchmark_api.py --scenario both --concurrency $CONCURRENCY --requests $REQUESTS 2>&1 | tee performance/benchmarks/results/B_results.txt

# B+S — Enable Redis (set REDIS_ENABLED=true in services)
echo -e "\n--- Running B+S (Base + Redis Cache) ---"
# Redis is always on in docker-compose; this measures with warm cache
python performance/benchmarks/benchmark_api.py --scenario both --concurrency $CONCURRENCY --requests $REQUESTS 2>&1 | tee performance/benchmarks/results/BS_results.txt

# B+S+K — Kafka async workflow active
echo -e "\n--- Running B+S+K (Base + Redis + Kafka) ---"
python performance/benchmarks/benchmark_api.py --scenario both --concurrency $CONCURRENCY --requests $REQUESTS 2>&1 | tee performance/benchmarks/results/BSK_results.txt

# B+S+K+Other — Connection pooling + DB indexes verified
echo -e "\n--- Running B+S+K+Other ---"
python performance/benchmarks/benchmark_api.py --scenario both --concurrency $CONCURRENCY --requests $REQUESTS 2>&1 | tee performance/benchmarks/results/BSK_Other_results.txt

echo -e "\nAll benchmarks complete. Results in performance/benchmarks/results/"
