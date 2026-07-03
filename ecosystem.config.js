module.exports = {
  apps: [{
    name: "yuan-academy",
    script: "./node_modules/.bin/next",
    args: "start -p 3001",
    cwd: "/var/www/yuan-academy",
    exec_mode: "fork",
    instances: 1,
    max_memory_restart: "512M",
    env: {
      NODE_ENV: "production",
      NODE_OPTIONS: "--max-old-space-size=512",
    },
    min_uptime: "5s",
    max_restarts: 50,
    restart_delay: 5000,
  }]
}
