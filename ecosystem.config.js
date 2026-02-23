module.exports = {
  apps: [{
    name: 'clippost',
    script: 'node_modules/.bin/next',
    args: 'start -p 3001',
    cwd: '/var/www/html/clippost',
    env: {
      NODE_ENV: 'production',
      PATH: '/usr/local/bin:/usr/bin:/bin:/home/nikhilbot/.nvm/versions/node/v22.22.0/bin'
    }
  }]
}
