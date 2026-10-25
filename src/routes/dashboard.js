'use strict';

const express = require('express');
const router = express.Router();
const stackStatus = require('../services/stackStatus');
const excludedStore = require('../services/excludedStore');
const env = require('../config/env');
const { requireSetupComplete, requireLogin } = require('../middleware/auth');
const { verifyCsrf } = require('../middleware/csrf');

router.get('/', requireSetupComplete, requireLogin, async (req, res) => {
  const status = await stackStatus.getStatus();
  res.render('dashboard', {
    ...status,
    stacksDir: env.STACKS_DIR,
    crontabPath: env.CRONTAB_PATH,
  });
});

router.post('/stacks/:name/exclude', requireLogin, verifyCsrf, async (req, res) => {
  const { name } = req.params;
  if (!(await stackStatus.canExclude(name))) {
    req.flash('error', `„${name}“ kann nicht ausgeschlossen werden (unbekannt oder wird bereits gesichert).`);
    return res.redirect('/');
  }
  await excludedStore.addExcluded(name);
  req.flash('success', `„${name}“ als „kein Backup nötig“ markiert.`);
  res.redirect('/');
});

router.post('/stacks/:name/include', requireLogin, verifyCsrf, async (req, res) => {
  const { name } = req.params;
  await excludedStore.removeExcluded(name);
  req.flash('success', `Ausnahme für „${name}“ zurückgenommen.`);
  res.redirect('/');
});

module.exports = router;
