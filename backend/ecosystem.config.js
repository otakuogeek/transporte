// ecosystem.config.js - Configuración PM2 para producción
module.exports = {
  apps: [
    {
      name: 'falc-backend',
      script: 'server.js',
      cwd: '/var/www/falc.indielab.pro/backend',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '256M',
      env: {
        NODE_ENV: 'production',
        PORT: 4000,
      },
      error_file: '/var/log/pm2/falc-error.log',
      out_file: '/var/log/pm2/falc-out.log',
      time: true,
    },
  ],
};
