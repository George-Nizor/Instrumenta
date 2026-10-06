'use strict';

// Whether this computer has what each app needs, shown in the launcher's Readiness panel.
//
// The requirements come from each product's own README: Fabula and Discere run their engines in
// WSL and use Claude Code or Codex there; Luna needs a CUDA-capable NVIDIA GPU; Forge3D drives a
// Codex App Server on Windows. The other apps need nothing beyond the launcher. A check that cannot
// be run says "unknown" rather than guessing. Every command is fixed here and run without a shell
// on the Windows side, with a timeout, and nothing it prints is executed.

const CHECKS = [
  { id: 'wsl', label: 'Windows Subsystem for Linux' },
  { id: 'gpu', label: 'NVIDIA graphics' },
  { id: 'claude', label: 'Claude Code in WSL' },
  { id: 'codex', label: 'Codex CLI in WSL' },
  { id: 'codex-windows', label: 'Codex on Windows' },
  { id: 'disk', label: 'Free space' },
];

// What each product needs: `all` must be ready; `any` needs one of; `soft` only degrades it.
const NEEDS = {
  fabula: { all: ['wsl'], any: ['claude', 'codex'], summary: 'WSL, with Claude Code or Codex for the assistant' },
  discere: { all: ['wsl'], soft: ['codex'], summary: 'WSL; the Codex CLI for its tutor and drawings' },
  luna: { all: ['gpu'], summary: 'A CUDA-capable NVIDIA GPU' },
  forge3d: { all: ['codex-windows'], summary: 'The Codex App Server on Windows; Blender and Godot separately' },
};

const GB = 1024 ** 3;

async function attempt(run, command, args) {
  try {
    const result = await run(command, args);
    return { ok: result.code === 0, out: String(result.stdout || '').replace(/\u0000/g, '').trim() };
  } catch {
    return { ok: false, out: '', failed: true };
  }
}

// `run(command, args)` resolves { code, stdout }. On Windows WSL tools are reached through wsl.exe
// with a login shell, so a Node installed by nvm is on the PATH the way it is in a terminal.
async function checkAll({ run, platform = process.platform, freeBytes = null } = {}) {
  const windows = platform === 'win32';
  const inLinux = (script) => (windows ? ['wsl.exe', ['-e', 'bash', '-lc', script]] : ['bash', ['-lc', script]]);
  const results = {};

  const wsl = await attempt(run, ...inLinux('. /etc/os-release 2>/dev/null; echo "${PRETTY_NAME:-Linux}"'));
  results.wsl = wsl.ok
    ? { state: 'ok', detail: windows ? wsl.out.split('\n').pop() : 'Running inside Linux already' }
    : { state: 'missing', detail: 'Install it with "wsl --install" in an administrator terminal, then restart.' };

  const gpu = await attempt(run, 'nvidia-smi', ['--query-gpu=name,driver_version', '--format=csv,noheader']);
  results.gpu = gpu.ok && gpu.out
    ? { state: 'ok', detail: gpu.out.split('\n')[0].replace(',', ', driver') }
    : { state: 'missing', detail: 'No NVIDIA driver answered. Luna needs a CUDA-capable NVIDIA GPU.' };

  for (const [id, command, how] of [['claude', 'claude', 'npm install -g @anthropic-ai/claude-code'], ['codex', 'codex', 'npm install -g @openai/codex']]) {
    if (!wsl.ok) { results[id] = { state: 'unknown', detail: 'Needs WSL first.' }; continue; }
    const tool = await attempt(run, ...inLinux(`${command} --version`));
    results[id] = tool.ok && tool.out
      ? { state: 'ok', detail: tool.out.split('\n')[0] }
      : { state: 'missing', detail: `Not found in WSL. Install it there with ${how}.` };
  }

  if (windows) {
    const codex = await attempt(run, 'where.exe', ['codex']);
    results['codex-windows'] = codex.ok
      ? { state: 'ok', detail: codex.out.split('\n')[0] }
      : { state: 'missing', detail: 'Codex was not found on the Windows PATH. Forge3D needs its App Server.' };
  } else {
    results['codex-windows'] = { state: 'unknown', detail: 'Only checked on Windows.' };
  }

  results.disk = freeBytes === null || !Number.isFinite(freeBytes)
    ? { state: 'unknown', detail: 'Could not read the drive.' }
    : { state: freeBytes >= 20 * GB ? 'ok' : freeBytes >= 5 * GB ? 'warn' : 'missing', detail: `${(freeBytes / GB).toFixed(0)} GB free where apps install. Luna alone needs about 15 GB.` };

  return CHECKS.map((check) => ({ ...check, ...results[check.id] }));
}

function productReadiness(products, checks) {
  const state = (id) => checks.find((check) => check.id === id)?.state || 'unknown';
  return products.map((product) => {
    const needs = NEEDS[product.id];
    if (!needs) return { id: product.id, name: product.displayName || product.id, state: 'ok', summary: 'Nothing beyond Instrumenta.' };
    const all = (needs.all || []).map(state);
    const any = needs.any ? needs.any.map(state) : ['ok'];
    const soft = (needs.soft || []).map(state);
    let result = 'ok';
    if (all.includes('missing') || !any.includes('ok') && any.every((s) => s === 'missing')) result = 'missing';
    else if (all.includes('unknown') || !any.includes('ok') || soft.some((s) => s !== 'ok')) result = all.includes('unknown') ? 'unknown' : 'warn';
    return { id: product.id, name: product.displayName || product.id, state: result, summary: needs.summary };
  });
}

module.exports = { CHECKS, NEEDS, checkAll, productReadiness };
