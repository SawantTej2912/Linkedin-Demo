require('dotenv').config();
require('./models/mongoose');
const express = require('express');
const threadRoutes  = require('./routes/threadRoutes');
const messageRoutes = require('./routes/messageRoutes');

const app = express();
const PORT = process.env.PORT || 3004;

app.use(express.json());
app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'messaging-service' }));
app.use('/threads',  threadRoutes);
app.use('/messages', messageRoutes);

app.listen(PORT, () => console.log(`Messaging Service on port ${PORT}`));
