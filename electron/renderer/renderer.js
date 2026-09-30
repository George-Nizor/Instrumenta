const state = { value: null, selected: '', painted: false, chooserOffered: false };
const rows = new Map();
const model = window.InstrumentaModel;

const elements = {
  rail: document.querySelector('#rail'),
  rowTemplate: document.querySelector('#rail-row'),
  hero: document.querySelector('#hero'),
  heroMark: document.querySelector('#hero-mark'),
  heroName: document.querySelector('#hero-name'),
  heroVersion: document.querySelector('#hero-version'),
  heroBlurb: document.querySelector('#hero-blurb'),
  heroDetail: document.querySelector('#hero-detail'),
  heroPrimary: document.querySelector('#hero-primary'),
  heroPrimaryLabel: document.querySelector('#hero-primary-label'),
  heroPrimaryIcon: document.querySelector('#hero-primary-icon'),
  heroReveal: document.querySelector('#hero-reveal'),
  heroUpdate: document.querySelector('#hero-update'),
  heroRollback: document.querySelector('#hero-rollback'),
  heroUninstall: document.querySelector('#hero-uninstall'),
  heroBusy: document.querySelector('#hero-busy'),
  heroBusyText: document.querySelector('#hero-busy-text'),
  accentProbe: document.querySelector('#accent-probe'),
  heroMarkOut: document.querySelector('#hero-mark-out'),
  heroStage: document.querySelector('.hero-stage'),
  shell: document.querySelector('.shell'),
  railIndicator: document.querySelector('#rail-indicator'),
  version: document.querySelector('#version'),
  workspacePath: document.querySelector('#workspace-path'),
  settingsPath: document.querySelector('#settings-path'),
  settingsDialog: document.querySelector('#settings-dialog'),
  errorDialog: document.querySelector('#error-dialog'),
  errorMessage: document.querySelector('#error-message'),
  appsDialog: document.querySelector('#apps-dialog'),
  appsList: document.querySelector('#apps-list'),
  appRowTemplate: document.querySelector('#app-row'),
  appsInstall: document.querySelector('#apps-install'),
  appsWorkspace: document.querySelector('#apps-workspace'),
  autoUpdate: document.querySelector('#auto-update-toggle'),
};

function products() {
  return Array.isArray(state.value?.products) ? state.value.products : [];
}

function productFor(id) {
  return state.value?.[id] || products().find((entry) => entry.id === id) || null;
}

function selectedProduct() {
  return productFor(state.selected) || products()[0] || null;
}

// The rail is the whole product list, so the mark is the only thing that has to
// be resolved per product; everything else comes off the state object.
function artFor(product) {
  return product?.tile?.art ? `../../${product.tile.art}` : '';
}

// The verb for a product, and the install job that may own its button, come from the
// shared model so the chooser, the rail and the hero can never disagree.
function jobFor(id) {
  return model.jobFor(state.value, id);
}

function primaryAction(product) {
  return model.primaryAction(product, product ? jobFor(product.id) : null);
}

const ACTION_LABELS = {
  open: 'Open', install: 'Install', prepare: 'Prepare', update: 'Update', locate: 'Locate', busy: 'Installing…', unreleased: 'Not released',
};
// The verb and its glyph are chosen together. A download arrow on Install and a
// refresh on Update read at a glance; a play triangle on either does not.
const ACTION_ICONS = {
  open: 'M6 4l12 8-12 8V4Z',
  install: 'M12 4v11M7 12l5 5 5-5M5 20h14',
  update: 'M20 7v5h-5M4 17v-5h5M6.1 8.1A7 7 0 0 1 18.7 7M17.9 15.9A7 7 0 0 1 5.3 17',
  prepare: 'M12 3 3 7.5v9L12 21l9-4.5v-9L12 3Zm0 9 9-4.5M12 12v9M12 12 3 7.5',
  locate: 'M3.5 6.5h6l2 2h9v9.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2V6.5Z',
  busy: 'M12 4v11M7 12l5 5 5-5M5 20h14',
  unreleased: 'M6 12h12',
};

