'use strict';

const path = require('path');
const env = require('../config/env');
const cronParser = require('./cronParser');
const stackScanner = require('./stackScanner');
const excludedStore = require('./excludedStore');

const STATUS_ORDER = { pending: 0, backed_up: 1, excluded: 2 };

/**
 * Maps a host path from the crontab to a stack name, or null if it points
 * somewhere outside the stacks directory. Without HOST_STACKS_DIR only the
 * last path segment is compared.
 */
function stackNameForPath(stackPath) {
  if (env.HOST_STACKS_DIR) {
    return path.posix.dirname(stackPath) === env.HOST_STACKS_DIR ? path.posix.basename(stackPath) : null;
  }
  return path.posix.basename(stackPath);
}

/**
 * The single source of truth for what the dashboard and the API show.
 * Everything is derived on every call (stacks dir + crontab are re-read),
 * nothing about backup coverage is stored — only the admin's exclusions.
 *
 * Side effect: a stack that is excluded but now appears in the crontab gets
 * its exclusion removed, so the decision doesn't silently linger if the
 * stack is later dropped from the crontab again.
 */
async function getStatus() {
  const errors = [];

  let stackNames = [];
  try {
    stackNames = await stackScanner.listStacks(env.STACKS_DIR);
  } catch (err) {
    errors.push(`Stacks-Verzeichnis ${env.STACKS_DIR} ist nicht lesbar (${err.code || err.message}).`);
  }

  let entries = [];
  let crontabOk = true;
  try {
    entries = await cronParser.readBackupEntries(env.CRONTAB_PATH, env.BACKUP_SCRIPT_NAME);
  } catch (err) {
    crontabOk = false;
    errors.push(`Crontab ${env.CRONTAB_PATH} ist nicht lesbar (${err.code || err.message}).`);
  }

  const known = new Set(stackNames);
  const schedulesByStack = new Map();
  const orphanedEntries = [];
  for (const entry of entries) {
    const name = stackNameForPath(entry.stackPath);
    if (!name || !known.has(name)) {
      orphanedEntries.push(entry);
      continue;
    }
    if (!schedulesByStack.has(name)) schedulesByStack.set(name, new Set());
    schedulesByStack.get(name).add(entry.schedule);
  }

  let excluded = await excludedStore.listExcluded();
  const autoReset = crontabOk ? excluded.filter((e) => schedulesByStack.has(e.name)).map((e) => e.name) : [];
  if (autoReset.length > 0) {
    excluded = await excludedStore.removeExcluded(autoReset);
  }
  const excludedByName = new Map(excluded.map((e) => [e.name, e]));

  const stacks = stackNames
    .map((name) => {
      if (schedulesByStack.has(name)) {
        return { name, status: 'backed_up', schedules: [...schedulesByStack.get(name)] };
      }
      if (excludedByName.has(name)) {
        return { name, status: 'excluded', excludedAt: excludedByName.get(name).excludedAt };
      }
      return { name, status: 'pending' };
    })
    .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.name.localeCompare(b.name));

  const counts = { total: stacks.length, backed_up: 0, excluded: 0, pending: 0 };
  for (const s of stacks) counts[s.status] += 1;

  return { stacks, counts, orphanedEntries, autoReset, errors };
}

/** Exclusion is only offered for stacks that exist and aren't already backed up. */
async function canExclude(name) {
  const { stacks } = await getStatus();
  const stack = stacks.find((s) => s.name === name);
  return Boolean(stack && stack.status === 'pending');
}

module.exports = { getStatus, canExclude, stackNameForPath };
