require('dotenv').config();
require('./models/eventLog'); // init mongoose
const express = require('express');
const analyticsRoutes = require('./routes/analyticsRoutes');
const { startConsumer } = require('./kafka/consumer');

const app = express();
const PORT = process.env.PORT || 3006;

app.use(express.json());
app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'analytics-service' }));
app.use('/events',    analyticsRoutes);
app.use('/analytics', analyticsRoutes);

app.listen(PORT, () => {
  console.log(`Analytics Service on port ${PORT}`);
  startConsumer().catch(console.error);
});
