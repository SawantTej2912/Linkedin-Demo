require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const { createProxyMiddleware } = require('http-proxy-middleware');
const { verifyToken } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(morgan('combined'));

// Health check (no auth)
app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'api-gateway' }));

// Public routes (no JWT required)
const PUBLIC_PATHS = [
  '/api/members/create',
  '/api/members/login',
  '/api/members/get',
  '/api/members/update',
  '/api/members/delete',
  '/api/members/skills',
  '/api/members/search',
  '/api/recruiters/create',
  '/api/recruiters/login',
  '/api/recruiters/get',
  '/api/recruiters/update',
  '/api/recruiters/delete',
  '/api/auth/login',
  '/api/jobs/search',
  '/api/jobs/get',
  '/api/jobs/byRecruiter',
  '/api/jobs/save',
  '/api/jobs/unsave',
  '/api/jobs/saved',
  '/api/applications/byMember',
  '/api/applications/byJob',
  '/api/applications/submit',
  '/api/analytics',
  '/api/events',
  '/api/threads',
  '/api/messages',
  '/api/connections',
  '/api/agents',
  '/api/skills',
];

// Auth middleware — skip public paths
app.use((req, res, next) => {
  if (PUBLIC_PATHS.some(p => req.path.startsWith(p))) return next();
  verifyToken(req, res, next);
});

// Service proxy routes
const services = {
  '/api/members':      process.env.PROFILE_SERVICE_URL     || 'http://profile-service:3001',
  '/api/recruiters':   process.env.PROFILE_SERVICE_URL     || 'http://profile-service:3001',
  '/api/jobs':         process.env.JOB_SERVICE_URL         || 'http://job-service:3002',
  '/api/applications': process.env.APPLICATION_SERVICE_URL || 'http://application-service:3003',
  '/api/threads':      process.env.MESSAGING_SERVICE_URL   || 'http://messaging-service:3004',
  '/api/messages':     process.env.MESSAGING_SERVICE_URL   || 'http://messaging-service:3004',
  '/api/connections':  process.env.CONNECTION_SERVICE_URL  || 'http://connection-service:3005',
  '/api/analytics':    process.env.ANALYTICS_SERVICE_URL   || 'http://analytics-service:3006',
  '/api/events':       process.env.ANALYTICS_SERVICE_URL   || 'http://analytics-service:3006',
  '/api/agents':       process.env.AI_AGENT_URL            || 'http://ai-agent-service:8000',
  '/api/skills':       process.env.AI_AGENT_URL            || 'http://ai-agent-service:8000',
};

Object.entries(services).forEach(([path, target]) => {
  app.use(path, createProxyMiddleware({
    target,
    changeOrigin: true,
    pathRewrite: { [`^${path}`]: path.replace('/api', '') },
    on: {
      error: (err, _req, res) => {
        console.error(`Proxy error for ${path}:`, err.message);
        res.status(502).json({ error: 'Service unavailable', service: path });
      },
    },
  }));
});

app.listen(PORT, () => console.log(`API Gateway running on port ${PORT}`));
