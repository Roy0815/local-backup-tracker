'use strict';

const express = require('express');
const path = require('path');
const session = require('express-session');
const helmet = require('helmet');

const env = require('./config/env');
const configStore = require('./services/configStore');
const { csrfToken } = require('./middleware/csrf');
const { flash } = require('./middleware/flash');
const PruningMemoryStore = require('./services/sessionStore');
const icons = require('./config/icons');

async function createApp() {
  const app = express();
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, 'views'));
  app.locals.icons = icons;
  // Needed so express-session's cookie.secure:'auto' and rate-limiter IP
  // detection work correctly behind a reverse proxy (e.g. Nginx Proxy Manager)
  // terminating TLS.
  app.set('trust proxy', 1);

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", 'https://fonts.googleapis.com'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com'],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", 'data:'],
        },
      },
    })
  );

  // Mounted before the session middleware on purpose: the csrfToken
  // middleware writes to req.session, so every API poll from Homepage would
  // otherwise create a new in-memory session that is never cleaned up.
  app.use('/', require('./routes/api'));

  app.use(express.urlencoded({ extended: false }));
  app.use(express.static(path.join(__dirname, 'public')));

  // No DBMS means no Redis/SQL-backed session store either; an in-memory
  // store is fine for a single-container internal admin tool — the only cost
  // is that everyone is logged out on container restart. Not express-session's
  // own MemoryStore: that one never drops expired sessions (see sessionStore.js).
  const sessionSecret = env.SESSION_SECRET || (await configStore.getOrCreateSessionSecret());
  app.use(
    session({
      secret: sessionSecret,
      store: new PruningMemoryStore(),
      name: 'backup_tracker_sid',
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        secure: 'auto', // requires 'trust proxy' above to detect HTTPS behind a reverse proxy
        sameSite: 'strict',
        maxAge: 1000 * 60 * 60 * 8,
      },
    })
  );
  app.use(flash);
  app.use(csrfToken);
  app.use((req, res, next) => {
    res.locals.successMessages = req.flash('success');
    res.locals.errorMessages = req.flash('error');
    res.locals.username = req.session && req.session.username;
    next();
  });

  app.use('/', require('./routes/setup'));
  app.use('/', require('./routes/auth'));
  app.use('/', require('./routes/dashboard'));

  app.use((req, res) => {
    res.status(404).render('error', { message: 'Seite nicht gefunden.' });
  });

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).render('error', { message: 'Ein unerwarteter Fehler ist aufgetreten.' });
  });

  return app;
}

module.exports = createApp;
