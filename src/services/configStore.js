'use strict';

const crypto = require('crypto');
const yamlStore = require('./yamlStore');
const env = require('../config/env');

/**
 * express-session needs a stable signing secret across restarts. Generate
 * it once on first boot and persist it in config.yml rather than making
 * SESSION_SECRET a required env var.
 */
async function getOrCreateSessionSecret() {
  return yamlStore
    .updateYaml(env.CONFIG_FILE, {}, (data) => {
      if (!data.sessionSecret) {
        data.sessionSecret = crypto.randomBytes(48).toString('hex');
      }
      return data;
    })
    .then((data) => data.sessionSecret);
}

module.exports = { getOrCreateSessionSecret };
