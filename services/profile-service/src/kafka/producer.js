// ─────────────────────────────────────────────────────────
//  Kafka Producer — Profile Service
//
//  Why retry logic?
//  When Docker Compose starts all containers at once, Kafka
//  might not be fully ready when this service starts.
//  Instead of crashing, we wait and retry up to 10 times.
// ─────────────────────────────────────────────────────────

const { Kafka } = require('kafkajs');
const { v4: uuidv4 } = require('uuid');

const kafka = new Kafka({
  clientId: 'profile-service',
  brokers: [process.env.KAFKA_BROKER || 'localhost:9092'],
  retry: { initialRetryTime: 3000, retries: 10 },
});

const producer = kafka.producer();
let connected = false;

// Connect with retry — if Kafka isn't ready, wait 3s and try again
async function connect() {
  if (connected) return;
  let retries = 10;
  while (retries > 0) {
    try {
      await producer.connect();
      connected = true;
      console.log('Kafka producer connected (profile-service)');
      return;
    } catch (err) {
      retries--;
      console.warn(`Kafka not ready, retrying... (${retries} attempts left)`);
      await new Promise(r => setTimeout(r, 3000));
    }
  }
  console.error('Could not connect to Kafka — events will not be published');
}

// Start connecting when this module loads (non-blocking)
connect().catch(() => {});

// Publish a structured event to a Kafka topic.
// If Kafka is down, logs a warning but does NOT crash the service.
async function publishEvent({ topic, eventType, actorId, entityType, entityId, payload }) {
  if (!connected) {
    console.warn(`Kafka not connected — skipping event: ${eventType}`);
    return;
  }
  // Shared envelope format (matches the API design document)
  const message = {
    event_type:      eventType,
    trace_id:        uuidv4(),
    timestamp:       new Date().toISOString(),
    actor_id:        actorId,
    entity:          { entity_type: entityType, entity_id: entityId },
    payload,
    idempotency_key: uuidv4(),
  };
  try {
    await producer.send({
      topic,
      messages: [{ key: entityId, value: JSON.stringify(message) }],
    });
  } catch (err) {
    console.error(`Failed to publish event [${topic}/${eventType}]:`, err.message);
  }
}

module.exports = { publishEvent };
