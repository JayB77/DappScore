/**
 * PM2 ecosystem config — DappScore API on VPS.
 *
 * Start:   pm2 start ecosystem.config.js
 * Reload:  pm2 reload dappscore-api
 * Logs:    pm2 logs dappscore-api
 * Status:  pm2 status
 */

module.exports = {
  apps: [
    {
      name:         'dappscore-api',
      script:       'dist/index.js',
      cwd:          __dirname,
      instances:    'max',          // cluster mode — one per CPU core
      exec_mode:    'cluster',
      watch:        false,
      max_memory_restart: '512M',

      env: {
        NODE_ENV: 'production',
        PORT:     3001,
      },

      // Graceful reload: wait for existing connections to finish
      kill_timeout:     5000,
      wait_ready:       false,
      listen_timeout:   10000,

      // Logging
      log_date_format:  'YYYY-MM-DD HH:mm:ss Z',
      error_file:       'logs/error.log',
      out_file:         'logs/out.log',
      merge_logs:       true,

      // Auto-restart on crash
      autorestart:      true,
      restart_delay:    3000,
      max_restarts:     10,
    },
  ],
};
