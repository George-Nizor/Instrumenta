const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { needsWorkspace } = require('./workspace-fixture.cjs');
const {
  configPaths,
  copyDirectoryAtomically,
  doctor,
  doctorExitCode,
  installSuiteAtomically,
  managedConfigBlock,
  mergeManagedConfig,
  tomlString,
} = require('../ai/setup-agent.cjs');
const { launchableMcp, resolveServer } = require('../ai/launch-mcp.cjs');

test('AI config block preserves unrelated Codex configuration and replaces itself once', { skip: needsWorkspace() }, () => {
  const original = 'model = "gpt-test"\n\n[mcp_servers.existing]\ncommand = "keep"\n';
  const first = mergeManagedConfig(original, 'BEGIN-TEST');
  assert.match(first, /mcp_servers\.existing/);
  const real = mergeManagedConfig(first.replace('BEGIN-TEST', managedConfigBlock()));
  const updated = mergeManagedConfig(real);
  assert.equal(updated, real);
  assert.equal((updated.match(/BEGIN Instrumenta AI integration/g) || []).length, 1);
  assert.match(updated, /default_tools_approval_mode = "writes"/);
  assert.match(updated, /\[mcp_servers\.ludere\][\s\S]*?tool_timeout_sec = /);
  // Motus is discontinued and Imago is a service that drives Claude itself; setup must not keep
  // registering a server for either.
  assert.doesNotMatch(updated, /mcp_servers\.motus/);
  assert.doesNotMatch(updated, /mcp_servers\.imago/);
  assert.throws(
    () => mergeManagedConfig(`${real}\n${managedConfigBlock()}\n`),
    /incomplete Instrumenta managed block/,
  );
  assert.throws(
    () => mergeManagedConfig('[mcp_servers.discere]\ncommand = "custom"\n'),
    /already defines mcp_servers\.discere/,
  );
  assert.throws(
    () => mergeManagedConfig('[ "mcp_servers" . \'ludere\' ]\ncommand = "custom"\n'),
    /already defines mcp_servers\.ludere/,
  );
});

test('AI config uses valid escaped TOML basic strings', () => {
  assert.equal(tomlString('C:\\Program Files\\Node\\node.exe'), '"C:\\\\Program Files\\\\Node\\\\node.exe"');
  assert.equal(tomlString('a"b'), '"a\\"b"');
});

test('skill installation replaces an existing folder atomically', () => {
  const area = fs.mkdtempSync(path.join(os.tmpdir(), 'instrumenta-skill-install-'));
  try {
    const source = path.join(area, 'source');
    const destination = path.join(area, 'skills', 'sample');
    fs.mkdirSync(source, { recursive: true });
    fs.mkdirSync(destination, { recursive: true });
    fs.writeFileSync(path.join(source, 'SKILL.md'), 'new\n');
    fs.writeFileSync(path.join(destination, 'SKILL.md'), 'old\n');
    copyDirectoryAtomically(source, destination);
    assert.equal(fs.readFileSync(path.join(destination, 'SKILL.md'), 'utf8'), 'new\n');
    assert.deepEqual(fs.readdirSync(path.dirname(destination)), ['sample']);
  } finally {
    fs.rmSync(area, { recursive: true, force: true });
  }
});

test('AI suite install rolls back every skill and config after a late failure', () => {
  const area = fs.mkdtempSync(path.join(os.tmpdir(), 'instrumenta-suite-install-'));
  try {
    const directories = ['ludere', 'discere'].map((name) => {
      const source = path.join(area, 'source', name);
      const destination = path.join(area, 'home', '.agents', 'skills', name);
      fs.mkdirSync(source, { recursive: true });
      fs.mkdirSync(destination, { recursive: true });
      fs.writeFileSync(path.join(source, 'SKILL.md'), `new ${name}\n`);
      fs.writeFileSync(path.join(destination, 'SKILL.md'), `old ${name}\n`);
      return { name, source, destination };
    });
    const config = path.join(area, 'codex', 'config.toml');
    fs.mkdirSync(path.dirname(config), { recursive: true });
    fs.writeFileSync(config, 'model = "keep-me"\n');

    assert.throws(() => installSuiteAtomically({
      directories,
      file: { name: 'codex-config', destination: config, content: 'replacement = true\n' },
      onStep: ({ phase, name }) => {
        if (phase === 'committed' && name === 'codex-config') throw new Error('injected final commit failure');
      },
    }), /injected final commit failure/);

    for (const { name, destination } of directories) {
      assert.equal(fs.readFileSync(path.join(destination, 'SKILL.md'), 'utf8'), `old ${name}\n`);
    }
    assert.equal(fs.readFileSync(config, 'utf8'), 'model = "keep-me"\n');
    const leftovers = fs.readdirSync(path.join(area, 'home', '.agents', 'skills'))
      .filter((name) => name.includes('.instrumenta-'));
    assert.deepEqual(leftovers, []);
    assert.deepEqual(fs.readdirSync(path.dirname(config)).sort(), ['config.toml']);
  } finally {
    fs.rmSync(area, { recursive: true, force: true });
  }
});

