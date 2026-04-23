const { createClient } = require('redis');

const client = createClient({
  socket: { host: process.env.REDIS_HOST || 'localhost', port: process.env.REDIS_PORT || 6379 },
});

client.on('error', err => console.error('Redis error:', err));
client.connect().catch(console.error);

const CACHE_TTL = 300; // seconds

async function getCache(key) {
  try {
    const val = await client.get(key);
    return val ? JSON.parse(val) : null;
  } catch { return null; }
}

async function setCache(key, value, ttl = CACHE_TTL) {
  try { await client.setEx(key, ttl, JSON.stringify(value)); } catch {}
}

async function delCache(key) {
  try { await client.del(key); } catch {}
}

module.exports = { getCache, setCache, delCache };
