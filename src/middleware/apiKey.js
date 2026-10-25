'use strict';

const crypto = require('crypto');
const env = require('../config/env');

function timingSafeStringEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/** Accepts the key as `X-API-Key: <key>` or `Authorization: Bearer <key>`. */
function requireApiKey(req, res, next) {
  if (!env.API_KEY) {
    return res.status(503).json({ error: 'API disabled: API_KEY is not set' });
  }
  const auth = req.get('authorization') || '';
  const provided = req.get('x-api-key') || (auth.startsWith('Bearer ') ? auth.slice(7) : '');
  if (!provided || !timingSafeStringEqual(provided, env.API_KEY)) {
    return res.status(401).json({ error: 'invalid or missing API key' });
  }
  next();
}

module.exports = { requireApiKey };
