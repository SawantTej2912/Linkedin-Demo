require('dotenv').config();
const express = require('express');
const jobRoutes = require('./routes/jobRoutes');

const app = express();
const PORT = process.env.PORT || 3002;

app.use(express.json());
app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'job-service' }));
app.use('/jobs', jobRoutes);

app.listen(PORT, () => console.log(`Job Service on port ${PORT}`));
