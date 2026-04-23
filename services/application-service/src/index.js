require('dotenv').config();
const express = require('express');
const appRoutes = require('./routes/applicationRoutes');
const { startConsumer } = require('./kafka/consumer');

const app = express();
const PORT = process.env.PORT || 3003;

app.use(express.json());
app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'application-service' }));
app.use('/applications', appRoutes);

app.listen(PORT, () => {
  console.log(`Application Service on port ${PORT}`);
  startConsumer().catch(console.error);
});
