// The External library page and the chooser's External library group: open-source apps by other
// people, which Instrumenta installs and updates but does not present as its own. They are drawn
// plainly on purpose: their own names, their makers' credit and licence, a monogram or the app's
// own icon, and never an Instrumenta glyph, accent or tile.
//
// Everything is asked of main through window.instrumenta.library*; the page holds no paths or URLs
// it did not get from there, and sends back only app IDs and fixed action words.
(function library() {
  const api = window.instrumenta;
  const model = window.InstrumentaModel;
  const $ = (selector) => document.querySelector(selector);
  const page = $('.page-external');
  const sourcesBox = $('#external-sources');
  const summary = $('#external-summary');
  const locationPath = $('#external-location-path');
  const locationNote = $('#external-location-note');
  const locationDefault = $('#external-location-default');
  const chooserGroup = $('#apps-external');
  const chooserList = $('#apps-external-list');
  const chooserTemplate = $('#app-row');
  const appsDialog = $('#apps-dialog');
  const appsInstall = $('#apps-install');
  if (!api || !page || !sourcesBox) return;

  let current = null;
  let queue = [];
  const icons = new Map();
  const picks = new Set();
  const format = (bytes) => model?.formatBytes(bytes) || '';

  function report(error) {
    if (typeof showError === 'function') showError(error); // renderer.js's error dialog
    else console.error(error);
  }

  async function act(operation) {
    try {
      await operation();
    } catch (error) {
      report(error);
    }
    await load();
  }

  const visible = () => page.classList.contains('active');

  async function load() {
    if (!visible() && !appsDialog?.open) return;
    try {
      current = await api.library();
    } catch (error) {
      sourcesBox.replaceChildren(paragraph('external-empty', error?.message || String(error)));
      return;
    }
    if (visible()) renderPage();
    if (appsDialog?.open) renderChooser();
  }

  // ---- Small builders ----

  function paragraph(className, text) {
    const element = document.createElement('p');
    element.className = className;
    element.textContent = text;
    return element;
  }

  function button(label, className, onClick, { title = '', disabled = false } = {}) {
    const element = document.createElement('button');
    element.type = 'button';
    element.className = className;
    element.textContent = label;
    if (title) element.title = title;
    element.disabled = disabled;
    element.addEventListener('click', onClick);
    return element;
  }

  function monogram(name) {
    const capitals = String(name).replace(/[^A-Z]/g, '');
    return (capitals.length >= 2 ? capitals.slice(0, 2) : String(name).slice(0, 2)).toUpperCase();
  }

  // The app's own icon once it is installed (read from its executable by main), else a monogram.
  function markFor(app) {
    const mark = document.createElement('span');
    mark.className = 'external-mark';
    mark.textContent = monogram(app.name);
    mark.setAttribute('aria-hidden', 'true');
    const known = icons.get(app.id);
    if (known) {
      const image = document.createElement('img');
      image.src = known;
      image.alt = '';
      mark.replaceChildren(image);
      mark.classList.add('has-icon');
    } else if (app.installed && !icons.has(app.id)) {
      icons.set(app.id, null);
      api.libraryIcon(app.id).then((url) => {
        if (!url || !/^data:image\/png;base64,/.test(url)) return;
        icons.set(app.id, url);
        const image = document.createElement('img');
        image.src = url;
        image.alt = '';
        mark.replaceChildren(image);
        mark.classList.add('has-icon');
      }).catch(() => {});
    }
    return mark;
  }

  function jobFor(id) {
    return queue.find((job) => job.id === `library:${id}`) || null;
  }

  function statusText(app, job) {
    if (job) return model.jobLabel(job);
    if (app.installed) {
      const parts = [`${app.installedVersion} installed`];
      if (app.updateAvailable) parts.push(`${app.latestVersion} available`);
      if (app.pending) parts.push('not opened yet');
      if (app.running) parts.push('running');
      return parts.join(' · ');
    }
    if (app.releasePublished === false) return 'No Windows build in its latest release';
    if (app.latestVersion) return `Not installed · ${app.latestVersion}${app.downloadSize ? `, ${format(app.downloadSize)} download` : ''}`;
    return 'Not installed';
  }

  // ---- The page ----

  function renderLocation() {
    const where = current.location;
    locationPath.textContent = where.path;
    locationPath.title = where.path;
    const elsewhere = current.apps.filter((app) => app.elsewhere).length;
    const parts = [where.isDefault ? 'The default location.' : `Default: ${where.default}`];
    parts.push('New installs go here.');
    if (elsewhere) parts.push(`${elsewhere} installed ${elsewhere === 1 ? 'app stays' : 'apps stay'} where ${elsewhere === 1 ? 'it was' : 'they were'} installed and keep${elsewhere === 1 ? 's' : ''} updating there; each shows its own folder below.`);
    if (Number.isFinite(where.free)) parts.push(`${format(where.free)} free on that drive.`);
    locationNote.textContent = parts.join(' ');
    locationDefault.hidden = where.isDefault;
  }

  function appRow(app) {
    const job = jobFor(app.id);
    const item = document.createElement('li');
    item.className = 'external-app';
    item.dataset.app = app.id;
    item.classList.toggle('installed', app.installed);

    const text = document.createElement('div');
    text.className = 'external-text';
    const head = document.createElement('div');
    head.className = 'external-head';
    const name = document.createElement('b');
    name.className = 'external-name';
    name.textContent = app.name;
    const status = document.createElement('span');
    status.className = 'external-status';
    status.textContent = statusText(app, job);
    head.append(name, status);
    const description = paragraph('external-description', app.description || '');
    const credit = document.createElement('div');
    credit.className = 'external-credit';
    credit.append(document.createTextNode(`${app.credit} · `));
    credit.append(button(app.repository, 'external-link', () => act(() => api.libraryRepository(app.id)), { title: `Open ${app.repository}` }));
    text.append(head, description, credit);
    if (app.installed) {
      const where = document.createElement('div');
      where.className = 'external-path';
      const code = document.createElement('code');
      code.textContent = app.versionFolder;
      code.title = app.executable;
      where.append(code);
      if (app.elsewhere) where.append(document.createTextNode(' (outside the current library location)'));
      where.append(button('Open folder', 'external-link', () => act(() => api.libraryReveal(app.id))));
      text.append(where);
    }

    const side = document.createElement('div');
    side.className = 'external-side';
    const size = document.createElement('span');
    size.className = 'panel-size';
    size.textContent = app.installed ? format(app.bytes) : '';
    const actions = document.createElement('div');
    actions.className = 'external-actions';
    const busy = Boolean(job);
    if (app.installed) {
      actions.append(button(app.running ? 'Open again' : 'Open', 'primary small', () => act(() => api.libraryOpen(app.id)), { disabled: busy && job.kind === 'install' && job.state === 'running' }));
      if (app.updateAvailable) actions.append(button('Update', 'secondary small', () => act(() => api.libraryInstall([app.id])), { disabled: busy }));
      if (app.previous) actions.append(button('Roll back', 'secondary small', () => act(() => api.libraryRollback(app.id)), { disabled: busy, title: `Go back to ${app.previous}` }));
      actions.append(button('Uninstall', 'secondary small', () => act(() => api.libraryUninstall(app.id)), { disabled: busy || app.running }));
    } else {
      actions.append(button(busy ? model.jobLabel(job) : 'Install', 'primary small', () => act(() => api.libraryInstall([app.id])), { disabled: busy || app.releasePublished === false }));
      if (app.discovered) {
        actions.append(button('Remove from list', 'secondary small', () => act(() => api.librarySuggestion({ action: 'remove', source: app.source, repo: app.repo }))));
      }
    }
    side.append(size, actions);
    if (app.installed) {
      const auto = document.createElement('label');
      auto.className = 'app-auto';
      const box = document.createElement('input');
      box.type = 'checkbox';
      box.checked = app.autoUpdate;
      box.setAttribute('aria-label', `Keep ${app.name} up to date automatically`);
      box.addEventListener('change', () => act(() => api.libraryPreference({ app: app.id, autoUpdate: box.checked })));
      const word = document.createElement('span');
      word.textContent = 'Auto-update';
      auto.append(box, word);
      side.append(auto);
    }
    item.append(markFor(app), text, side);
    return item;
  }

  function suggestionRow(suggestion) {
    const item = document.createElement('li');
    item.className = 'external-app suggestion';
    const text = document.createElement('div');
    text.className = 'external-text';
    const head = document.createElement('div');
    head.className = 'external-head';
    const name = document.createElement('b');
    name.className = 'external-name';
    name.textContent = suggestion.name;
    const status = document.createElement('span');
    status.className = 'external-status';
    status.textContent = suggestion.version ? `${suggestion.version} has a Windows build` : '';
    head.append(name, status);
    text.append(head, paragraph('external-description', suggestion.description || ''), paragraph('external-credit', `${suggestion.credit} · github.com/${suggestion.source}/${suggestion.repo}`));
    const side = document.createElement('div');
    side.className = 'external-actions';
    side.append(
      button('Add to the list', 'secondary small', () => act(() => api.librarySuggestion({ action: 'add', source: suggestion.source, repo: suggestion.repo }))),
      button('Dismiss', 'secondary small', () => act(() => api.librarySuggestion({ action: 'dismiss', source: suggestion.source, repo: suggestion.repo }))),
    );
    item.append(markFor({ id: `suggestion:${suggestion.repo}`, name: suggestion.name, installed: false }), text, side);
    return item;
  }

  function renderPage() {
    if (!current) return;
    renderLocation();
    const installed = current.apps.filter((app) => app.installed);
    const updates = current.apps.filter((app) => app.updateAvailable).length;
    const parts = [`${current.apps.length} apps`, `${installed.length} installed`];
    if (current.total) parts.push(format(current.total));
    if (updates) parts.push(`${updates} ${updates === 1 ? 'update' : 'updates'}`);
    summary.textContent = parts.join(' · ');
    sourcesBox.replaceChildren();
    for (const source of current.sources) {
      const group = document.createElement('section');
      group.className = 'external-source';
      const heading = document.createElement('div');
      heading.className = 'external-source-head';
      const title = document.createElement('h3');
      title.className = 'dialog-section';
      title.textContent = source.collection ? `${source.collection} by ${source.name}` : source.name;
      const meta = document.createElement('small');
      meta.textContent = `${source.licence} · ${source.profile}`;
      heading.append(title, meta);
      const list = document.createElement('ul');
      list.className = 'external-list';
      for (const app of current.apps.filter((entry) => entry.source === source.id)) list.append(appRow(app));
      group.append(heading, list);
      const suggestions = current.suggestions.filter((entry) => entry.source === source.id);
      if (suggestions.length) {
        const more = document.createElement('h3');
        more.className = 'dialog-section';
        more.textContent = `New from ${source.name}`;
        const note = paragraph('external-intro', `Repositories ${source.name} has published since this list was made, each with a Windows build in its latest release. Adding one lists it here; nothing is installed until you install it.`);
        const extra = document.createElement('ul');
        extra.className = 'external-list';
        for (const suggestion of suggestions) extra.append(suggestionRow(suggestion));
        group.append(more, note, extra);
      }
      sourcesBox.append(group);
    }
    if (!current.sources.length) sourcesBox.replaceChildren(paragraph('external-empty', 'No sources are configured.'));
  }

  // Only the labels move while a download runs; the rows are rebuilt when a job starts or ends.
  function renderProgress() {
    if (!current) return;
    for (const app of current.apps) {
      const job = jobFor(app.id);
      if (!job) continue;
      const row = sourcesBox.querySelector(`.external-app[data-app="${app.id}"] .external-status`);
      if (row) row.textContent = statusText(app, job);
      const chooserRow = chooserList?.querySelector(`[data-app="${app.id}"] .app-status`);
      if (chooserRow) chooserRow.textContent = statusText(app, job);
    }
  }

  // ---- The chooser group ----

  function updateInstallButton() {
    if (!appsInstall) return;
    const suitePicked = document.querySelectorAll('#apps-list .app-pick:checked').length;
    appsInstall.disabled = !suitePicked && !picks.size;
  }

  function renderChooser() {
    if (!chooserGroup || !chooserList || !current) return;
    chooserGroup.hidden = !current.apps.length;
    chooserList.replaceChildren();
    for (const app of current.apps) {
      const job = jobFor(app.id);
      const selectable = !app.installed && !job && app.releasePublished !== false;
      if (!selectable) picks.delete(app.id);
      const fragment = chooserTemplate.content.cloneNode(true);
      const item = fragment.querySelector('.app-row');
      item.dataset.app = app.id;
      item.classList.add('external');
      const pick = fragment.querySelector('.app-pick');
      const mark = fragment.querySelector('.app-mark');
      mark.replaceWith(markFor(app));
      fragment.querySelector('.app-name').textContent = app.name;
      fragment.querySelector('.app-status').textContent = `${app.credit} · ${statusText(app, job)}`;
      fragment.querySelector('.app-size').textContent = selectable && app.downloadSize ? format(app.downloadSize) : '';
      pick.disabled = !selectable;
      pick.checked = selectable && picks.has(app.id);
      pick.setAttribute('aria-label', `Install ${app.name}`);
      pick.addEventListener('change', () => {
        if (pick.checked) picks.add(app.id);
        else picks.delete(app.id);
        updateInstallButton();
      });
      const auto = fragment.querySelector('.app-auto');
      if (!app.installed) auto.remove();
      else {
        const box = auto.querySelector('input');
        box.checked = app.autoUpdate;
        box.setAttribute('aria-label', `Keep ${app.name} up to date automatically`);
        box.addEventListener('change', () => act(() => api.libraryPreference({ app: app.id, autoUpdate: box.checked })));
      }
      chooserList.append(fragment);
    }
    updateInstallButton();
  }

  // ---- Wiring ----

  $('#external-location-open')?.addEventListener('click', () => act(() => api.libraryReveal('root')));
  $('#external-location-change')?.addEventListener('click', () => act(() => api.libraryLocation('choose')));
  locationDefault?.addEventListener('click', () => act(() => api.libraryLocation('default')));
  $('#external-library-button')?.addEventListener('click', () => {
    // renderer.js owns the views and pages; the library page lives in the Library view.
    if (typeof applyView === 'function') applyView('library');
    if (typeof setPage === 'function') setPage('external');
  });

  new MutationObserver(() => { if (visible()) load(); }).observe(page, { attributes: true, attributeFilter: ['class'] });
  api.onLibrary?.(() => load());
  const takeQueue = (value) => {
    const next = Array.isArray(value?.queue) ? value.queue : null;
    if (!next) return;
    const before = queue.filter((job) => job.id.startsWith('library:')).map((job) => `${job.id}:${job.kind}:${job.state}`).join();
    queue = next;
    const after = queue.filter((job) => job.id.startsWith('library:')).map((job) => `${job.id}:${job.kind}:${job.state}`).join();
    if (before !== after) load();
    else renderProgress();
  };
  api.onState?.(takeQueue);
  api.onProgress?.(takeQueue);

  window.InstrumentaLibrary = {
    pickedCount: () => picks.size,
    takePicks: () => {
      const ids = [...picks];
      picks.clear();
      return ids;
    },
    // From the chooser: queued at once, each row shows its own progress.
    install: (ids) => act(() => api.libraryInstall(ids)),
    openChooser: () => {
      picks.clear();
      // The dialog opens right after this; the group fills in when the library answers.
      setTimeout(() => load(), 0);
    },
  };
}());
