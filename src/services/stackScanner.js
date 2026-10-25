'use strict';

const fs = require('fs');
const fsp = fs.promises;
const path = require('path');

// Dockge layout: one directory per stack directly below the stacks root,
// each containing one of these. Directories without a compose file (e.g.
// leftover data folders) are not stacks.
const COMPOSE_FILENAMES = ['compose.yaml', 'compose.yml', 'docker-compose.yaml', 'docker-compose.yml'];

async function hasComposeFile(dir) {
  for (const name of COMPOSE_FILENAMES) {
    try {
      await fsp.access(path.join(dir, name), fs.constants.F_OK);
      return true;
    } catch {
      // try next name
    }
  }
  return false;
}

/** Returns the sorted names of all stack directories under stacksDir. Throws if stacksDir is unreadable. */
async function listStacks(stacksDir) {
  const dirents = await fsp.readdir(stacksDir, { withFileTypes: true });
  const names = [];
  for (const d of dirents) {
    if (!d.isDirectory() || d.name.startsWith('.')) continue;
    if (await hasComposeFile(path.join(stacksDir, d.name))) names.push(d.name);
  }
  return names.sort((a, b) => a.localeCompare(b));
}

module.exports = { listStacks, COMPOSE_FILENAMES };
