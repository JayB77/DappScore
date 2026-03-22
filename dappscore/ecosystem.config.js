module.exports = {
  apps: [
    {
      name: 'dappscore-frontend',
      script: 'node_modules/.bin/next',
      args: 'start',
      cwd: __dirname,
      instances: 'max',
      exec_mode: 'cluster',
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: 'logs/error.log',
      out_file: 'logs/out.log',
      merge_logs: true,
      autorestart: true,
      restart_delay: 3000,
      max_restarts: 10,
    },
  ],
};
