module.exports = {
  apps: [{
    name: 'clippost',
    script: 'npm',
    args: 'start',
    cwd: '/var/www/html/clippost',
    env: {
      NODE_ENV: 'production',
      PATH: '/usr/local/bin:/usr/bin:/bin:/home/nikhilbot/.nvm/versions/node/v22.22.0/bin'
    }
  }]
}
