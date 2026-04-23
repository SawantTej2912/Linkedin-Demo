require('dotenv').config();
const express = require('express');
const connectionRoutes       = require('./routes/connectionRoutes');
const { startConsumer }      = require('./kafka/consumer');

const app  = express();
const PORT = process.env.PORT || 3005;

app.use(express.json());
app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'connection-service' }));
app.use('/connections', connectionRoutes);

app.listen(PORT, () => {
  console.log(`Connection Service on port ${PORT}`);
  // Start the Kafka consumer worker (non-blocking — won't crash the HTTP server if Kafka is slow)
  startConsumer().catch(err => console.error('[connection-service] Consumer startup error:', err.message));
});
