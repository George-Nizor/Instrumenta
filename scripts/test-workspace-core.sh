#!/usr/bin/env bash
# Compiler-only verification for Linux and macOS checkouts: Motus's C++ core and
# the JavaScript that keeps its Windows bundle portable. Neither needs Qt, CMake,
# or Ninja. The launcher itself is Electron and is covered by `npm test`.
set -euo pipefail

launcher_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
workspace_dir="$(cd "$launcher_dir/.." && pwd)"
motus_dir="$workspace_dir/Motus"

mkdir -p "$motus_dir/build/manual"

motus_sources=("$motus_dir"/src/*.cpp)
motus_tests=()
for test_source in "$motus_dir"/tests/*.cpp; do
  # The real-codec smoke test is a separate Qt/CMake target. This portable gate
  # deliberately proves the dependency-free core on systems without Qt.
  [[ "$(basename "$test_source")" == "native_media_smoke.cpp" ]] && continue
  motus_tests+=("$test_source")
done
c++ -std=c++20 -O0 -g -pthread -Wall -Wextra -Wpedantic -Wconversion -Wshadow -Werror \
  -I"$motus_dir/include" -I"$motus_dir/tests" \
  "${motus_sources[@]}" "${motus_tests[@]}" \
  -o "$motus_dir/build/manual/motus_core_tests"
"$motus_dir/build/manual/motus_core_tests"

node --test "$motus_dir/tests/bundle_runtime_tests.cjs"

echo "Instrumenta workspace core verification passed."
