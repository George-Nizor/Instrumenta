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
directory, GitHub owner/repository/channel, adapter, package policy, and tile. Instrumenta continues
to read the existing schema-v1 product manifests while release-managed products use v2.

A schema-v2 `instrumenta/product.json` must contain:

- the catalog-matching ID, product name, semantic version, and `windows-x64` platform;
- a GitHub repository with a stable or prerelease channel;
- one of `managed-bundle`, `managed-web`, or `installed-desktop`;
- the `instrumenta-release.json` asset name;
- contained developer launch candidates;
- an installed-desktop version probe and uninstall contract when applicable.

## Release manifest and verification

Every product release attaches `instrumenta-release.json` with schema version 1, product ID,
semantic version, `windows-x64`, minimum compatible Instrumenta version, install strategy, exact
asset names, byte sizes, lowercase SHA-256 digests, and entry point. Asset names must be leaf names;
paths, control characters, links, and traversal are rejected.

Instrumenta downloads release metadata only from GitHub HTTPS endpoints, writes downloads to a
product-specific cache, resumes partial transfers with HTTP Range, checks free space before large
transfers, and validates both size and SHA-256 before execution or extraction. A failed or corrupt
asset is never promoted.

## Adapter behavior

### Managed bundle

Forge3D and future compact portable applications install under:

`%LOCALAPPDATA%\Instrumenta\products\<id>\versions\<version>`

Extraction occurs in a sibling staging directory. Symlinks and non-file/non-directory entries are
rejected. Only after the complete tree and declared entry point validate does Instrumenta rename the
staging directory and atomically update `current.json`. The pointer retains `previous` and marks the
new version pending. A successful process spawn confirms it; an initial launch failure rolls back to
the retained previous version.

### Managed web

`managed-web` is `managed-bundle` for a built web product: the same download, verification, staging,
atomic activation, and retained-previous-version machinery, with `index.html` as the entry point
instead of an executable. The installed bundle carries its own `instrumenta/product.json`, so launch
port and CSP profile are read from the bundle rather than duplicated in the catalog — though the CSP
profile itself must still exist launcher-side in `static-server.cjs`. Resolution order is managed
release, then the copy baked into the installer, then a local build, so giving a product a release
never strands an existing install. No catalog product uses this adapter yet.

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
holding one, which is what Fabula uses it for; Motus declares none. A malformed `arguments` value
makes the bundle invalid rather than being ignored.

The runtime check spawns `<executable> [arguments...] --instrumenta-launch-check <marker file>`.
The product must exit 0 and write `<NAME>_LAUNCH_OK <major.minor.patch>` into the marker, where
`<NAME>` is its own upper-case id (`MOTUS_LAUNCH_OK 0.4.1`, `FABULA_LAUNCH_OK 0.1.0`). A bundle on a
share is mirrored to local storage first, keyed by manifest version, executable size and time, entry
count, and the launch arguments, so re-pointing a bundle at another checkout refreshes the mirror.

Prepare runs the product's own `scripts/bootstrap-windows.ps1` on Windows. A product with a
`CMakeLists.txt` and no bootstrap script is built with CMake presets elsewhere.

## Update detection

`electron/update-check.cjs` computes `updateAvailable` for release-backed products by comparing the
installed version against the newest published release, semver precedence with prereleases included.
Results are cached on disk with a six-hour TTL; Refresh ignores the TTL. The check runs at startup,
on Refresh, and after any install or uninstall, and is never awaited on the render path. An
unreadable version on either side reports no update, and a failed check keeps the last known answer.

## Offline and interrupted operation

Installed products remain launchable without a network connection. Release lookup or download
failure reports a retryable failure without changing the active installed version. `.partial` files
are resumable. Incomplete extraction remains outside all active version paths and can be removed on
the next attempt.

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