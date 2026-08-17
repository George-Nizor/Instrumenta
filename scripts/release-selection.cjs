'use strict';

function compareCandidates(left, right) {
  if (left.version !== right.version) {
    const leftParts = String(left.version).split('.').map(Number);
    const rightParts = String(right.version).split('.').map(Number);
    const length = Math.max(leftParts.length, rightParts.length);
    for (let index = 0; index < length; index += 1) {
      const difference = (leftParts[index] || 0) - (rightParts[index] || 0);
      if (difference) return difference;
    }
  }
  return Number(left.builtAt || 0) - Number(right.builtAt || 0);
}

function newestCandidate(candidates) {
  return candidates.filter(Boolean).reduce(
    (best, candidate) => (!best || compareCandidates(candidate, best) > 0 ? candidate : best),
    null,
  );
}

if (require.main === module) {
  try {
    if (process.argv[2] !== 'select-base64' || !process.argv[3]) throw new Error('Usage: release-selection.cjs select-base64 DATA');
    const json = Buffer.from(process.argv[3], 'base64').toString('utf8');
    const candidate = newestCandidate(JSON.parse(json));
    if (!candidate || !candidate.kind) throw new Error('No release candidate was supplied.');
    process.stdout.write(candidate.kind);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { compareCandidates, newestCandidate };
