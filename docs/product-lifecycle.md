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
entry names one, from its catalog entry. A `managed-service` product does the same with its service
launch contract. Schema v2 describes executables; a v2 manifest naming
`managed-web` is refused with that explanation.

The catalog decides how a product is delivered and the product's manifest says how it is built. A
`managed-web` catalog entry accepts a product manifest saying `web-vite` or `web-static`: it is read
as `managed-web`, with `builtAs` keeping the manifest's own word, which is what Prepare and
`workspace-manager` build from. Ludere and LearnChess are delivered this way without their
manifests changing. A `managed-bundle` entry likewise accepts a `native-bundle` manifest: Fabula's
release is installed like Dimensio's, and until one is, a workspace's checkout opens the native-bundle
way (its tile reports `adapter: native-bundle` and `deliveredAs: managed-bundle`, and still offers
the release). Fabula's release is a bootstrap that runs the editor from an engine it sets up in WSL;
none of that is the launcher's concern beyond the launch check the bootstrap answers.
A `managed-service` entry accepts a `web-service` manifest the same way: Discere's checkout keeps
saying `web-service`, and is read as `managed-service` with `builtAs: web-service`.

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

None of this blocks the launcher's main process. Each asset is streamed to its `.partial` file with
backpressure, and its SHA-256 is computed from the bytes as they are written (on a resume, from the
part already on disk, read once before the rest is requested); the file is renamed into place only
once its size on disk and its digest both match, and a complete file with the wrong digest is
deleted rather than resumed. Files already on disk are re-verified with asynchronous reads, Luna's
payload is assembled in one asynchronous pass that checks every chunk and the whole
(`assemblePayloadAsync`), and a managed bundle's extraction is moved into its version folder rather
than copied. Progress is reported at most four times a second and reaches the window on its own
`instrumenta:progress` event, which updates only the progress labels; it used to arrive as a full
state rebuild and redraw for every network chunk, which stalled both the window and the download.

## Adapter behavior

### Managed bundle

Dimensio, Fabula and future compact portable applications install under:

`<install location>\<id>\versions\<version>`

The install location is chosen in Add apps (**Install to**, `settings.json` `install.location`) and
defaults to `%LOCALAPPDATA%\Instrumenta\products`. It applies to new installs only, and to External
library apps chosen in the same window (their `library.location`). Nothing is moved: each product
records the root it was installed into (`products.<id>.installRoot`), every earlier location is kept
in `install.previousLocations`, and a product is looked for in its recorded root, the current
location, the default and then the earlier ones, so it keeps updating where it is
(`electron/install-location.cjs`). A location may not be the top of a drive, anything else under
`%LOCALAPPDATA%\Instrumenta`, the launcher's own folders, or the workspace. Luna, which has its own
installer, is offered `<install location>\Luna` (NSIS `/D=`) on a first install when a location
other than the default is chosen; its installer still shows its own folder page.

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
any installed product. Ludere and LearnChess are delivered this way; each publishes through
its own `release.yml`, which calls Instrumenta's shared `.github/workflows/web-product-release.yml`.

A pending managed-web version is confirmed by serving its first window, and rolled back when that
fails, whether the static server refuses the build or the page does not load. The static server is
kept per tool and per folder: an install, rollback or uninstall retires it (at once, or when the
window still showing the old build closes), and the next open starts a server on the new folder at
the same registered port, since the port is the origin its saved data belongs to. The decisions are
pure functions in `electron/lifecycle-policy.cjs`.

### Managed service

`managed-service` is `managed-web` for a product that is a server rather than a static build. It is
released and installed exactly like `managed-web` (a zip with `instrumenta-release.json`, verified
download, `<install root>\<id>\versions\<v>`, current and previous kept, automatic updates,
rollback, `skippedVersions`, uninstall) and launched exactly like `web-service`: the launcher starts
a child process, polls its health path, opens it in a product window with the product's session
partition, and stops the process tree when the window closes. Discere is delivered this way from
0.15.0 and Imago from 0.16.0. Imago's releases ask for 0.16.0, because 0.15 still removed
`<install root>\imago` at every start, left over from Imago's old static release. A release declares `minimumInstrumentaVersion` 0.15.0 or newer, and
`scripts/instrumenta-release.cjs` refuses anything older for this strategy.

