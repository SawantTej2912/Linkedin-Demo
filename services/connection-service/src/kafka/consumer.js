// ─────────────────────────────────────────────────────────────────────────────
//  Kafka Consumer — Connection Service Worker
//
//  WHY THIS EXISTS (the producer-consumer pattern):
//  ┌─────────────────────┐   HTTP    ┌──────────────────────┐
//  │  Frontend (React)   │ ────────► │  Connection Service   │
//  └─────────────────────┘           │  (API / Producer)     │
//                                    │  writes DB, publishes │
//                                    │  ─► connection.accepted│
//                                    └──────────────────────┘
//                                              │ Kafka
//                                              ▼
//                                    ┌──────────────────────┐
//                                    │  Connection Worker    │
//                                    │  (this file / Consumer)│
//                                    │  keeps member         │
//                                    │  connections_count    │
//                                    │  in sync              │
//                                    └──────────────────────┘
//
//  Topics consumed:
//    connection.accepted  →  increment connections_count for BOTH members
//    connection.rejected  →  no DB action needed (count unchanged)
//
//  Idempotency: the UPDATE uses the exact count from the connections table
//  so running it twice gives the same result (safe with Kafka at-least-once).
// ─────────────────────────────────────────────────────────────────────────────

const { Kafka } = require('kafkajs');
const pool      = require('../models/db');

const kafka = new Kafka({
  clientId: 'connection-service-consumer',
  brokers:  [process.env.KAFKA_BROKER || 'localhost:9092'],
  retry:    { initialRetryTime: 3000, retries: 10 },
});

// Use a separate consumer group from any other service
const consumer = kafka.consumer({ groupId: 'connection-worker-group' });

async function startConsumer() {
  // ── Connect with retry ───────────────────────────────────────────────────
  // Kafka may not be ready when this service first starts inside Docker.
  // We retry up to 10 times (30 seconds total) before giving up.
  let retries = 10;
  while (retries > 0) {
    try {
      await consumer.connect();
      break;
    } catch (err) {
      retries--;
      console.warn(`[connection-consumer] Kafka not ready, retrying... (${retries} left)`);
      await new Promise(r => setTimeout(r, 3000));
    }
  }
  if (retries === 0) {
    console.error('[connection-consumer] Could not connect to Kafka — worker not started');
    return;
  }

  // ── Subscribe to topics ───────────────────────────────────────────────────
  await consumer.subscribe({ topic: 'connection.accepted', fromBeginning: false });
  await consumer.subscribe({ topic: 'connection.rejected', fromBeginning: false });

  // ── Process messages ──────────────────────────────────────────────────────
  await consumer.run({
    eachMessage: async ({ topic, message }) => {
      try {
        const event = JSON.parse(message.value.toString());

        if (topic === 'connection.accepted') {
          // When two members connect, we recalculate each one's connections_count
          // by counting their actual rows in the connections table.
          // This is idempotent — running it again gives the same correct count.
          const { requester_id, receiver_id } = event.payload;
          if (!requester_id || !receiver_id) return;

          // Recalculate real connection counts from the connections table
          // (more reliable than incrementing — avoids drift from retries)
          await pool.execute(
            `UPDATE members
             SET connections_count = (
               SELECT COUNT(*) FROM connections
               WHERE member_a = ? OR member_b = ?
             )
             WHERE member_id = ?`,
            [requester_id, requester_id, requester_id]
          );
          await pool.execute(
            `UPDATE members
             SET connections_count = (
               SELECT COUNT(*) FROM connections
               WHERE member_a = ? OR member_b = ?
             )
             WHERE member_id = ?`,
            [receiver_id, receiver_id, receiver_id]
          );

          console.log(
            `[connection-consumer] Updated connections_count for members ` +
            `${requester_id.slice(0,8)} and ${receiver_id.slice(0,8)}`
          );
        }

        // connection.rejected → nothing to update (count doesn't change)

      } catch (err) {
        // Log and continue — Kafka will redeliver if we crash
        console.error('[connection-consumer] Error processing message:', err.message);
      }
    },
  });

  console.log('[connection-consumer] Started — listening on: connection.accepted, connection.rejected');
}

module.exports = { startConsumer };
