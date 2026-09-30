'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { launchableMcp, resolveServer } = require('./launch-mcp.cjs');
const { registryFor } = require('../scripts/product-registry.cjs');

const launcherRoot = path.resolve(__dirname, '..');
const workspaceRoot = path.resolve(launcherRoot, '..');
const managedStart = '# BEGIN Instrumenta AI integration (managed by Instrumenta)';
const managedEnd = '# END Instrumenta AI integration';

/**
 * Only the products that expose an MCP surface the launcher can start. A product's
 * `instrumenta/product.json` may omit `mcp` entirely — LearnChess has nothing an agent should
 * drive — and everything below this line exists to register, hash, and health-check MCP servers
 * and their skills.
 */
function integrationProducts() {
  return registryFor(launcherRoot).products.filter(launchableMcp);
}
function skillDirectory(product) { return path.resolve(product.sourceRoot, product.mcp.skill); }
function skillName(product) { return path.basename(product.mcp.skill); }

function hashTree(directory) {
  const digest = crypto.createHash('sha256');
  const visit = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))) {
      const absolute = path.join(current, entry.name);
      const relative = path.relative(directory, absolute).split(path.sep).join('/');
      digest.update(`${entry.isDirectory() ? 'd' : 'f'}:${relative}\0`);
      if (entry.isDirectory()) visit(absolute);
      else digest.update(fs.readFileSync(absolute));
    }
  };
  visit(directory);
  return digest.digest('hex');
}

function tomlString(value) {
  return JSON.stringify(String(value));
}

function configPaths(environment = process.env, home = os.homedir()) {
  const codexHome = environment.CODEX_HOME || path.join(home, '.codex');
  return {
    codexHome,
    configFile: path.join(codexHome, 'config.toml'),
    skillsRoot: path.join(home, '.agents', 'skills'),
  };
}

function managedConfigBlock({ nodePath = process.execPath, scriptPath = path.join(__dirname, 'launch-mcp.cjs') } = {}) {
  const entries = integrationProducts().map((product) => [product.id, product.mcp.timeoutSeconds || 900]);
  const sections = entries.map(([name, timeout]) => [
    `[mcp_servers.${name}]`,
    `command = ${tomlString(nodePath)}`,
    `args = [${tomlString(scriptPath)}, ${tomlString(name)}]`,
    `cwd = ${tomlString(workspaceRoot)}`,
    'startup_timeout_sec = 30',
    `tool_timeout_sec = ${timeout}`,
    'enabled = true',
    'required = false',
    'default_tools_approval_mode = "writes"',
  ].join('\n'));
  return `${managedStart}\n${sections.join('\n\n')}\n${managedEnd}`;
}

function mergeManagedConfig(source, block = managedConfigBlock()) {
  const normalized = String(source || '').replace(/\r\n/g, '\n');
  const start = normalized.indexOf(managedStart);
  const end = normalized.indexOf(managedEnd);
  const startCount = normalized.split(managedStart).length - 1;
  const endCount = normalized.split(managedEnd).length - 1;
  let base = normalized;
  if (start >= 0 || end >= 0) {
    if (start < 0 || end < start || startCount !== 1 || endCount !== 1) {
      throw new Error('Codex config contains an incomplete Instrumenta managed block; repair it before setup.');
    }
    base = `${normalized.slice(0, start)}${normalized.slice(end + managedEnd.length)}`;
  }
  for (const product of integrationProducts()) {
    const name = product.id;
    const key = (value) => `(?:${value}|"${value}"|'${value}')`;
    const existingTable = new RegExp(`^\\s*\\[\\s*${key('mcp_servers')}\\s*\\.\\s*${key(name)}\\s*(?:\\.|\\])`, 'm');
    if (existingTable.test(base)) {
      throw new Error(`Codex config already defines mcp_servers.${name} outside Instrumenta's managed block. Rename or remove that entry before setup.`);
    }
  }
  return `${base.trimEnd()}${base.trim() ? '\n\n' : ''}${block}\n`;
}

