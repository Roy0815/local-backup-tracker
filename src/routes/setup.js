'use strict';

const express = require('express');
const router = express.Router();
const adminStore = require('../services/adminStore');
const { verifyCsrf } = require('../middleware/csrf');

const MIN_PASSWORD_LENGTH = 12;

router.get('/setup', async (req, res) => {
  if (await adminStore.isSetupComplete()) return res.redirect('/login');
  res.render('setup', { error: null, minLength: MIN_PASSWORD_LENGTH });
});

router.post('/setup', verifyCsrf, async (req, res) => {
  if (await adminStore.isSetupComplete()) return res.redirect('/login');

  const username = (req.body.username || '').trim();
  const { password, confirmPassword } = req.body;
  const fail = (error) => res.render('setup', { error, minLength: MIN_PASSWORD_LENGTH });

  if (!username || !password) {
    return fail('Benutzername und Passwort sind erforderlich.');
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return fail(`Das Passwort muss mindestens ${MIN_PASSWORD_LENGTH} Zeichen lang sein.`);
  }
  if (password !== confirmPassword) {
    return fail('Die Passwörter stimmen nicht überein.');
  }

  await adminStore.createAdmin(username, password);
  res.redirect('/login');
});

module.exports = router;
