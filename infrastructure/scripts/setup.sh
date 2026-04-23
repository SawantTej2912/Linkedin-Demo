#!/bin/bash
set -e
echo "=== LinkedIn DS — First-time setup ==="

# Copy env file
[ ! -f .env ] && cp .env.example .env && echo "Created .env from .env.example (update your API keys)"

# Build all containers
docker-compose build

# Start infrastructure first
docker-compose up -d zookeeper kafka mysql mongodb redis
echo "Waiting 30s for infrastructure to be ready..."
sleep 30

# Create Kafka topics
bash kafka/scripts/create-topics.sh

# Start all services
docker-compose up -d

echo "All services started. Visit http://localhost to open the client."
echo "Kafka UI: http://localhost:8080"
