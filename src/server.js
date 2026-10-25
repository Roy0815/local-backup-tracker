'use strict';

const createApp = require('./app');
const env = require('./config/env');

createApp()
  .then((app) => {
    app.listen(env.PORT, () => {
      console.log(`Local backup tracker listening on port ${env.PORT}`);
      console.log(`  stacks:  ${env.STACKS_DIR}`);
      console.log(`  crontab: ${env.CRONTAB_PATH} (script: ${env.BACKUP_SCRIPT_NAME})`);
      if (!env.API_KEY) console.log('  API_KEY not set — /api/status is disabled');
    });
  })
  .catch((err) => {
    console.error('Failed to start application:', err);
    process.exit(1);
  });