function buildRail() {
  // replaceChildren clears the indicator too, so it is put back deliberately
  // rather than being quietly lost the first time the product list changes.
  elements.rail.replaceChildren();
  if (elements.railIndicator) elements.rail.append(elements.railIndicator);
  rows.clear();
  for (const product of products()) {
    const fragment = elements.rowTemplate.content.cloneNode(true);
    const item = fragment.querySelector('.rail-item');
    const button = fragment.querySelector('.rail-button');
    const mark = fragment.querySelector('.rail-mark');
    const art = artFor(product);
    if (art) mark.src = art;
    else mark.remove();
    button.addEventListener('click', () => select(product.id));
    button.addEventListener('dblclick', () => activate(product.id));
    item.style.setProperty('--order', String(rows.size));
    elements.rail.append(fragment);
    rows.set(product.id, {
      item,
      button,
      name: item.querySelector('.rail-name'),
      flag: item.querySelector('.rail-flag'),
    });
  }
}

function renderRail() {
  const busy = state.value?.busyTool || '';
  for (const product of products()) {
    const ui = rows.get(product.id);
    if (!ui) continue;
    const accent = `var(--${product.tile?.theme || product.id})`;
    ui.button.style.setProperty('--accent', accent);
    ui.name.textContent = product.displayName || product.id;
    ui.item.classList.toggle('selected', product.id === state.selected);
    ui.item.classList.toggle('unavailable', !product.ready);
    ui.button.setAttribute('aria-current', product.id === state.selected ? 'true' : 'false');
    ui.button.disabled = Boolean(busy);
    // The rail flags only what needs a decision or is under way. A ready, current
    // product says nothing at all -- that absence is the signal.
    const flag = model.railFlag(product, jobFor(product.id));
    ui.flag.className = flag.dot ? 'rail-flag dot' : 'rail-flag';
    ui.flag.textContent = flag.text;
  }
  placeIndicator();
}

// The indicator is measured off the row rather than computed from row height, so
// it stays correct if the rail ever gains a different row size or a section header.
function placeIndicator() {
  const ui = rows.get(state.selected);
  const indicator = elements.railIndicator;
  if (!indicator) return;
  if (!ui) { indicator.classList.remove('placed'); return; }
  indicator.style.height = `${ui.item.offsetHeight}px`;
  indicator.style.transform = `translateY(${ui.item.offsetTop}px)`;
  indicator.style.setProperty('--accent', `var(--${productFor(state.selected)?.tile?.theme || state.selected})`);
  indicator.classList.add('placed');
}

