const { Kafka } = require('kafkajs');
const EventLog = require('../models/eventLog');

const kafka = new Kafka({
  clientId: 'analytics-service',
  brokers: [process.env.KAFKA_BROKER || 'localhost:9092'],
  retry: { initialRetryTime: 3000, retries: 10 },
});

const consumer = kafka.consumer({
  groupId: process.env.KAFKA_GROUP_ID || 'analytics-consumer-group',
});

const ALL_TOPICS = [
  'profile.updated',
  'profile.viewed',
  'job.posted',
  'job.viewed',
  'job.saved',
  'job.closed',
  'application.submitted',
  'application.status.changed',
  'message.sent',
  'connection.requested',
  'connection.accepted',
  'connection.rejected',
  'ai.requests',
  'ai.results',
];

async function startConsumer() {
  let retries = 10;
  while (retries > 0) {
    try {
      await consumer.connect();
      break;
    } catch (err) {
      retries--;
      console.warn(`[analytics-consumer] Kafka not ready, retrying... (${retries} left)`);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }

  if (retries === 0) {
    console.error('[analytics-consumer] Could not connect to Kafka — analytics will not be logged');
    return;
  }

  for (const topic of ALL_TOPICS) {
    await consumer.subscribe({ topic, fromBeginning: false });
  }

  await consumer.run({
    eachMessage: async ({ topic, message }) => {
      try {
        const event = JSON.parse(message.value.toString());
        await EventLog.findOneAndUpdate(
          { idempotency_key: event.idempotency_key },
          { $setOnInsert: { ...event, timestamp: new Date(event.timestamp), _topic: topic } },
          { upsert: true, new: false }
        );
      } catch (err) {
        if (err.code !== 11000) {
          console.error(`[analytics-consumer] Error on topic ${topic}:`, err.message);
        }
      }
    },
  });

  console.log('[analytics-consumer] Started — subscribed to all topics:', ALL_TOPICS.join(', '));
}

module.exports = { startConsumer };
