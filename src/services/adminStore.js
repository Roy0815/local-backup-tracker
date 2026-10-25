'use strict';

const argon2 = require('argon2');
const yamlStore = require('./yamlStore');
const env = require('../config/env');

const MAX_ATTEMPTS = env.MAX_LOGIN_ATTEMPTS;

async function hashPassword(password) {
  return argon2.hash(password, { type: argon2.argon2id });
}

async function verifyPassword(hash, password) {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

async function isSetupComplete() {
  return yamlStore.exists(env.ADMIN_FILE);
}

async function getAdmin() {
  return yamlStore.readYaml(env.ADMIN_FILE, null);
}

/** Called once, during the setup wizard. Fails if an admin already exists. */
async function createAdmin(username, password) {
  if (await getAdmin()) {
    throw new Error('Admin account already exists');
  }
  const admin = {
    username,
    passwordHash: await hashPassword(password),
    failedAttempts: 0,
    locked: false,
    createdAt: new Date().toISOString(),
  };
  await yamlStore.writeYaml(env.ADMIN_FILE, admin);
  return admin;
}

/**
 * Verifies username+password against the stored admin, enforcing the
 * permanent lockout after MAX_ATTEMPTS failures. Returns one of:
 *   { ok: true }
 *   { ok: false, reason: 'locked' | 'invalid' }
 */
async function verifyLogin(username, password) {
  if (!(await isSetupComplete())) return { ok: false, reason: 'invalid' };

  let verdict = { ok: false, reason: 'invalid' };
  await yamlStore.updateYaml(env.ADMIN_FILE, null, async (admin) => {
    if (admin.locked) {
      verdict = { ok: false, reason: 'locked' };
      return admin;
    }
    const valid = admin.username === username && (await verifyPassword(admin.passwordHash, password));
    if (valid) {
      admin.failedAttempts = 0;
      verdict = { ok: true };
      return admin;
    }
    admin.failedAttempts = (admin.failedAttempts || 0) + 1;
    if (admin.failedAttempts >= MAX_ATTEMPTS) {
      admin.locked = true;
      verdict = { ok: false, reason: 'locked' };
    }
    return admin;
  });
  return verdict;
}

/** node cli.js unlock-admin */
async function unlockAdmin() {
  return yamlStore.updateYaml(env.ADMIN_FILE, null, (admin) => {
    if (!admin) throw new Error('No admin account found');
    admin.locked = false;
    admin.failedAttempts = 0;
    return admin;
  });
}

module.exports = { isSetupComplete, getAdmin, createAdmin, verifyLogin, unlockAdmin };
