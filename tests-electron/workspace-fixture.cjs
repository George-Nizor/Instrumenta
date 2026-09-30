'use strict';

// Some tests read the product checkouts beside Instrumenta: the workspace a developer has. CI
// checks out Instrumenta alone, so those tests skip there, and say why, rather than fail on a
// missing sibling. They check a workspace's integration, not the launcher on its own.

const fs = require('node:fs');
const path = require('node:path');

const workspaceRoot = path.resolve(__dirname, '..', '..');
const siblings = ['Fabula', 'Imago', 'Ludere', 'LearnChess'];

// The skip reason when the workspace (plus any extra files named, relative to its root) is not
// here, else false — the value `test(name, { skip }, fn)` takes.
function needsWorkspace(...files) {
  const missing = [
    ...siblings.filter((name) => !fs.existsSync(path.join(workspaceRoot, name, 'instrumenta', 'product.json'))),
    ...files.filter((file) => !fs.existsSync(path.join(workspaceRoot, file))),
  ];
  return missing.length ? `needs the workspace beside Instrumenta (missing ${missing.join(', ')})` : false;
}

module.exports = { needsWorkspace, workspaceRoot };
