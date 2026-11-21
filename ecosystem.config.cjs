module.exports = {
  apps: [
    {
      name: 'rb-monitor',
      script: 'server.ts',
      interpreter: 'node',
      interpreter_args: '--import tsx',
      exec_mode: 'fork',
      cwd: './',
      env: {
        NODE_ENV: 'production',
        PATH: `${process.env.HOME}/.local/share/pnpm:${process.env.PATH}`,
      },
      // Restart policy
      instances: 1,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
      max_memory_restart: '512M',
      // Logs
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      // Watch (disabled in production, enable for debug)
      watch: false,
    },
  ],
};
