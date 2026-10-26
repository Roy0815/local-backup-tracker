'use strict';

const path = require('path');

function parseIntEnv(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : fallback;
}

/** Strips trailing slashes so path comparisons don't depend on how the env var was typed. */
function normalizeDir(dir) {
  if (!dir) return '';
  const trimmed = dir.replace(/\/+$/, '');
  return trimmed === '' ? '/' : trimmed;
}

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');

module.exports = {
  PORT: parseIntEnv('PORT', 3000),
  DATA_DIR,
  ADMIN_FILE: path.join(DATA_DIR, 'admin.yml'),
  EXCLUDED_FILE: path.join(DATA_DIR, 'excluded.yml'),
  CONFIG_FILE: path.join(DATA_DIR, 'config.yml'),

  // Where the stacks directory is mounted *inside* the container (read-only).
  STACKS_DIR: normalizeDir(process.env.STACKS_DIR || '/stacks'),
  // The same directory as the *host* sees it — that's the path the crontab
  // lines contain. Optional: without it, cron entries are matched to stacks
  // by their last path segment only.
  HOST_STACKS_DIR: normalizeDir(process.env.HOST_STACKS_DIR || ''),
  // The one crontab file with the backup lines. Its *directory* is mounted
  // (see docker-compose.yml), but only this file is read.
  CRONTAB_PATH: process.env.CRONTAB_PATH || '/config/cron.d/docker-stack-backup',
  BACKUP_SCRIPT_NAME: process.env.BACKUP_SCRIPT_NAME || 'docker-stack-backup.sh',

  // Required for /api/status. Unset → the API answers 503 instead of being
  // reachable without authentication.
  API_KEY: process.env.API_KEY || '',

  SESSION_SECRET: process.env.SESSION_SECRET || null,
  MAX_LOGIN_ATTEMPTS: 3,

  NODE_ENV: process.env.NODE_ENV || 'production',
};