function renderHero() {
  const product = selectedProduct();
  const busyTool = state.value?.busyTool || '';
  if (!product) {
    elements.heroName.textContent = 'No products registered';
    elements.heroBlurb.textContent = 'Choose the workspace folder that holds the registered product checkouts.';
    elements.heroDetail.textContent = '';
    elements.heroVersion.textContent = '';
    elements.heroMark.removeAttribute('src');
    elements.heroPrimary.disabled = true;
    return;
  }
  const name = product.displayName || product.id;
  const job = jobFor(product.id);
  const action = primaryAction(product);
  // The overlay covers foreground work and an install actually running; a queued install
  // or a background download of an update leaves the product usable.
  const isBusy = busyTool === product.id || Boolean(job && job.kind === 'install' && job.state === 'running');

  elements.hero.style.setProperty('--accent', `var(--${product.tile?.theme || product.id})`);
  elements.hero.classList.toggle('unavailable', !product.ready);
  const art = artFor(product);
  if (art) elements.heroMark.src = art;
  elements.heroName.textContent = name;
  elements.heroVersion.textContent = product.version && product.version !== 'unknown' ? product.version : '';
  elements.heroBlurb.textContent = product.tile?.blurb || '';
  // `detail` already explains the one thing that is not obvious from the tile,
  // so it replaces both the old status bar and the old hover tooltip.
  elements.heroDetail.textContent = job
    ? `${job.kind === 'download' ? 'Update' : name}: ${model.jobLabel(job)}`
    : product.ready && !product.updateAvailable ? '' : product.detail || '';

  elements.heroPrimaryLabel.textContent = action === 'busy' ? model.jobLabel(job) : ACTION_LABELS[action];
  elements.heroPrimaryIcon.setAttribute('d', ACTION_ICONS[action]);
  elements.heroPrimary.setAttribute('aria-label', `${ACTION_LABELS[action]} ${name}`);
  elements.heroPrimary.disabled = Boolean(busyTool) || action === 'busy' || action === 'unreleased'
    || (action === 'locate' && !product.sourceRoot && product.lifecycle !== 'developer-only');
  elements.heroReveal.disabled = !product.location;
  elements.heroReveal.setAttribute('aria-label', `Reveal ${name}`);

  const canUpdate = Boolean(product.canInstall && product.ready && !job);
  elements.heroUpdate.disabled = Boolean(busyTool) || !canUpdate;
  elements.heroUpdate.setAttribute('aria-label', `Reinstall ${name}`);
  elements.heroUpdate.title = `Reinstall ${name}`;
  elements.heroRollback.disabled = Boolean(busyTool) || Boolean(job) || !product.canRollback;
  elements.heroRollback.setAttribute('aria-label', `Roll back ${name}`);
  elements.heroRollback.title = `Roll back ${name}`;
  elements.heroUninstall.disabled = Boolean(busyTool) || Boolean(job) || !product.canUninstall;
  elements.heroUninstall.setAttribute('aria-label', `Uninstall ${name}`);
  elements.heroUninstall.title = `Uninstall ${name}`;

  elements.heroBusy.hidden = !isBusy;
  elements.heroBusyText.textContent = !isBusy ? ''
    : busyTool === product.id ? state.value?.activity || `Working on ${name}…`
      : `${name}: ${model.jobLabel(job)}`;
}

// Re-running an animation needs the class off, a reflow, then the class on.
// Without the forced reflow the browser coalesces both writes and nothing replays.
function replayHeroEntrance() {
  elements.hero.classList.remove('entering');
  void elements.hero.offsetWidth;
  elements.hero.classList.add('entering');
}

// Hand the outgoing mark to its own layer so it can leave while the new one
// arrives. Without this the old product simply blinks out of existence.
function handOffMark(previousSrc) {
  const outgoing = elements.heroMarkOut;
  if (!outgoing || !previousSrc) return;
  outgoing.src = previousSrc;
  elements.hero.classList.remove('leaving');
  void outgoing.offsetWidth;
  elements.hero.classList.add('leaving');
}

// Direction comes from the move along the rail, so the content enters from the
// side you came from. Travelling down pushes the old product up, and vice versa.
function directionBetween(fromId, toId) {
  const list = products();
  const from = list.findIndex((product) => product.id === fromId);
  const to = list.findIndex((product) => product.id === toId);
  if (from < 0 || to < 0 || from === to) return 1;
  return to > from ? 1 : -1;
}

// The probe's computed colour is the accent already resolved to rgb().
function syncField({ pulse = false } = {}) {
  if (!elements.accentProbe) return;
  const accent = getComputedStyle(elements.accentProbe).color;
  elements.shell?.style.setProperty('--accent', accent);
  window.instrumentaField?.setAccent(accent);
  if (!pulse) return;
  const mark = elements.heroMark.getBoundingClientRect();
  window.instrumentaField?.pulse(mark.left + mark.width / 2, mark.top + mark.height / 2);
}

function select(id) {
  if (!productFor(id) || id === state.selected) return;
  const previousSrc = elements.heroMark.getAttribute('src') || '';
  elements.hero.style.setProperty('--dir', String(directionBetween(state.selected, id)));
  state.selected = id;
  handOffMark(previousSrc);
  renderRail();
  renderHero();
  replayHeroEntrance();
  syncField({ pulse: true });
}

