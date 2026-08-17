'use strict';

function normalizeVersion(value) {
  const match = String(value || '').trim().match(/^(\d+)\.(\d+)\.(\d+)(?:\.(\d+))?/);
  return match ? match.slice(1, 5).map((part) => Number(part || 0)) : null;
}

function sameReleaseVersion(expected, actual) {
  const left = normalizeVersion(expected);
  const right = normalizeVersion(actual);
  return Boolean(left && right && left.every((part, index) => part === right[index]));
}

function verifyInstalledCandidates(expectedVersion, candidates) {
  const existing = candidates.filter((candidate) => candidate && candidate.exists);
  const match = existing.find((candidate) => sameReleaseVersion(expectedVersion, candidate.version));
  if (match) return match;
  if (!existing.length) {
    throw new Error('The installer closed, but Instrumenta.exe was not found in either supported per-user install location.');
  }
  const found = existing.map((candidate) => `${candidate.version || 'unknown'} at ${candidate.path}`).join('; ');
  throw new Error(`The installer closed, but Instrumenta ${expectedVersion} is not installed. Found: ${found}`);
}

function main(argv) {
  const [expectedVersion, encodedCandidates] = argv;
  if (!expectedVersion || !encodedCandidates) {
    throw new Error('Usage: install-verification.cjs EXPECTED_VERSION BASE64_CANDIDATES');
  }
  const candidates = JSON.parse(Buffer.from(encodedCandidates, 'base64').toString('utf8'));
  const installed = verifyInstalledCandidates(expectedVersion, candidates);
  console.log(installed.path);
}

if (require.main === module) {
  try { main(process.argv.slice(2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}

module.exports = { normalizeVersion, sameReleaseVersion, verifyInstalledCandidates };