function pathExists(candidate) {
  try {
    fs.lstatSync(candidate);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

function removeEntry(entryPath, kind) {
  fs.rmSync(entryPath, { recursive: kind === 'directory', force: true });
}

function installSuiteAtomically({ directories, file, onStep = () => {} }) {
  const transaction = `${process.pid}-${crypto.randomUUID()}`;
  const entries = [
    ...directories.map(({ name, source, destination }) => ({ name, source, destination, kind: 'directory' })),
    ...(file ? [{ name: file.name, content: file.content, destination: file.destination, kind: 'file' }] : []),
  ].map((entry) => ({
    ...entry,
    staging: `${entry.destination}.instrumenta-next-${transaction}`,
    previous: `${entry.destination}.instrumenta-previous-${transaction}`,
    previousMoved: false,
    committed: false,
  }));

  if (!entries.length) throw new Error('Instrumenta AI install has no entries to publish.');

  const uniqueDestinations = new Set(entries.map((entry) => path.resolve(entry.destination)));
  if (uniqueDestinations.size !== entries.length) throw new Error('Instrumenta AI install destinations must be unique.');

  const cleanStaging = () => {
    for (const entry of entries) {
      try { removeEntry(entry.staging, entry.kind); } catch {}
    }
  };

  try {
    for (const entry of entries) {
      if (entry.kind === 'directory') {
        const sourceInfo = fs.statSync(entry.source);
        if (!sourceInfo.isDirectory()) throw new Error(`${entry.name} source is not a directory.`);
      }
      const destinationParent = path.dirname(entry.destination);
      const parentInfo = pathExists(destinationParent) ? fs.lstatSync(destinationParent) : null;
      if (parentInfo?.isSymbolicLink()) throw new Error(`${entry.name} destination parent must not be a symbolic link.`);
      if (parentInfo && !parentInfo.isDirectory()) throw new Error(`${entry.name} destination parent is not a directory.`);
      if (pathExists(entry.destination) && fs.lstatSync(entry.destination).isSymbolicLink()) {
        throw new Error(`${entry.name} destination must not be a symbolic link.`);
      }
    }
    // Prepare every replacement before moving any user-owned file. A staging failure therefore
    // leaves all prior skills and config untouched.
    for (const entry of entries) {
      fs.mkdirSync(path.dirname(entry.destination), { recursive: true });
      if (entry.kind === 'directory') fs.cpSync(entry.source, entry.staging, { recursive: true });
      else fs.writeFileSync(entry.staging, entry.content, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
      onStep({ phase: 'staged', name: entry.name });
    }

    // Renames stay on each destination filesystem. If any later publication fails, the reverse
    // pass restores every prior destination, making the multi-skill/config update transactional.
    for (const entry of entries) {
      if (pathExists(entry.destination)) {
        fs.renameSync(entry.destination, entry.previous);
        entry.previousMoved = true;
      }
      onStep({ phase: 'backed-up', name: entry.name });
      fs.renameSync(entry.staging, entry.destination);
      entry.committed = true;
      onStep({ phase: 'committed', name: entry.name });
    }
  } catch (error) {
    const rollbackErrors = [];
    for (const entry of [...entries].reverse()) {
      try {
        if (entry.committed && pathExists(entry.destination)) removeEntry(entry.destination, entry.kind);
        if (entry.previousMoved && pathExists(entry.previous)) fs.renameSync(entry.previous, entry.destination);
      } catch (rollbackError) {
        rollbackErrors.push(`${entry.name}: ${rollbackError.message}`);
      }
    }
    cleanStaging();
    if (rollbackErrors.length) {
      const failure = new Error(`${error.message} Rollback also failed (${rollbackErrors.join('; ')}).`);
      failure.cause = error;
      throw failure;
    }
    throw error;
  }

  cleanStaging();
  // Publication is complete. Backup cleanup is best-effort: a cleanup failure must not report the
  // install as failed and prompt a retry after the new suite has already been made visible.
  for (const entry of entries) {
    try { removeEntry(entry.previous, entry.kind); } catch {}
  }
}

function copyDirectoryAtomically(source, destination) {
  installSuiteAtomically({
    directories: [{ name: path.basename(destination), source, destination }],
  });
}

function sourceSkillStatus(name) {
  const product = integrationProducts().find((entry) => skillName(entry) === name || entry.id === name);
  const source = product ? path.join(skillDirectory(product), 'SKILL.md') : '';
  if (!source) return { ready: false, detail: `missing product for ${name} skill` };
  if (!fs.existsSync(source)) return { ready: false, detail: `missing canonical ${name} skill` };
  const text = fs.readFileSync(source, 'utf8');
  if (/\[TODO|TODO:/.test(text)) return { ready: false, detail: `${name} still contains TODOs` };
  return { ready: true, source };
}

function install({ environment = process.env, home = os.homedir(), skipSmoke = false, onInstallStep = undefined } = {}) {
  const products = integrationProducts();
  for (const product of products) resolveServer(product.id);
  if (!skipSmoke) {
    // Load lazily so status and unit tests remain read-only and cheap.
    require('./mcp-smoke.cjs').smokeAll();
  }
  const locations = configPaths(environment, home);
  const existing = fs.existsSync(locations.configFile) ? fs.readFileSync(locations.configFile, 'utf8') : '';
  const updatedConfig = mergeManagedConfig(existing);
  const directories = products.map((product) => {
    const name = skillName(product);
    const status = sourceSkillStatus(name);
    if (!status.ready) throw new Error(status.detail);
    return {
      name,
      source: skillDirectory(product),
      destination: path.join(locations.skillsRoot, name),
    };
  });
  installSuiteAtomically({
    directories,
    file: { name: 'codex-config', destination: locations.configFile, content: updatedConfig },
    ...(onInstallStep ? { onStep: onInstallStep } : {}),
  });
  return status({ environment, home });
}

function status({ environment = process.env, home = os.homedir() } = {}) {
  const locations = configPaths(environment, home);
  const servers = {};
  for (const product of integrationProducts()) {
    const app = product.id;
    try {
      const resolved = resolveServer(app);
      servers[app] = { ready: true, entrypoint: resolved.command, args: resolved.args };
    } catch (error) {
      servers[app] = { ready: false, detail: error.message };
    }
  }
  const skills = {};
  for (const product of integrationProducts()) {
    const name = skillName(product);
    const source = path.join(skillDirectory(product), 'SKILL.md');
    const installed = path.join(locations.skillsRoot, name, 'SKILL.md');
    const validSource = sourceSkillStatus(name);
    skills[name] = {
      ready: validSource.ready && fs.existsSync(installed)
        && hashTree(path.dirname(source)) === hashTree(path.dirname(installed)),
      installed,
    };
  }
  const expectedBlock = managedConfigBlock();
  const config = fs.existsSync(locations.configFile) ? fs.readFileSync(locations.configFile, 'utf8') : '';
  return {
    ready: Object.values(servers).every((entry) => entry.ready)
      && Object.values(skills).every((entry) => entry.ready)
      && config.includes(expectedBlock),
    servers,
    skills,
    config: { ready: config.includes(expectedBlock), path: locations.configFile },
  };
}

function doctor({ statusResult = undefined, smokeAll = undefined, environment = process.env, home = os.homedir() } = {}) {
  const result = statusResult || status({ environment, home });
  const serversReady = Object.values(result.servers).every((entry) => entry.ready);
  let handshake = {
    ready: false,
    skipped: true,
    detail: 'Every declared MCP entrypoint must be present before the live handshake.',
  };
  if (serversReady) {
    try {
      const results = (smokeAll || require('./mcp-smoke.cjs').smokeAll)();
      handshake = { ready: true, skipped: false, results };
    } catch (error) {
      handshake = { ready: false, skipped: false, detail: error.message };
    }
  }
  return { ...result, handshake };
}

function doctorExitCode(result) {
  // Doctor is a read-only report: expected FIX findings should not turn the command itself into a
  // script failure. Only a live handshake that actually ran and failed signals a broken runtime.
  return result.handshake && !result.handshake.skipped && !result.handshake.ready ? 1 : 0;
}

function printStatus(result) {
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (require.main === module) {
  try {
    const command = process.argv[2] || 'status';
    if (command === 'install') printStatus(install());
    else if (command === 'status') printStatus(status());
    else if (command === 'doctor') {
      const result = doctor();
      printStatus(result);
      process.exitCode = doctorExitCode(result);
    }
    else if (command === 'print-config') process.stdout.write(`${managedConfigBlock()}\n`);
    else throw new Error(`Unknown AI setup command: ${command}`);
  } catch (error) {
    process.stderr.write(`Instrumenta AI setup failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  configPaths,
  copyDirectoryAtomically,
  doctor,
  doctorExitCode,
  install,
  installSuiteAtomically,
  managedConfigBlock,
  mergeManagedConfig,
  sourceSkillStatus,
  status,
  tomlString,
};
