# Product lifecycle architecture

## Ownership and boundaries

Instrumenta is the installation, version, launch, and health gateway for independently owned
applications. Each product remains its own repository, release stream, executable, user-data
contract, and test suite. A sibling checkout is an explicit developer override, never the normal
end-user distribution mechanism.

The catalog supplies stable suite metadata. A product manifest supplies the product-owned adapter
contract. A release manifest describes one immutable Windows artifact set. None of these files gives
Instrumenta authority to manipulate product branches or commits.

## Catalog and product manifests

`products/catalog.json` schema v2 records the stable product ID, display name, sibling source
directory, GitHub owner/repository/channel, adapter, package policy, and tile. Its order is the order
the launcher lists products in. Instrumenta continues to read the existing schema-v1 product
manifests while release-managed executables use v2.

A schema-v2 `instrumenta/product.json` must contain:

- the catalog-matching ID, product name, semantic version, and `windows-x64` platform;
- a GitHub repository with a stable or prerelease channel;
- `managed-bundle` or `installed-desktop`;
- the `instrumenta-release.json` asset name;
- contained developer launch candidates;
- an installed-desktop version probe and uninstall contract when applicable.

A `managed-web` product is a web build, so it keeps a schema-v1 manifest with its web launch
contract (port, CSP profile) and takes its release repository, and `releaseManifestAsset` if the
entry names one, from its catalog entry. Schema v2 describes executables; a v2 manifest naming
`managed-web` is refused with that explanation.

The catalog decides how a product is delivered and the product's manifest says how it is built. A
`managed-web` catalog entry accepts a product manifest saying `web-vite` or `web-static`: it is read
as `managed-web`, with `builtAs` keeping the manifest's own word, which is what Prepare and
`workspace-manager` build from. Imago, Ludere and LearnChess are delivered this way without their
manifests changing. A `managed-bundle` entry likewise accepts a `native-bundle` manifest: Fabula's
release is installed like Forge3D's, and until one is, a workspace's checkout opens the native-bundle
way (its tile reports `adapter: native-bundle` and `deliveredAs: managed-bundle`, and still offers
the release). Fabula's release is a bootstrap that runs the editor from an engine it sets up in WSL;
none of that is the launcher's concern beyond the launch check the bootstrap answers.

One registry serves the tiles, installing and update polling alike (`loadRegistry` and
`productDefinitions` in `electron/workspace.cjs`). A release-backed product with no checkout, the
normal case on an end user's machine, is defined from its catalog entry alone, so it can be
installed and polled without a workspace.

## Release manifest and verification

Every release — each product's, and Instrumenta's own — attaches `instrumenta-release.json`, written
by `scripts/instrumenta-release.cjs` from the files it describes and checked there with the same
`validateReleaseManifest` the launcher installs through. It has schema version 1, product ID,
semantic version, `windows-x64`, minimum compatible Instrumenta version, install strategy, exact
asset names, byte sizes, lowercase SHA-256 digests, and entry point. Asset names must be leaf names;
paths, control characters, links, and traversal are rejected. A release whose minimum Instrumenta
version is newer than the running launcher is never offered and is refused before any download.

The newest stable release is read from
`github.com/<owner>/<repo>/releases/latest/download/instrumenta-release.json`. GitHub redirects that
to `/releases/download/<tag>/…`, which gives the manifest and the tag in one request that does not
count against the REST API's hourly allowance; the tag falls back to `v<version>` if no redirect
shows it. A 404 is "no release published yet". A 403 or 429 with `x-ratelimit-reset` or
`retry-after` blocks further checks until then. The REST API is used for the prerelease channel (the
newest non-draft release, prerelease or not) and as the fallback when the download route fails for
another reason.

Instrumenta downloads only from GitHub HTTPS hosts, to
`%LOCALAPPDATA%\Instrumenta\downloads\<id>\<version>`, from
`github.com/<owner>/<repo>/releases/download/<tag>/<asset>`. It resumes partial transfers with HTTP
Range, checks free space for what is still to be written, and validates both size and SHA-256 before
execution or extraction. A failed or corrupt asset is never promoted. The download folder is deleted
once its version is active or its installer has exited 0, and kept after a failure so the retry
resumes. Installs run one at a time (`electron/install-queue.cjs`); asking again for one already
queued joins it rather than starting a second.

## Adapter behavior

### Managed bundle

Forge3D and future compact portable applications install under:

`%LOCALAPPDATA%\Instrumenta\products\<id>\versions\<version>`

Extraction occurs in a sibling staging directory. Symlinks and non-file/non-directory entries are
rejected. Only after the complete tree and declared entry point validate does Instrumenta rename the
staging directory and atomically update `current.json`. The pointer retains `previous` and marks the
new version pending. A successful process spawn confirms it; an initial launch failure rolls back to
the retained previous version, and that version is added to `skippedVersions` so it is not offered
again automatically.

Installing a version whose folder is already there and valid (typically one rolled back from)
points at it instead of copying it again; a folder of that name that is not a valid install is moved
aside and replaced. After each install, versions other than the current and previous are pruned. A
folder is renamed aside before it is deleted, so one still in use fails the rename and is left whole
for the next prune. Roll back on the tile swaps current and previous at any time, not only while the
new version is pending.

### Managed web

`managed-web` is `managed-bundle` for a built web product: the same download, verification, staging,
atomic activation, and retained-previous-version machinery, with `index.html` as the entry point
instead of an executable. The installed bundle carries its own `instrumenta/product.json`, so launch
port and CSP profile are read from the bundle rather than duplicated in the catalog — though the CSP
profile itself must still exist launcher-side in `static-server.cjs`. Resolution order is managed
release, then the copy baked into the installer, then a local build, so giving a product a release
never strands an existing install. A baked copy carries the version it was built at (a minimal
`package.json` beside it) and counts as installed at that version, so a newer release updates it like
any installed product. Imago, Ludere and LearnChess are delivered this way; each publishes through
its own `release.yml`, which calls Instrumenta's shared `.github/workflows/web-product-release.yml`.

