#!/usr/bin/env bash
# Compiler-free verification for Linux and macOS checkouts. This used to build Motus's
# C++ core; Motus is discontinued and nothing left in the suite has a compiled core, so
# it runs the launcher's own tests, which need nothing beyond Node.js. `./instrumenta.sh
# test-core` still calls it by this name.
set -euo pipefail

launcher_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "$launcher_dir"
node --test tests-electron/*.test.cjs

echo "Instrumenta workspace core verification passed."
