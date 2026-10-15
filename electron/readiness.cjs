'use strict';

// Whether this computer has what each app needs, shown in the launcher's Readiness panel.
//
// The requirements come from each product's own README. Every suite app now runs natively on
// Windows: Fabula's assistant uses Claude Code or Codex there and transcribes fastest on an NVIDIA
// GPU; Imago needs Claude Code; Discere's tutor uses Claude Code; Dimensio's workshop drives Claude
// Code or Codex; Luna needs a CUDA-capable NVIDIA GPU. WSL is no longer needed by any of them. A
// check that cannot be run says "unknown" rather than guessing. Every command is fixed here and run
// without a shell, with a timeout, and nothing it prints is executed.

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const CHECKS = [
  { id: 'gpu', label: 'NVIDIA graphics' },
  { id: 'claude-windows', label: 'Claude Code on Windows' },
  { id: 'codex-windows', label: 'Codex on Windows' },
  { id: 'disk', label: 'Free space' },
];

// What each product needs: `all` must be ready; `any` needs one of; `soft` only degrades it.
const NEEDS = {
  fabula: { any: ['claude-windows', 'codex-windows'], soft: ['gpu'], summary: 'Claude Code or Codex for the assistant; an NVIDIA GPU for fast transcription' },
  imago: { all: ['claude-windows'], summary: 'Claude Code, signed in' },
  discere: { soft: ['claude-windows'], summary: 'Claude Code for its tutor' },
  luna: { all: ['gpu'], summary: 'A CUDA-capable NVIDIA GPU' },
  dimensio: { any: ['claude-windows', 'codex-windows'], summary: 'Claude Code or Codex for the workshop; Blender and Godot separately' },
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

// `run(command, args)` resolves { code, stdout }. Claude Code's native installer puts claude.exe in
// %USERPROFILE%\.local\bin, which a launcher started before the install may not have on its PATH.
async function checkAll({ run, platform = process.platform, freeBytes = null, exists = fs.existsSync, home = os.homedir() } = {}) {
  const windows = platform === 'win32';
  const [gpu, claudeWindows, codexWindows] = await Promise.all([
    attempt(run, 'nvidia-smi', ['--query-gpu=name,driver_version', '--format=csv,noheader']),
    windows ? attempt(run, 'where.exe', ['claude']) : Promise.resolve(null),
    windows ? attempt(run, 'where.exe', ['codex']) : Promise.resolve(null),
  ]);
  const results = {};

  results.gpu = gpu.ok && gpu.out
    ? { state: 'ok', detail: gpu.out.split('\n')[0].replace(',', ', driver') }
    : { state: 'missing', detail: 'No NVIDIA driver answered. Luna needs a CUDA-capable NVIDIA GPU; Fabula transcribes more slowly without one.' };

  const installed = path.win32.join(home, '.local', 'bin', 'claude.exe');
  results['claude-windows'] = !windows ? { state: 'unknown', detail: 'Only checked on Windows.' }
    : claudeWindows.ok ? { state: 'ok', detail: claudeWindows.out.split('\n')[0] }
      : exists(installed) ? { state: 'ok', detail: installed }
        : { state: 'missing', detail: 'Claude Code was not found. Install it with "irm https://claude.ai/install.ps1 | iex" in PowerShell, then run claude once to sign in.' };

  results['codex-windows'] = !windows ? { state: 'unknown', detail: 'Only checked on Windows.' }
    : codexWindows.ok ? { state: 'ok', detail: codexWindows.out.split('\n')[0] }
      : { state: 'missing', detail: 'Codex was not found on the Windows PATH. Install it with npm install -g @openai/codex.' };

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
