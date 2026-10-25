'use strict';

const express = require('express');
const router = express.Router();
const stackStatus = require('../services/stackStatus');
const { requireApiKey } = require('../middleware/apiKey');

// Unauthenticated liveness probe for the Docker HEALTHCHECK — reveals nothing.
router.get('/healthz', (req, res) => {
  res.json({ ok: true });
});

// Counts only, shaped for gethomepage's customapi widget. If the crontab or
// the stacks dir can't be read the numbers would be misleading (everything
// "pending"), so answer 503 instead and let the widget show an error.
router.get('/api/status', requireApiKey, async (req, res, next) => {
  try {
    const { counts, orphanedEntries, errors } = await stackStatus.getStatus();
    if (errors.length > 0) {
      return res.status(503).json({ error: errors.join(' ') });
    }
    res.json({ ...counts, orphaned: orphanedEntries.length });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