function render(nextState) {
  state.value = nextState;
  const list = products();
  if (list.length !== rows.size || list.some((product) => !rows.has(product.id))) buildRail();
  if (!productFor(state.selected)) {
    state.selected = (list.find((product) => product.ready) || list[0])?.id || '';
  }
  elements.workspacePath.textContent = nextState.workspace || 'Choose the Instrumenta workspace';
  elements.workspacePath.title = nextState.workspace || '';
  elements.settingsPath.textContent = nextState.workspace || 'No workspace selected';
  elements.version.textContent = `${nextState.version}${nextState.packaged ? '' : ' · dev'}`;
  renderRail();
  renderHero();
  if (elements.appsDialog.open) renderChooser();
  if (!state.painted) {
    state.painted = true;
    replayHeroEntrance();
  }
  syncField();
  // The chooser opens by itself once, on the first run that has something to offer.
  if (!state.chooserOffered && model.shouldOfferChooser(nextState) && !elements.errorDialog.open) {
    state.chooserOffered = true;
    openChooser();
  }
}

// ---- app chooser -----------------------------------------------------------

const picked = new Set();
let chooserRows = [];

function renderChooser() {
  const rows = model.chooserRows(state.value);
  for (const id of [...picked]) {
    if (!rows.some((row) => row.id === id && row.selectable)) picked.delete(id);
  }
  elements.autoUpdate.checked = state.value?.preferences?.autoUpdate !== false;
  elements.appsInstall.disabled = !picked.size;
  elements.appsWorkspace.hidden = !rows.some((row) => row.developerOnly);
  if (model.sameRowShape(chooserRows, rows) && elements.appsList.children.length === rows.length) {
    rows.forEach((row, index) => {
      const item = elements.appsList.children[index];
      item.querySelector('.app-status').textContent = row.status;
      item.querySelector('.app-size').textContent = row.size;
    });
    chooserRows = rows;
    return;
  }
  chooserRows = rows;
  elements.appsList.replaceChildren();
  for (const row of rows) {
    const fragment = elements.appRowTemplate.content.cloneNode(true);
    const item = fragment.querySelector('.app-row');
    const pick = fragment.querySelector('.app-pick');
    const mark = fragment.querySelector('.app-mark');
    const auto = fragment.querySelector('.app-auto');
    const autoBox = auto.querySelector('input');
    item.style.setProperty('--accent', `var(--${row.theme})`);
    item.classList.toggle('muted', !row.selectable && row.developerOnly);
    if (row.art) mark.src = `../../${row.art}`;
    else mark.remove();
    fragment.querySelector('.app-name').textContent = row.name;
    fragment.querySelector('.app-status').textContent = row.status;
    fragment.querySelector('.app-size').textContent = row.size;
    pick.disabled = !row.selectable;
    pick.checked = row.selectable && picked.has(row.id);
    pick.setAttribute('aria-label', `Install ${row.name}`);
    pick.addEventListener('change', () => {
      if (pick.checked) picked.add(row.id);
      else picked.delete(row.id);
      elements.appsInstall.disabled = !picked.size;
    });
    if (row.autoUpdate === null) auto.remove();
    else {
      autoBox.checked = row.autoUpdate;
      autoBox.setAttribute('aria-label', `Keep ${row.name} up to date automatically`);
      autoBox.addEventListener('change', () => perform(() => window.instrumenta.setPreferences({ product: row.id, autoUpdate: autoBox.checked })));
    }
    elements.appsList.append(fragment);
  }
}

function openChooser() {
  picked.clear();
  chooserRows = [];
  renderChooser();
  if (!elements.appsDialog.open) elements.appsDialog.showModal();
}

elements.appsDialog.addEventListener('close', () => {
  if (!state.value?.preferences?.appsChooserSeen) {
    perform(() => window.instrumenta.setPreferences({ appsChooserSeen: true }));
  }
});
elements.autoUpdate.addEventListener('change', () => perform(() => window.instrumenta.setPreferences({ autoUpdate: elements.autoUpdate.checked })));
elements.appsInstall.addEventListener('click', () => {
  const tools = [...picked];
  picked.clear();
  elements.appsDialog.close();
  // Queued at once; each tile shows its own progress while the answer is awaited.
  perform(() => window.instrumenta.installMany(tools));
});
elements.appsWorkspace.addEventListener('click', () => {
  elements.appsDialog.close();
  elements.settingsDialog.showModal();
});

