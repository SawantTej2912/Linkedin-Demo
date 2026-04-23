#!/bin/bash
# Wait for Kafka to be ready, then create all required topics

KAFKA_BROKER="${KAFKA_BROKER:-localhost:29092}"
PARTITIONS=3
REPLICATION=1

TOPICS=(
  "profile.updated"
  "profile.viewed"
  "job.posted"
  "job.viewed"
  "job.saved"
  "job.closed"
  "application.submitted"
  "application.status.changed"
  "message.sent"
  "connection.requested"
  "connection.accepted"
  "connection.rejected"
  "ai.requests"
  "ai.results"
)

echo "Waiting for Kafka at $KAFKA_BROKER ..."
sleep 10

for TOPIC in "${TOPICS[@]}"; do
  echo "Creating topic: $TOPIC"
  docker exec kafka kafka-topics --create \
    --bootstrap-server "$KAFKA_BROKER" \
    --topic "$TOPIC" \
    --partitions "$PARTITIONS" \
    --replication-factor "$REPLICATION" \
    --if-not-exists
done

echo "All topics created."
docker exec kafka kafka-topics --list --bootstrap-server "$KAFKA_BROKER"
