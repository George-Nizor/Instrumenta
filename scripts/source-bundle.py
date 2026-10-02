"""Create corresponding-source archives from the files used by a product build."""
from __future__ import annotations
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import tempfile
from urllib.request import urlopen
import zipfile


def build(roots: list[tuple[str, Path]], output: Path, configs: list[Path], cache: Path) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    cache.mkdir(parents=True, exist_ok=True)
    provenance = []
    with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
        for name, root in roots:
            root = root.resolve(strict=True)
            result = subprocess.run(["git", "-C", str(root), "ls-files", "-z"], capture_output=True, check=True)
            candidates = {root / item.decode("utf-8") for item in result.stdout.split(b"\0") if item}
            if (root / "public").is_dir():
                candidates.update(p for p in (root / "public").rglob("*") if p.is_file())
            commit = subprocess.check_output(["git", "-C", str(root), "rev-parse", "HEAD"], text=True).strip()
            for file in sorted(candidates):
                if not file.is_file():
                    continue
                if file.is_symlink() or not file.resolve().is_relative_to(root):
                    raise ValueError(f"Invalid source path: {file.name}")
                archive.write(file, name + "/" + file.relative_to(root).as_posix())
            provenance.append({"product": name, "commit": commit, "files": len(candidates)})
        dependencies = []
        for config in configs:
            for item in json.loads(config.read_text(encoding="utf-8")):
                file = cache / item["asset"]
                if file.name != item["asset"] or not item["url"].startswith("https://"):
                    raise ValueError("Invalid dependency source entry")
                if not file.exists():
                    with urlopen(item["url"], timeout=120) as response:
                        file.write_bytes(response.read())
                if hashlib.sha256(file.read_bytes()).hexdigest() != item["sha256"]:
                    raise ValueError(f"Source archive checksum mismatch: {file.name}")
                archive.write(file, "dependency-sources/" + file.name)
                dependencies.append(item)
        archive.writestr("source-provenance.json", json.dumps({"products": provenance, "dependencies": dependencies}, indent=2) + "\n")
        archive.writestr("README.txt", """Corresponding source for the accompanying Instrumenta or product release.
The product folders contain the matching application source, package lockfiles,
build scripts, licence notices and the exact public assets used for this build.
Dependency archives contain their preferred source form and upstream build files.

Web apps: use Node.js 22.12 or later, run npm ci (if a lockfile is present), then
npm run build in the product directory. Existing public assets need not be fetched
again. LearnChess scripts/vendor-engine.ts identifies the locked Stockfish worker;
its source archive includes C++, Makefile, Emscripten scripts and NNUE networks.
The Chessground archive includes TypeScript sources and its build configuration.
IMG.LY background-removal includes its monorepo, pnpm lockfile and build scripts.
Follow each upstream archive's README to modify/rebuild those dependencies.
Instrumenta Windows packaging: see scripts/instrumenta.ps1 and docs/.
Licence terms remain those recorded for each component. No additional restrictions
are imposed on copying, modifying, rebuilding or debugging the covered components.
""")
    print(f"Created {output.name}: {output.stat().st_size} bytes")


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--root", type=Path, required=True)
    p.add_argument("--name", required=True)
    p.add_argument("--include", nargs=2, action="append", default=[])
    p.add_argument("--out", type=Path, required=True)
    p.add_argument("--dependencies", type=Path, action="append", default=[])
    p.add_argument("--cache", type=Path)
    args = p.parse_args()
    with tempfile.TemporaryDirectory(prefix="instrumenta-sources-") as temporary:
        build([(args.name, args.root)] + [(n, Path(r)) for n, r in args.include], args.out, args.dependencies, args.cache or Path(temporary))