function showError(error) {
  elements.errorMessage.textContent = error?.message || String(error);
  elements.errorDialog.showModal();
}

async function perform(operation) {
  try {
    const nextState = await operation();
    if (nextState) render(nextState);
  } catch (error) {
    showError(error);
    render(await window.instrumenta.refresh());
  }
}

async function activate(id) {
  const product = productFor(id);
  if (!product) return;
  select(id);
  switch (primaryAction(product)) {
    case 'open': return perform(() => window.instrumenta.launch(id));
    case 'update':
    case 'install': return perform(() => window.instrumenta.install(id));
    case 'prepare': return perform(() => window.instrumenta.prepare(id));
    case 'busy':
    case 'unreleased': return undefined;
    default: elements.settingsDialog.showModal();
  }
}

function moveSelection(offset) {
  const list = products();
  if (!list.length) return;
  const index = list.findIndex((product) => product.id === state.selected);
  select(list[(index + offset + list.length) % list.length].id);
}

elements.heroPrimary.addEventListener('click', () => activate(state.selected));
elements.heroReveal.addEventListener('click', () => perform(() => window.instrumenta.reveal(state.selected)));
elements.heroUpdate.addEventListener('click', () => perform(() => window.instrumenta.install(state.selected)));
elements.heroRollback.addEventListener('click', () => perform(() => window.instrumenta.rollback(state.selected)));
elements.heroUninstall.addEventListener('click', () => perform(() => window.instrumenta.uninstall(state.selected)));
document.querySelector('#add-product').addEventListener('click', () => openChooser());
document.querySelector('#refresh-button').addEventListener('click', () => perform(() => window.instrumenta.refresh()));
document.querySelector('#workspace-button').addEventListener('click', () => perform(() => window.instrumenta.openWorkspace()));
document.querySelector('#settings-button').addEventListener('click', () => elements.settingsDialog.showModal());
elements.workspacePath.addEventListener('click', () => elements.settingsDialog.showModal());
document.querySelector('#choose-workspace-button').addEventListener('click', async () => {
  await perform(() => window.instrumenta.chooseWorkspace());
  elements.settingsDialog.close();
});

document.addEventListener('keydown', (event) => {
  if (elements.settingsDialog.open || elements.errorDialog.open || elements.appsDialog.open) return;
  if ((event.ctrlKey || event.metaKey) && event.key === ',') { elements.settingsDialog.showModal(); return; }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'r') {
    event.preventDefault();
    perform(() => window.instrumenta.refresh());
    return;
  }
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  const numbered = products()[Number(event.key) - 1];
  if (numbered) { activate(numbered.id); return; }
  if (event.key === 'ArrowDown') { event.preventDefault(); moveSelection(1); }
  if (event.key === 'ArrowUp') { event.preventDefault(); moveSelection(-1); }
  if (event.key === 'Enter' && state.selected) activate(state.selected);
});

// A few pixels of pointer parallax. Enough to make the mark feel like an object
// sitting in the window rather than an image pasted onto it.
if (!matchMedia('(prefers-reduced-motion: reduce)').matches && elements.heroStage) {
  elements.hero.addEventListener('pointermove', (event) => {
    const bounds = elements.hero.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width - 0.5;
    const y = (event.clientY - bounds.top) / bounds.height - 0.5;
    elements.heroStage.style.transform = `translate3d(${(-x * 16).toFixed(2)}px, ${(-y * 12).toFixed(2)}px, 0)`;
  });
  elements.hero.addEventListener('pointerleave', () => {
    elements.heroStage.style.transform = 'translate3d(0, 0, 0)';
  });
}

window.addEventListener('resize', placeIndicator);
window.instrumenta.onState(render);
perform(() => window.instrumenta.getState());