A pending managed-web version is confirmed by serving its first window, and rolled back when that
fails, whether the static server refuses the build or the page does not load. The static server is
kept per tool and per folder: an install, rollback or uninstall retires it (at once, or when the
window still showing the old build closes), and the next open starts a server on the new folder at
the same registered port, since the port is the origin its saved data belongs to. The decisions are
pure functions in `electron/lifecycle-policy.cjs`.

### Installed desktop

Luna remains independently installed because its offline payload is much larger than Instrumenta.
Instrumenta downloads the lightweight installer and numbered payload chunks, verifies every chunk,
assembles and verifies the complete payload, invokes the installer, then confirms the Windows
uninstall record and executable. Uninstall delegates to the registered product uninstaller.

### Existing adapters

Web/static/service adapters keep their preparation and health contracts while reporting the shared
lifecycle states. `native-bundle` is generic portable-application discovery and launch behavior; new
product-specific conditionals should not be added to the launcher.

A native bundle is a deployed folder under the checkout's `dist/windows` (or `prebuilt/windows`)
carrying `<id>-bundle.json`:

```json
{ "schemaVersion": 1, "id": "fabula", "version": "0.1.0", "executable": "electron.exe",
  "arguments": ["\\\\wsl.localhost\\Ubuntu\\...\\Fabula"] }
```

`executable` must be a leaf name beside the manifest. `arguments` is optional; when present it is a
list of non-empty strings passed to the executable on every launch and on the runtime check, ahead
of the check flag. An Electron runtime is only an application once it is handed the directory
holding one, which is what Fabula uses it for. A malformed `arguments` value makes the bundle invalid
rather than being ignored.

The runtime check spawns `<executable> [arguments...] --instrumenta-launch-check <marker file>`.
The product must exit 0 and write `<NAME>_LAUNCH_OK <major.minor.patch>` into the marker, where
`<NAME>` is its own upper-case id (`FABULA_LAUNCH_OK 0.1.0`). A bundle on a share is mirrored to local
storage first, keyed by manifest version, executable size and time, entry count, and the launch
arguments, so re-pointing a bundle at another checkout refreshes the mirror.

Prepare runs the product's own `scripts/bootstrap-windows.ps1`, which is Windows PowerShell, so a
native product is prepared on Windows only. The CMake path went with Motus.

## The launcher itself

Instrumenta updates itself through the same route (`electron/self-update.cjs`). The catalog's
top-level `launcher` block names its repository; its releases carry the NSIS setup program and an
`instrumenta-release.json` with `installStrategy: "launcher"` (an installer and nothing beside it,
product `instrumenta` only; no product install path accepts it). The check shares the products'
version cache, TTL and rate-limit hold. With automatic updates on, a newer version is downloaded to
`%LOCALAPPDATA%\Instrumenta\downloads\instrumenta\<version>` and verified; the header then offers
Restart to update, and quitting installs it anyway. The setup program starts detached once the
launcher has finished closing (the `quit` event, after services are shut down), with `/S --updated`,
plus `--force-run` for Restart. Only an installed launcher updates itself: the portable build opens
the release page, and a source run shows that a release exists and nothing more. Downloads of the
running version or older are removed at start-up.

`.github/workflows/release.yml` builds and publishes it on a `v<version>` tag.

## Update detection

`electron/update-check.cjs` computes `updateAvailable` for every release-backed adapter
(`managed-bundle`, `managed-web`, `installed-desktop`) by comparing the installed version against the
newest published release, semver precedence with prereleases included. Results are cached on disk,
schema 2 (version, tag, manifest, `checkedAt`, `blockedUntil`; a schema-1 cache is still read), with
a six-hour TTL. Refresh ignores the TTL but asks at most once a minute per product, and nothing is
asked before a rate limit's `blockedUntil`. The check runs at startup, every six hours, on Refresh,
and after any install or uninstall, and is never awaited on the render path. An unreadable version
on either side reports no update, and a failed check keeps the last known answer.

`electron/update-policy.cjs` then decides, per installed product: install the update, download it
now and activate it once the product is closed, offer it on the tile, or leave it alone. Automatic
updates are on by default and can be turned off globally or per product; a version rolled back from
is skipped until installed on purpose; a product nobody installed is never installed
automatically.

## Offline and interrupted operation

Installed products remain launchable without a network connection. Release lookup or download
failure reports a retryable failure without changing the active installed version. `.partial` files
are resumable, verified downloads are reused, and an assembled payload that still verifies is used
again rather than refused. Incomplete extraction remains outside all active version paths and is
removed on the next attempt.

## Onboarding checklist

1. Assign a permanent lowercase product ID and independent GitHub repository.
2. Add and validate schema-v2 product and release manifests.
3. Choose managed-bundle only for a self-contained portable tree; otherwise choose installed-desktop.
4. Document executable, user-data, output, version-probe, and uninstall identities.
5. Add catalog art and renderer states without hard-coding product behavior.
6. Test hash rejection, interrupted download, insufficient space, offline launch, path containment,
   failed first launch, rollback, update, and uninstall.
7. Publish only after secret, generated-file, dependency-license, and redistribution audits.

## Source Git stays separate

Release installation and source synchronization solve different problems. Normal users receive
signed/versioned artifacts; developers intentionally choose and update sibling checkouts with Git.
Adding branch, commit, merge, or conflict behavior to Instrumenta would blur authorization, risk
uncommitted work, and turn a deterministic release gateway into an incomplete Git client. It is
therefore explicitly out of scope.