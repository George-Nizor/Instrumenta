'use strict';

const fs = require('node:fs');
const path = require('node:path');

// The commands that install and build a managed-service checkout, chosen by the
// lockfile it ships rather than by product: a pnpm workspace (Discere) installs
// frozen, an npm project (Imago) takes a clean `npm ci`, and a project with no
// lockfile still gets a plain install.
function serviceCommands(directory, exists = fs.existsSync) {
  if (exists(path.join(directory, 'pnpm-lock.yaml'))) {
    return [['pnpm', 'install', '--frozen-lockfile'], ['pnpm', 'run', 'build']];
  }
  return [
    ['npm', exists(path.join(directory, 'package-lock.json')) ? 'ci' : 'install', '--no-audit', '--no-fund'],
    ['npm', 'run', 'build'],
  ];
}

module.exports = { serviceCommands };
