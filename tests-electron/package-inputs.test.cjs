const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const launcherRoot = path.resolve(__dirname, '..');
const workspaceRoot = path.resolve(launcherRoot, '..');

test('the package mirror includes Imago build-time script inputs', () => {
  const inputs = JSON.parse(fs.readFileSync(path.join(launcherRoot, 'scripts', 'package-inputs.json'), 'utf8'));
  const imagoPackage = JSON.parse(fs.readFileSync(path.join(workspaceRoot, 'Imago', 'package.json'), 'utf8'));
  assert.ok(inputs.imago.includes('scripts'), 'Imago scripts must be copied into the Windows-local package workspace');
  for (const command of Object.values(imagoPackage.scripts || {})) {
    for (const match of command.matchAll(/(?:^|\s)(scripts[\\/][^\s;&|]+)/g)) {
      const referenced = match[1].replace(/['"]/g, '');
      assert.ok(inputs.imago.includes('scripts'));
      assert.ok(fs.existsSync(path.join(workspaceRoot, 'Imago', referenced)), `missing Imago build input: ${referenced}`);
    }
  }
});

test('a per-product input list is actually read by the packager', () => {
  const orchestrator = fs.readFileSync(path.join(launcherRoot, 'scripts', 'instrumenta.ps1'), 'utf8');
  // Writing a per-product key and never reading it is worse than not having one.
  assert.match(orchestrator, /\$InputNames = @\(\$PackageInputs\.PSObject\.Properties\.Name\)/);
  assert.match(orchestrator, /\$InputNames -contains \$Entry\.id/);
});

test('every web product the installer bakes in has build inputs, whatever its adapter', () => {
  const inputs = JSON.parse(fs.readFileSync(path.join(launcherRoot, 'scripts', 'package-inputs.json'), 'utf8'));
  const orchestrator = fs.readFileSync(path.join(launcherRoot, 'scripts', 'instrumenta.ps1'), 'utf8');
  // Copying sources only for web-vite and web-static left a product moving onto managed-web with
  // nothing to build from.
  assert.match(orchestrator, /\$Entry\.adapter -in @\('web-vite', 'web-static', 'managed-web'\)/);
  const catalog = JSON.parse(fs.readFileSync(path.join(launcherRoot, 'products', 'catalog.json'), 'utf8'));
  const baked = catalog.products.filter((entry) => ['web-vite', 'web-static', 'managed-web'].includes(entry.adapter));
  assert.ok(baked.length >= 3);
  for (const entry of baked) {
    assert.ok(Array.isArray(inputs[entry.id] || inputs[entry.adapter]), `${entry.id} has no package inputs`);
  }
});

test('LearnChess ships every input its build actually reads', () => {
  const inputs = JSON.parse(fs.readFileSync(path.join(launcherRoot, 'scripts', 'package-inputs.json'), 'utf8'));
  const root = path.join(workspaceRoot, 'LearnChess');
  // `tsc -b` builds both referenced projects, so their include lists are build inputs too.
  const references = JSON.parse(fs.readFileSync(path.join(root, 'tsconfig.json'), 'utf8')).references;
  for (const reference of references) {
    const file = reference.path.replace(/^\.\//, '');
    assert.ok(inputs.learnchess.includes(file), `missing LearnChess build input: ${file}`);
    const project = JSON.parse(
      fs.readFileSync(path.join(root, file), 'utf8').replace(/^\uFEFF/, ''),
    );
    for (const pattern of project.include || []) {
      const top = pattern.split(/[\\/]/)[0];
      if (!fs.existsSync(path.join(root, top))) continue;
      assert.ok(inputs.learnchess.includes(top), `missing LearnChess build input: ${top}`);
    }
  }
});

test('the package mirror includes Ludere MCP modules used by its tests', () => {
  const inputs = JSON.parse(fs.readFileSync(path.join(launcherRoot, 'scripts', 'package-inputs.json'), 'utf8'));
  assert.ok(inputs.ludere.includes('tests') && inputs.ludere.includes('mcp'), 'Ludere MCP must accompany MCP protocol tests in the package mirror');
  assert.ok(fs.existsSync(path.join(workspaceRoot, 'Ludere', 'mcp', 'index.mjs')));
});
test('the package mirror resolves sourceDirectory the way the registry does', () => {
  const orchestrator = fs.readFileSync(path.join(launcherRoot, 'scripts', 'instrumenta.ps1'), 'utf8');
  // `sourceDirectory` is relative to the launcher root. Resolving it against the workspace parent
  // counts the leading `..` twice, every product lands one level too high, nothing is copied, and
  // packaging cheerfully produces an installer containing no applications at all.
  assert.match(orchestrator, /\$SourceRoot = \[IO\.Path\]::GetFullPath\(\(Join-Path \$LauncherRoot \$Entry\.sourceDirectory\)\)/);
  assert.doesNotMatch(orchestrator, /Join-Path \$WorkspaceParent \$Entry\.sourceDirectory/);

  // And the same resolution, run here, must find every product the catalog names.
  const catalog = JSON.parse(fs.readFileSync(path.join(launcherRoot, 'products', 'catalog.json'), 'utf8'));
  for (const entry of catalog.products) {
    const sourceRoot = path.resolve(launcherRoot, entry.sourceDirectory);
    assert.ok(
      fs.existsSync(path.join(sourceRoot, 'instrumenta', 'product.json')),
      `${entry.id}: no manifest at ${sourceRoot}`,
    );
  }
});

test('packaging refuses a catalog product it could not validate', () => {
  const packager = fs.readFileSync(path.join(launcherRoot, 'scripts', 'package-windows.cjs'), 'utf8');
  // The launcher reads the catalog leniently; the packager must not inherit that tolerance and
  // ship an installer with an application quietly absent from it.
  assert.match(packager, /registry\.missing\.filter\(\(entry\) => entry\.reason\)/);
  assert.match(packager, /Cannot package while a catalog product is invalid/);
});
