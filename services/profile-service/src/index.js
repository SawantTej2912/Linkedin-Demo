require('dotenv').config();
const express = require('express');
const profileRoutes = require('./routes/profileRoutes');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());
app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'profile-service' }));
app.use('/members', profileRoutes);
app.use('/recruiters', require('./routes/recruiterRoutes'));

app.listen(PORT, () => console.log(`Profile Service on port ${PORT}`));
