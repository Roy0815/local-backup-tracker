'use strict';

const yamlStore = require('./yamlStore');
const env = require('../config/env');

// excluded.yml: stacks the admin marked as "kein Backup nötig".
//   - name: pgadmin
//     excludedAt: 2026-10-25T21:00:00.000Z

async function listExcluded() {
  return yamlStore.readYaml(env.EXCLUDED_FILE, []);
}

async function addExcluded(name) {
  return yamlStore.updateYaml(env.EXCLUDED_FILE, [], (list) => {
    if (!list.some((e) => e.name === name)) {
      list.push({ name, excludedAt: new Date().toISOString() });
    }
    return list;
  });
}

async function removeExcluded(names) {
  const toRemove = new Set(Array.isArray(names) ? names : [names]);
  return yamlStore.updateYaml(env.EXCLUDED_FILE, [], (list) => list.filter((e) => !toRemove.has(e.name)));
}

module.exports = { listExcluded, addExcluded, removeExcluded };
