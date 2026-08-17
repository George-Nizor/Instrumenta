'use strict';

const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_MAX_BYTES = 1024 * 1024;
const MAX_TEXT = 16 * 1024;

function boundedText(value) {
  const text = String(value ?? '');
  return text.length > MAX_TEXT ? `${text.slice(0, MAX_TEXT)}…` : text;
}

function diagnosticValue(value, depth = 0) {
  if (value instanceof Error) {
    return {
      name: boundedText(value.name),
      message: boundedText(value.message),
      stack: boundedText(value.stack || ''),
    };
  }
  if (depth > 3) return '[depth limit]';
  if (Array.isArray(value)) return value.slice(0, 32).map((item) => diagnosticValue(item, depth + 1));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).slice(0, 64)
      .map(([key, item]) => [boundedText(key), diagnosticValue(item, depth + 1)]));
  }
  if (typeof value === 'string') return boundedText(value);
  if (['number', 'boolean'].includes(typeof value) || value === null) return value;
  return boundedText(value);
}

function createDiagnostics(directory, options = {}) {
  const fileSystem = options.fileSystem || fs;
  const maxBytes = options.maxBytes || DEFAULT_MAX_BYTES;
  const now = options.now || (() => new Date());
  const file = path.join(directory, 'launcher.log');
  const previousFile = path.join(directory, 'launcher.previous.log');

  function rotateFor(bytes) {
    let size = 0;
    try { size = fileSystem.statSync(file).size; } catch { /* first record */ }
    if (size + bytes <= maxBytes) return;
    try { fileSystem.rmSync(previousFile, { force: true }); } catch { /* best effort */ }
    try { fileSystem.renameSync(file, previousFile); } catch { /* best effort */ }
  }

  function write(event, details = {}) {
    try {
      fileSystem.mkdirSync(directory, { recursive: true });
      const entry = {
        at: now().toISOString(),
        event: boundedText(event),
        details: diagnosticValue(details),
      };
      const line = `${JSON.stringify(entry)}\n`;
      rotateFor(Buffer.byteLength(line));
      fileSystem.appendFileSync(file, line, { encoding: 'utf8', mode: 0o600 });
    } catch {
      // Diagnostics must never become a new launcher failure.
    }
  }

  return { file, previousFile, write };
}

module.exports = { createDiagnostics, diagnosticValue };
