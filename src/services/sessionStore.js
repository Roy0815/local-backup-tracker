'use strict';

const session = require('express-session');

const PRUNE_INTERVAL_MS = 1000 * 60 * 15;

/**
 * In-memory session store that actually drops expired sessions.
 * express-session's built-in MemoryStore only checks expiry when a session is
 * read again, so sessions of visitors who never come back pile up forever
 * (hence its "will leak memory" warning). Single-process only, like the rest
 * of the app; everyone is logged out on restart.
 */
class PruningMemoryStore extends session.Store {
  constructor() {
    super();
    this.sessions = new Map(); // sid -> { data: JSON string, expires: ms timestamp }
    this.pruneTimer = setInterval(() => this.prune(), PRUNE_INTERVAL_MS);
    this.pruneTimer.unref();
  }

  static expiresAt(sess) {
    const expires = sess.cookie && sess.cookie.expires;
    return expires ? new Date(expires).getTime() : Infinity;
  }

  prune() {
    const now = Date.now();
    for (const [sid, entry] of this.sessions) {
      if (entry.expires <= now) this.sessions.delete(sid);
    }
  }

  get(sid, cb) {
    const entry = this.sessions.get(sid);
    if (!entry) return cb(null, null);
    if (entry.expires <= Date.now()) {
      this.sessions.delete(sid);
      return cb(null, null);
    }
    cb(null, JSON.parse(entry.data));
  }

  set(sid, sess, cb) {
    this.sessions.set(sid, { data: JSON.stringify(sess), expires: PruningMemoryStore.expiresAt(sess) });
    cb(null);
  }

  touch(sid, sess, cb) {
    const entry = this.sessions.get(sid);
    if (entry) entry.expires = PruningMemoryStore.expiresAt(sess);
    cb(null);
  }

  destroy(sid, cb) {
    this.sessions.delete(sid);
    cb(null);
  }
}

module.exports = PruningMemoryStore;
