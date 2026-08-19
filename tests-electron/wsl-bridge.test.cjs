'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  parseWslShare,
  pidFileFor,
  planPrepare,
  planServiceBridge,
  shellQuote,
} = require('../electron/wsl-bridge.cjs');

const DISCERE_SHARE = '\\\\wsl.localhost\\Ubuntu\\workspace\\dev_projects_master\\_PersonalProjects\\Instrumenta\\Discere';

test('parseWslShare reads both WSL share spellings and both slash directions', () => {
  assert.deepEqual(parseWslShare(DISCERE_SHARE), {
    distro: 'Ubuntu',
    linuxPath: '/workspace/dev_projects_master/_PersonalProjects/Instrumenta/Discere',
  });
  assert.deepEqual(parseWslShare('\\\\wsl$\\Ubuntu-22.04\\home\\user'), {
    distro: 'Ubuntu-22.04',
    linuxPath: '/home/user',
  });
  assert.deepEqual(parseWslShare('//wsl.localhost/Ubuntu/home'), { distro: 'Ubuntu', linuxPath: '/home' });
  assert.deepEqual(parseWslShare('\\\\wsl.localhost\\Ubuntu'), { distro: 'Ubuntu', linuxPath: '/' });
});

test('parseWslShare refuses everything that is not a WSL share', () => {
  assert.equal(parseWslShare('C:\\Users\\George'), null);
  assert.equal(parseWslShare('\\\\fileserver\\projects\\Discere'), null);
  assert.equal(parseWslShare('/workspace/dev_projects_master'), null);
  assert.equal(parseWslShare(''), null);
  assert.equal(parseWslShare(undefined), null);
});

test('parseWslShare refuses hostile distro names and traversal', () => {
  assert.equal(parseWslShare("\\\\wsl.localhost\\Ubu'ntu\\home"), null);
  assert.equal(parseWslShare('\\\\wsl.localhost\\Ubuntu\\home\\..\\..\\etc'), null);
});

test('pidFileFor produces a safe per-tool path', () => {
  assert.equal(pidFileFor('discere', 49323), '/tmp/instrumenta-service-discere-49323.pid');
  assert.equal(pidFileFor('../evil name', 49323), '/tmp/instrumenta-service-evilname-49323.pid');
});

test('shellQuote survives embedded single quotes', () => {
  assert.equal(shellQuote("it's"), "'it'\\''s'");
});

test('planServiceBridge is inert for a local working directory', () => {
  assert.equal(planServiceBridge({ tool: 'discere', command: ['pnpm', 'start'], cwd: 'C:\\work\\Discere', env: {}, port: 49323 }), null);
});

test('planServiceBridge wraps the launch in a login shell with the service variables inline', () => {
  const plan = planServiceBridge({
    tool: 'discere',
    command: ['pnpm', '--filter', '@discere/server', 'start'],
    cwd: DISCERE_SHARE,
    env: { PORT: '49323', HOST: '127.0.0.1', DISCERE_TUTOR_PROVIDER: 'codex' },
    port: 49323,
  });
  assert.ok(plan);
  assert.match(plan.executable, /wsl\.exe$/i);
  assert.equal(plan.distro, 'Ubuntu');
  assert.deepEqual(plan.args.slice(0, 5), ['-d', 'Ubuntu', '--exec', 'bash', '-lc']);
  const script = plan.args[5];
  assert.match(script, /cd '\/workspace\/dev_projects_master\/_PersonalProjects\/Instrumenta\/Discere' \|\| exit 97/);
  assert.match(script, /setsid env .*'PORT=49323' 'HOST=127\.0\.0\.1' 'DISCERE_TUTOR_PROVIDER=codex' 'pnpm' '--filter' '@discere\/server' 'start' &/);
  assert.match(script, /printf '%s\\n' "\$pid" > '\/tmp\/instrumenta-service-discere-49323\.pid'/);
  assert.match(script, /wait "\$pid"/);
});

test('planServiceBridge stop arguments signal the recorded Linux process group', () => {
  const plan = planServiceBridge({
    tool: 'discere', command: ['pnpm', 'start'], cwd: DISCERE_SHARE, env: {}, port: 49323,
  });
  const term = plan.stopArgs('SIGTERM');
  assert.deepEqual(term.slice(0, 5), ['-d', 'Ubuntu', '--exec', 'bash', '-c']);
  assert.match(term[5], /kill -TERM -- "-\$pid"/);
  assert.doesNotMatch(term[5], /rm -f/);
  const kill = plan.stopArgs('SIGKILL');
  assert.match(kill[5], /kill -KILL -- "-\$pid"/);
  assert.match(kill[5], /rm -f '\/tmp\/instrumenta-service-discere-49323\.pid'/);
});

test('planServiceBridge refuses control characters in command and environment', () => {
  assert.throws(() => planServiceBridge({
    tool: 'discere', command: ['pnpm', 'start\n; rm -rf /'], cwd: DISCERE_SHARE, env: {}, port: 49323,
  }), /printable ASCII/);
  assert.throws(() => planServiceBridge({
    tool: 'discere', command: ['pnpm', 'start'], cwd: DISCERE_SHARE, env: { BAD: 'a\u0007b' }, port: 49323,
  }), /printable ASCII/);
});

test('planPrepare chains its commands inside the distribution', () => {
  const plan = planPrepare({
    cwd: DISCERE_SHARE,
    commands: [['pnpm', 'install', '--frozen-lockfile'], ['pnpm', 'run', 'build']],
  });
  assert.ok(plan);
  assert.deepEqual(plan.args.slice(0, 5), ['-d', 'Ubuntu', '--exec', 'bash', '-lc']);
  assert.match(plan.args[5], /'pnpm' 'install' '--frozen-lockfile' && 'pnpm' 'run' 'build'/);
  assert.equal(planPrepare({ cwd: 'C:\\work\\Discere', commands: [['pnpm', 'install']] }), null);
});
