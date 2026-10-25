'use strict';

const adminStore = require('../services/adminStore');

async function requireSetupComplete(req, res, next) {
  if (!(await adminStore.isSetupComplete())) {
    return res.redirect('/setup');
  }
  next();
}

function requireLogin(req, res, next) {
  if (!req.session || !req.session.isAuthenticated) {
    return res.redirect('/login');
  }
  next();
}

module.exports = { requireSetupComplete, requireLogin };
