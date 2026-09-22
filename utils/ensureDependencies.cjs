'use strict';

const { spawnSync } = require('child_process');

module.exports = function ensureDependencies() {
  const required = ['discord.js', 'tsx/cjs'];
  const missing = required.some(name => {
    try {
      require.resolve(name);
      return false;
    } catch {
      return true;
    }
  });

  if (!missing) return true;

  const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const args = [
    'install',
    '--omit=dev',
    '--no-audit',
    '--no-fund',
    '--package-lock=false',
    '--registry=https://registry.npmjs.org'
  ];

  console.warn('Missing Node.js dependencies. Installing from the public npm registry...');
  const result = spawnSync(npmCommand, args, {
    cwd: __dirname + '/..',
    stdio: 'inherit'
  });

  if (result.error || result.status !== 0) {
    console.error(
      'Dependency installation failed. Run "npm install --registry=https://registry.npmjs.org" '
      + 'in the bot folder, then restart Astrix.'
    );
    if (result.error) console.error(result.error.message);
    process.exit(1);
  }
  return true;
};