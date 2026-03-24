module.exports = {
  apps: [{
    name: 'aegis',
    script: 'dist/main.js',
    args: ['--tray'],
    cwd: 'D:\\Projects\\AEGIS',
    restart_delay: 3000,
    max_restarts: 3,
    autorestart: true
  }]
}