The release zip extracts to a folder whose root holds:

- `package.json` with the product's `name` and `version`. It is the release manifest's
  `bundle.entry`, the file that marks the bundle root.
- `instrumenta/product.json`, schema 1, with `adapter: "web-service"` and a `service` launch block:
  `port`, `fallbackPort`, `health`, `command`, `cwd` and `env`. `build` and `versionSource` may be
  left out; the bundle is already built and its version is its `package.json`.
- whatever else the product needs (a runtime, the server, the web build, content). The launcher
  does not look at it.

In an installed bundle `command[0]` is a path relative to the version folder, with forward slashes,
naming an executable the bundle ships (Discere's is `runtime/node.exe`). It may not be absolute, a
drive or UNC path, contain a backslash, a colon, `.` or `..` or an empty segment, or resolve outside
the folder, and it has to be a file there. Every other element is an argument. In a checkout the
command still has to be the bare name of `node`, `npm`, `pnpm` or `corepack`. `cwd` stays inside the
folder, and `env` may not set `PORT`, `HOST`, `PATH`, `NODE_OPTIONS`, `LD_PRELOAD` or
`LD_LIBRARY_PATH`. The launcher sets `PORT` and `HOST` itself, as for any service.

The extracted folder is checked against these rules before it becomes a version, and a release
whose service cannot be started is refused at that point. The rules are checked again at every
launch (`serviceLaunchPlan` in `electron/service-process.cjs`). An installed service is spawned
natively from its version folder, never through the WSL bridge, and stopped with `taskkill /T /F`
on Windows like any service.

Resolution order is the installed release, then the source checkout run the `web-service` way (the
developer path, prepared with Prepare or `build all`). When a release is installed, its own
`instrumenta/product.json` is the definition the launcher starts, whatever the checkout beside it
says. A release that cannot start is reported on the tile ("cannot start", with the reason), and
the checkout is not used in its place; roll back or reinstall. With no release and no checkout the
tile offers Install, or says no release has been published yet.

A new managed-service version is pending until its service first answers its health check. If it
never does, the launcher rolls back to the previous version, skips the failed one, and says so in
the error ("could not start, so Instrumenta went back to ..."). An update that arrives while the
service is running is downloaded and verified, then activated once the window has closed and the
process tree has stopped. Uninstall is refused while the window is open, stops any service still
starting, and moves the install folder to the Recycle Bin. The product's data lives elsewhere
(Discere keeps it in `%LOCALAPPDATA%\Discere`) and is never touched.

A managed-service product is never baked into the installer.

The release workflow makes the manifest with:

```text
node .instrumenta/scripts/instrumenta-release.cjs --product discere --version <v> \
  --strategy managed-service --bundle .release/discere-<v>.zip \
  --service-root .release/discere-<v> --minimum 0.15.0 --out .release/instrumenta-release.json
```

`--service-root` is the folder the zip was made from. It is checked as the launcher will check the
extracted zip. The zip has to hold that folder's contents at its root, not the folder itself.

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

## The External library

Instrumenta also installs open-source apps that other people make, starting with storytold's
Crafting Apps. They are listed on their own page (External library, in the Library view's sidebar,
or the bookshelf button in the console header) and as their own group in Add apps, under their own
names with their makers' credit, licence and repository. They are never suite products: no catalog
entry, no brand glyph or accent, no tile art, no Content-Security-Policy profile or session
partition, no packaging. The code is `electron/external-sources.cjs` (finding releases) and
`electron/external-library.cjs` (installing, opening, locations); the page is
`electron/renderer/library.js`.

### Sources

A provider is described once, in `products/sources/<id>.json` (`storytold.json` today): the GitHub
owner, the display name and licence used in the credit, the name pattern of its Windows archive
(`{repo}-{version}-windows-x64-portable.zip`), its checksum file (`SHA256SUMS.txt`), where the
executable sits in the archive (`{repo}-{version}-windows-x64-portable/{repo}.exe`), and the curated
app list (ID, repository, display name, one line of description). An app whose releases went by an
older name lists both in `assetNames` (pdfcraft's were once `printcraft-*`). The file is validated
strictly before any request: owner and repository names must be GitHub names, patterns may hold only
file-name characters and the `{repo}` and `{version}` placeholders, the executable is a file name or
one folder and a file name, and app IDs are unique across every source. The suite catalog and its
validation are unaffected; `external-portable` is refused as a catalog adapter.

### Finding a release without the REST API

These releases carry no `instrumenta-release.json`, so one is written locally:

1. `github.com/<owner>/<repo>/releases/latest` (a HEAD) redirects to `/releases/tag/<tag>`; that is
   the tag. A repository with no release redirects to its release list instead, which reads as
   nothing published.
2. `releases/download/<tag>/SHA256SUMS.txt` is read and parsed as `sha256sum` writes it.
3. The Windows x64 portable archive is matched by pattern. No match, or two candidates and neither
   at the tag's version, is "no installable release" and is cached as such, never an error.
4. A HEAD of the archive, following GitHub's redirect to `release-assets.githubusercontent.com`,
   gives its size. Only when that answer has no Content-Length is the REST asset list asked.
5. The manifest (`installStrategy: managed-bundle`, `minimumInstrumentaVersion: 0.0.0`, entry the
   executable's file name) goes through `validateReleaseManifest` like a published one.

Results are cached in `%LOCALAPPDATA%\Instrumenta\update-cache\library\release-versions.json` by
`refreshReleaseVersions`, with the same six-hour TTL, one-minute Refresh floor and rate-limit hold as
the suite. It is a separate file so an app ID can never be read as a suite product's.

### Installing, updating and removing

Installing is `installLatestProduct`, unchanged: Range resume, the free-space check, GitHub HTTPS
hosts only, size and SHA-256 verified before extraction, staging, atomic activation, current plus
previous version kept, older ones pruned. The archive's single top-level folder is lifted out on
extraction, so a version folder holds the app's files directly, and the library drive is checked
for room for the unpacked files. Jobs share the launcher's install queue as `library:<id>`. The
update policy is the suite's: automatic updates follow the launcher's switch unless the app has its
own, a version rolled back from is skipped, an update to an app open from Instrumenta is downloaded
now and activated when it closes, and an app nobody installed is never installed.

Library apps install under:

`<library root>\<id>\versions\<version>\<id>.exe`, with `<library root>\<id>\current.json`

The library root is `%LOCALAPPDATA%\Instrumenta\library` unless changed on the page. Downloads go
to `%LOCALAPPDATA%\Instrumenta\downloads\library\<id>\<version>` and are deleted once installed.

**Changing the location applies to new installs only.** An installed app stays where it is and keeps
updating there; the page shows each app's own folder, and marks the ones outside the current
location. Nothing is moved, so nothing can be half-moved. To find every copy again, each installed
app's root is recorded in `settings.json` (`library.apps.<id>.root`), every location the library
has used is kept in `library.previousLocations`, and an app is looked for in its recorded root, the
current location, the default and then each earlier location. A location inside, or holding, one of
the launcher's own folders, a drive root, or a folder inside an installed app is refused, and the
folder must be writable.

Uninstalling moves `<library root>\<id>` to the Recycle Bin, or deletes it after confirmation on a
drive without one. Settings and files the app keeps for itself are not touched, and the dialog says
so.

### The weaker launch check

These executables do not answer `--instrumenta-launch-check`. A version pending its first launch
counts as working when its process is still running four seconds after it started; one that fails
to start, or exits with a non-zero code in that time, is rolled back to the previous version and
skipped. One that exits cleanly that fast is left pending. This catches a missing or broken
executable, not an app that starts and misbehaves later. Apps start detached, so closing Instrumenta
leaves them running. An app started outside Instrumenta is not seen as running.

### Discovery

The curated list is authoritative. With `discovery.enabled`, the owner's repository list is read
once per six hours (the only REST request in the normal path), and a repository that is not a fork,
not archived, under the source's licence and not already listed, added or dismissed, and whose latest
release has a matching archive, is shown under "New from <source>". Adding one is a click and is
kept in `library.added`; dismissing one is kept in `library.dismissed`. The discovery cache is
`update-cache\library\discovery.json`.

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
(`managed-bundle`, `managed-web`, `managed-service`, `installed-desktop`) by comparing the installed version against the
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