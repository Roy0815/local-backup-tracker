'use strict';

/**
 * Minimal replacement for connect-flash (unmaintained, triggers the
 * util.isArray deprecation warning). Same API for what we use:
 * req.flash(type, msg) queues a message, req.flash(type) returns and clears.
 */
function flash(req, res, next) {
  req.flash = (type, msg) => {
    const store = req.session.flash || (req.session.flash = {});
    if (msg !== undefined) {
      (store[type] || (store[type] = [])).push(msg);
      return undefined;
    }
    const messages = store[type] || [];
    delete store[type];
    if (Object.keys(store).length === 0) delete req.session.flash;
    return messages;
  };
  next();
}

module.exports = { flash };
