// Kafka Producer — Connection Service (with startup retry)
const { Kafka } = require('kafkajs');
const { v4: uuidv4 } = require('uuid');

const kafka = new Kafka({
  clientId: 'connection-service',
  brokers: [process.env.KAFKA_BROKER || 'localhost:9092'],
  retry: { initialRetryTime: 3000, retries: 10 },
});

const producer = kafka.producer();
let connected = false;

async function connect() {
  if (connected) return;
  let retries = 10;
  while (retries > 0) {
    try {
      await producer.connect();
      connected = true;
      console.log('Kafka producer connected (connection-service)');
      return;
    } catch (err) {
      retries--;
      console.warn(`Kafka not ready, retrying... (${retries} attempts left)`);
      await new Promise(r => setTimeout(r, 3000));
    }
  }
  console.error('Could not connect to Kafka — events will not be published');
}

connect().catch(() => {});

async function publishEvent({ topic, eventType, actorId, entityType, entityId, payload }) {
  if (!connected) { console.warn(`Kafka not connected — skipping: ${eventType}`); return; }
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
    await producer.send({ topic, messages: [{ key: entityId, value: JSON.stringify(message) }] });
  } catch (err) {
    console.error(`Failed to publish event [${topic}/${eventType}]:`, err.message);
  }
}

module.exports = { publishEvent };
