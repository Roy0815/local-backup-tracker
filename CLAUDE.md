# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A server-rendered admin web app (Express + EJS) that lists every Docker
Compose stack in a mounted stacks directory and shows whether the
crontab-driven `docker-stack-backup.sh` backs it up. Admins can mark
un-backed-up stacks as "kein Backup nötig". No database — YAML under
`data/`. Structure, auth, CSRF, YAML store and styling are deliberately
copied from the sibling project `../mtls-certificate-manager`; keep them
in sync in spirit when changing shared patterns. User-facing text is German.

## Commands

```bash
npm install
npm start                    # node src/server.js
node cli.js unlock-admin     # reset a locked-out admin account

docker compose up -d --build
```

No lint config, no test suite. Verify by running locally against a scratch
dir: `DATA_DIR=… STACKS_DIR=… CRONTAB_PATH=… HOST_STACKS_DIR=… API_KEY=… npm start`
(a fake stacks dir only needs `<name>/compose.yaml` files), then exercise
routes with curl.

## Architecture

- `services/stackStatus.js:getStatus()` is the single source of truth for
  both the dashboard and `/api/status`. It re-reads the stacks dir and the
  crontab on every call; coverage is never stored, only exclusions
  (`excluded.yml` via `excludedStore`). It also has a write side effect:
  an excluded stack that now appears in the crontab gets its exclusion
  removed (user requirement). That reset is skipped when the crontab can't
  be read.
- `services/cronParser.js` is pure parsing: it finds the token whose
  basename is `BACKUP_SCRIPT_NAME` and takes the following tokens up to the
  first shell operator as stack paths. It doesn't count cron fields, so
  user-crontab and `/etc/cron.d` (extra user column) formats both work.
- Read errors (stacks dir, crontab) are collected into `errors`, not
  thrown — an unreadable crontab would otherwise look like "nothing is
  backed up". The API turns any error into a 503.
- `routes/api.js` is mounted **before** `express-session` in `app.js` on
  purpose: the `csrfToken` middleware writes to the session, so every
  Homepage poll would create a new in-memory session otherwise.
- Views: no client framework, no inline event handlers (Helmet CSP sets
  `script-src-attr 'none'`) — interactive behavior goes in
  `public/js/app.js` via `data-*` attributes.
- `services/yamlStore.js` is the only thing touching `data/*` (per-file
  async queue + temp-file rename). Single-process only.

## Docker

`entrypoint.sh` starts as root, creates the PUID/PGID user, chowns only
`/app/data` (stacks and cron dir are read-only mounts), then `su-exec`s to
Node. The cron dir is mounted as a directory, not a single file, because
single-file bind mounts go stale when an editor replaces the file.
