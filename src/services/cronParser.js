'use strict';

const fs = require('fs');
const fsp = fs.promises;
const path = require('path');

// Pure parsing — no knowledge of which stacks exist. stackStatus.js matches
// the extracted paths against the scanned stacks directory.

/** Splits a shell command line on whitespace, honouring simple '…' and "…" quoting. */
function tokenize(line) {
  const tokens = [];
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let m;
  while ((m = re.exec(line)) !== null) {
    tokens.push(m[1] !== undefined ? m[1] : m[2] !== undefined ? m[2] : m[3]);
  }
  return tokens;
}

// Anything from here on is shell plumbing, not an argument to the script.
function isShellOperator(token) {
  return /[<>|;&]/.test(token);
}

/**
 * Extracts every invocation of `scriptName` from crontab text. Works for
 * user crontabs (`m h dom mon dow cmd`) and /etc/cron.d files (`… user cmd`)
 * alike, because it searches for the script token instead of counting
 * fields. Commented-out lines are ignored — a disabled job is no backup.
 *
 * Returns [{ schedule, stackPath, line }], one entry per path argument.
 */
function parseCrontab(text, scriptName) {
  const entries = [];
  text.split(/\r?\n/).forEach((rawLine, idx) => {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) return;
    // VAR=value lines (MAILTO=, PATH=, …)
    if (/^[A-Za-z_][A-Za-z0-9_]*\s*=/.test(line)) return;

    const tokens = tokenize(line);
    const scriptIdx = tokens.findIndex((t) => path.posix.basename(t) === scriptName);
    if (scriptIdx === -1) return;

    const schedule = tokens[0].startsWith('@') ? tokens[0] : tokens.slice(0, 5).join(' ');
    for (const arg of tokens.slice(scriptIdx + 1)) {
      if (isShellOperator(arg)) break;
      entries.push({ schedule, stackPath: arg.replace(/\/+$/, ''), line: idx + 1 });
    }
  });
  return entries;
}

/**
 * Reads CRONTAB_PATH (a file, or a directory of crontab files such as a
 * mounted /etc/cron.d) and returns all backup entries found. Throws if the
 * path can't be read — the caller must surface that, since "can't read the
 * crontab" would otherwise look exactly like "nothing is backed up".
 */
async function readBackupEntries(crontabPath, scriptName) {
  const stat = await fsp.stat(crontabPath);
  const files = [];
  if (stat.isDirectory()) {
    const names = (await fsp.readdir(crontabPath)).filter((n) => !n.startsWith('.')).sort();
    for (const name of names) {
      const full = path.join(crontabPath, name);
      if ((await fsp.stat(full)).isFile()) files.push(full);
    }
  } else {
    files.push(crontabPath);
  }

  const entries = [];
  for (const file of files) {
    const text = await fsp.readFile(file, 'utf8');
    for (const entry of parseCrontab(text, scriptName)) {
      entries.push({ ...entry, file });
    }
  }
  return entries;
}

module.exports = { tokenize, parseCrontab, readBackupEntries };
