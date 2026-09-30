// What the launcher window decides from a state object: the verb on each product's button, the
// flag in the rail, and the rows of the app chooser. Pure, so it runs in the page as
// `window.InstrumentaModel` and in the Node tests as a module; renderer.js only draws the answers.
(function expose(root, factory) {
  const model = factory();
  if (typeof module === 'object' && module.exports) module.exports = model;
  else root.InstrumentaModel = model;
}(typeof self !== 'undefined' ? self : this, () => {
  function jobFor(state, id) {
    return (Array.isArray(state?.queue) ? state.queue : []).find((job) => job.id === id) || null;
  }

  function percent(progress) {
    if (!progress || !progress.total) return null;
    return Math.min(100, Math.floor((progress.received / progress.total) * 100));
  }

  // How an install job reads on a button or in a list: where it is, and how far along.
  function jobLabel(job) {
    if (!job) return '';
    if (job.state === 'queued') return 'Queued';
    const done = percent(job.progress);
    if (done === null) return job.kind === 'download' ? 'Downloading…' : 'Installing…';
    return done >= 100 && job.kind === 'install' ? 'Installing…' : `Downloading ${done}%`;
  }

  // One verb per state, chosen once and reused for the button, its label and the keyboard
  // path, so the tile can never offer an action the handler will not run. An install in the
  // queue owns the button until it finishes; a background download of an update does not,
  // because the product is open and in use while it runs.
  function primaryAction(product, job = null) {
    if (!product) return null;
    if (job && job.kind === 'install') return 'busy';
    if (product.ready && product.updateAvailable && product.canInstall) return 'update';
    if (product.ready) return 'open';
    if (product.canInstall) return 'install';
    if (product.canPrepare) return 'prepare';
    if (product.releasePublished === false && product.lifecycle !== 'developer-only') return 'unreleased';
    return 'locate';
  }

  // The rail flags only what needs a decision or is under way. A ready, current product says
  // nothing at all; that absence is the signal.
  function railFlag(product, job = null) {
    if (job) return { text: job.state === 'queued' ? 'Queued' : `${percent(job.progress) ?? 0}%`, dot: false };
    if (product.updateAvailable && product.canInstall) return { text: 'Update', dot: false };
    if (!product.ready && product.canInstall) return { text: 'Install', dot: false };
    if (!product.ready) return { text: '', dot: true };
    return { text: '', dot: false };
  }

  function formatBytes(bytes) {
    if (!Number.isFinite(bytes) || bytes <= 0) return '';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let value = bytes;
    let unit = 0;
    while (value >= 1000 && unit < units.length - 1) {
      value /= 1000;
      unit += 1;
    }
    return `${value >= 100 || unit === 0 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`;
  }

  function releaseBacked(product) {
    return ['managed-bundle', 'managed-web', 'installed-desktop'].includes(product.adapter);
  }

  function autoUpdateFor(state, id) {
    const own = state?.preferences?.products?.[id]?.autoUpdate;
    return typeof own === 'boolean' ? own : state?.preferences?.autoUpdate !== false;
  }

  function statusFor(product, job) {
    if (job) return jobLabel(job);
    if (product.lifecycle === 'developer-only') return 'Developer only: runs from a source checkout';
    if (product.installedVersion) {
      return product.updateAvailable ? `Installed ${product.installedVersion}, ${product.latestVersion} available` : `Installed ${product.installedVersion}`;
    }
    if (product.ready) return product.packaged ? 'Included with Instrumenta' : 'Ready from your workspace';
    if (product.canInstall) return product.latestVersion ? `Available, ${product.latestVersion}` : 'Available';
    if (product.releasePublished === false) return 'No release published yet';
    return product.detail || 'Not available';
  }

  /**
   * Every catalog product, in catalog order, as the chooser lists it: what it is now, what
   * installing it costs, whether it can be picked, and whether it keeps itself up to date.
   */
  function chooserRows(state) {
    const products = Array.isArray(state?.products) ? state.products : [];
    return products.map((product) => {
      const job = jobFor(state, product.id);
      const selectable = Boolean(!product.ready && product.canInstall && !job);
      const updates = releaseBacked(product) && Boolean(product.installedVersion || selectable || job);
      return {
        id: product.id,
        name: product.displayName || product.id,
        art: product.tile?.art || '',
        theme: product.tile?.theme || product.id,
        status: statusFor(product, job),
        size: selectable || job ? formatBytes(product.downloadSize) : '',
        selectable,
        published: product.releasePublished === true,
        developerOnly: product.lifecycle === 'developer-only',
        autoUpdate: updates ? autoUpdateFor(state, product.id) : null,
      };
    });
  }

  // The chooser opens by itself once, on the first run that has something to offer: a release an
  // update check has actually found. Until a check answers, Install is offered on the tile, but
  // interrupting the first run for a release that may not exist is not.
  function shouldOfferChooser(state) {
    if (!state || state.preferences?.appsChooserSeen) return false;
    return chooserRows(state).some((row) => row.selectable && row.published);
  }

  // Whether an open chooser can be updated in place, or needs its rows rebuilt: only the status
  // and size text change while a download runs, and rebuilding for those would take keyboard
  // focus away from whoever is using the list.
  function sameRowShape(left, right) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
    return left.every((row, index) => {
      const other = right[index];
      return row.id === other.id && row.selectable === other.selectable && row.autoUpdate === other.autoUpdate
        && row.developerOnly === other.developerOnly && row.art === other.art;
    });
  }

  // What the header says about the launcher's own newer version, from `state.launcherUpdate`
  // (main's self-update state): nothing when there is none. `route` is how this copy can be
  // updated — the installed launcher downloads and restarts, the portable one points at the
  // release, a checkout only says a release exists.
  function launcherUpdateView(update) {
    const { route = 'source', state = 'none', version = '', progress = null, error = '' } = update || {};
    if (state === 'none' || !version) return null;
    if (route === 'source') return { tone: 'quiet', label: `${version} released`, action: null, title: 'This launcher runs from a checkout: update it with git.' };
    if (route === 'portable') return { tone: 'quiet', label: `${version} available`, action: 'open-release', title: 'The portable launcher is replaced by hand: open the release to download it.' };
    if (state === 'available') return { tone: 'offer', label: `Update to ${version}`, action: 'download', title: `Download Instrumenta ${version} in the background.` };
    if (state === 'downloading') {
      const done = percent(progress);
      return { tone: 'busy', label: done === null ? `Downloading ${version}` : `Downloading ${version} · ${done}%`, action: null, title: 'Checked against the release before it runs.' };
    }
    if (state === 'ready') return { tone: 'ready', label: 'Restart to update', action: 'restart', title: `Instrumenta ${version} is downloaded and verified. Restart installs it; open apps close.` };
    return { tone: 'failed', label: `Update to ${version} failed`, action: 'download', title: error || 'The download did not verify. Try again.' };
  }

  return { autoUpdateFor, chooserRows, formatBytes, jobFor, jobLabel, launcherUpdateView, primaryAction, railFlag, sameRowShape, shouldOfferChooser };
}));
