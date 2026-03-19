module.exports = {
  apps: [
    {
      name: "dappscore-frontend",
      script: "node_modules/.bin/next",
      args: "start",
      cwd: "/var/www/dappscore",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
      instances: "max",
      exec_mode: "cluster",
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
    },
    {
      name: "dappscore-backend",
      script: "dist/index.js",
      cwd: "/var/www/dappscore/backend",
      env: {
        NODE_ENV: "production",
        PORT: 3001,
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
    },
  ],
};