test('AI suite install refuses symbolic-link destinations without touching their targets', (t) => {
  if (process.platform === 'win32') return t.skip('Windows developer-mode symlink privileges vary');
  const area = fs.mkdtempSync(path.join(os.tmpdir(), 'instrumenta-suite-symlink-'));
  try {
    const source = path.join(area, 'source');
    const outside = path.join(area, 'outside');
    const destination = path.join(area, 'skills', 'sample');
    fs.mkdirSync(source, { recursive: true });
    fs.mkdirSync(outside, { recursive: true });
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(path.join(source, 'SKILL.md'), 'new\n');
    fs.writeFileSync(path.join(outside, 'SKILL.md'), 'outside\n');
    fs.symlinkSync(outside, destination, 'dir');
    assert.throws(() => installSuiteAtomically({
      directories: [{ name: 'sample', source, destination }],
    }), /must not be a symbolic link/);
    assert.equal(fs.readFileSync(path.join(outside, 'SKILL.md'), 'utf8'), 'outside\n');
    assert.equal(fs.lstatSync(destination).isSymbolicLink(), true);
  } finally {
    fs.rmSync(area, { recursive: true, force: true });
  }
});

test('Codex paths use the official user skill scope without changing CODEX_HOME semantics', () => {
  const paths = configPaths({ CODEX_HOME: '/tmp/custom-codex' }, '/tmp/person');
  assert.equal(paths.configFile, path.join('/tmp/custom-codex', 'config.toml'));
  assert.equal(paths.skillsRoot, path.join('/tmp/person', '.agents', 'skills'));
});

test('MCP launcher resolves known servers and rejects unknown names', { skip: needsWorkspace() }, () => {
  assert.ok(resolveServer('discere').command);
  assert.equal(path.basename(resolveServer('ludere').module), 'index.mjs');
  assert.throws(() => resolveServer('unknown'), /Unknown Instrumenta MCP/);
});

test('MCP launcher forwards host shutdown to native child servers', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '..', 'ai', 'launch-mcp.cjs'), 'utf8');
  assert.match(source, /forwardInterrupt = \(\) => stopChild\('SIGINT'\)/);
  assert.match(source, /forwardTermination = \(\) => stopChild\('SIGTERM'\)/);
  assert.match(source, /process\.once\('SIGINT', forwardInterrupt\)/);
  assert.match(source, /process\.once\('SIGTERM', forwardTermination\)/);
  assert.match(source, /process\.stdin\.once\('error'/);
  assert.match(source, /child\.stdin\.once\('error'/);
});

test('AI doctor handshakes only after every declared entrypoint is ready', () => {
  const readyStatus = {
    ready: false,
    servers: Object.fromEntries(['ludere', 'discere'].map((name) => [name, { ready: true }])),
    skills: {},
    config: { ready: false },
  };
  let smokeCalls = 0;
  const healthy = doctor({
    statusResult: readyStatus,
    smokeAll: () => {
      smokeCalls += 1;
      return ['ludere', 'discere'].map((app) => ({ app, toolCount: 1 }));
    },
  });
  assert.equal(healthy.handshake.ready, true);
  assert.equal(healthy.handshake.results.length, 2);
  assert.equal(smokeCalls, 1);
  assert.equal(doctorExitCode(healthy), 0);

  const unavailable = doctor({
    statusResult: { ...readyStatus, servers: { ...readyStatus.servers, discere: { ready: false } } },
    smokeAll: () => { throw new Error('must not run'); },
  });
  assert.equal(unavailable.handshake.ready, false);
  assert.equal(unavailable.handshake.skipped, true);
  assert.equal(smokeCalls, 1);
  assert.equal(doctorExitCode(unavailable), 0);

  const broken = doctor({
    statusResult: readyStatus,
    smokeAll: () => { throw new Error('protocol handshake failed'); },
  });
  assert.equal(broken.handshake.ready, false);
  assert.equal(broken.handshake.skipped, false);
  assert.equal(doctorExitCode(broken), 1);
});

test('POSIX doctor performs read-only app status and AI live diagnostics', { skip: needsWorkspace('instrumenta.sh') }, () => {
  const shell = fs.readFileSync(path.resolve(__dirname, '..', '..', 'instrumenta.sh'), 'utf8');
  const delegation = shell.match(/if \[\[ "\$target"[\s\S]*?command -v powershell\.exe/)?.[0] || '';
  assert.match(delegation, /"\$mode" != "doctor"/);
  assert.match(delegation, /"\$mode" != "status"/);
  const branch = shell.match(/\n  doctor\)([\s\S]*?)\n    ;;/)?.[1] || '';
  assert.match(branch, /workspace-manager\.cjs" status/);
  assert.match(branch, /setup-agent\.cjs" doctor/);
  assert.doesNotMatch(branch, /\bprepare\b|setup-agent\.cjs" install/);
});

test('AI setup registers only MCP servers the launcher can start', () => {
  assert.equal(launchableMcp({ kind: 'web', adapter: 'web-vite', mcp: { skill: 'ai/skills/x' } }), true);
  assert.equal(launchableMcp({ kind: 'native', adapter: 'native-bundle', mcp: { skill: 'ai/skills/x' } }), true);
  // Forge3D's v2 manifest names a skill in its own plugin; there is no server here to start.
  assert.equal(launchableMcp({ kind: 'native', adapter: 'managed-bundle', mcp: { skill: 'plugins/forge3d/skills/forge3d/SKILL.md' } }), false);
  assert.equal(launchableMcp({ kind: 'web', adapter: 'web-vite' }), false, 'no MCP block, nothing to register');
  assert.doesNotMatch(managedConfigBlock(), /mcp_servers\.forge3d/);
});
