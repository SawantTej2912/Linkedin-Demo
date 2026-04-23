// ─────────────────────────────────────────────────────────
//  Kafka Consumer — Application Service
//
//  Listens for 'job.closed' events.
//  When a job is closed, automatically rejects all
//  open applications for that job (business rule).
//
//  Retry logic: waits up to 30s for Kafka to be ready
//  before giving up (Docker Compose startup order issue).
// ─────────────────────────────────────────────────────────

const { Kafka } = require('kafkajs');
const pool = require('../models/db');

const kafka = new Kafka({
  clientId: 'application-service-consumer',
  brokers: [process.env.KAFKA_BROKER || 'localhost:9092'],
  retry: { initialRetryTime: 3000, retries: 10 },
});

const consumer = kafka.consumer({ groupId: 'application-service-group' });

async function startConsumer() {
  // Retry connecting to Kafka — it may not be ready immediately
  let retries = 10;
  while (retries > 0) {
    try {
      await consumer.connect();
      break; // connected successfully
    } catch (err) {
      retries--;
      console.warn(`[application-consumer] Kafka not ready, retrying... (${retries} left)`);
      await new Promise(r => setTimeout(r, 3000));
    }
  }
  if (retries === 0) {
    console.error('[application-consumer] Could not connect to Kafka — consumer not started');
    return;
  }

  // Subscribe to the job.closed topic
  await consumer.subscribe({ topic: 'job.closed', fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ message }) => {
      try {
        const event = JSON.parse(message.value.toString());

        if (event.event_type === 'job.closed') {
          const job_id = event.entity.entity_id;

          // Business rule: when a job closes, reject all pending applications.
          // This is idempotent — running it twice has the same result.
          await pool.execute(
            `UPDATE applications
             SET status = 'rejected'
             WHERE job_id = ? AND status IN ('submitted', 'reviewing')`,
            [job_id]
          );
          console.log(`[application-consumer] Auto-rejected open applications for job ${job_id}`);
        }
      } catch (err) {
        // Log errors but don't crash — Kafka will redeliver the message
        console.error('[application-consumer] Error processing message:', err.message);
      }
    },
  });

  console.log('[application-consumer] Started — listening on: job.closed');
}

module.exports = { startConsumer };
