const state = { value: null, selected: '', painted: false, chooserOffered: false, versions: new Map(), greeted: false };
const rows = new Map();
const model = window.InstrumentaModel;
const icons = window.InstrumentaIcons;
const delight = window.InstrumentaDelight;
const organ = delight.createOrgan();
const $ = (selector) => document.querySelector(selector);

const elements = {
  rail: $('#rail'),
  rowTemplate: $('#rail-row'),
  hero: $('#hero'),
  heroMark: $('#hero-mark'),
  heroName: $('#hero-name'),
  heroVersion: $('#hero-version'),
  heroLatin: $('#hero-latin'),
  heroBlurb: $('#hero-blurb'),
  heroDetail: $('#hero-detail'),
  heroPrimary: $('#hero-primary'),
  heroPrimaryLabel: $('#hero-primary-label'),
  heroPrimaryIcon: $('#hero-primary-icon'),
  heroReveal: $('#hero-reveal'),
  heroReport: $('#hero-report'),
  heroUpdate: $('#hero-update'),
  heroRollback: $('#hero-rollback'),
  heroUninstall: $('#hero-uninstall'),
  heroBusy: $('#hero-busy'),
  heroBusyText: $('#hero-busy-text'),
  accentProbe: $('#accent-probe'),
  heroMarkOut: $('#hero-mark-out'),
  heroStage: $('.hero-stage'),
  whatsNew: $('#whats-new'),
  whatsNewTitle: $('#whats-new-title'),
  whatsNewNotes: $('#whats-new-notes'),
  shell: $('.shell'),
  railIndicator: $('#rail-indicator'),
  organ: $('#organ'),
  version: $('#version'),
  launcherUpdate: $('#launcher-update'),
  workspacePath: $('#workspace-path'),
  settingsPath: $('#settings-path'),
  settingsDialog: $('#settings-dialog'),
  errorDialog: $('#error-dialog'),
  errorMessage: $('#error-message'),
  appsDialog: $('#apps-dialog'),
  appsList: $('#apps-list'),
  appRowTemplate: $('#app-row'),
  appsInstall: $('#apps-install'),
  appsWorkspace: $('#apps-workspace'),
  autoUpdate: $('#auto-update-toggle'),
  aboutDialog: $('#about-dialog'),
  aboutVersion: $('#about-version'),
  creditsDialog: $('#credits-dialog'),
  creditsRoll: $('#credits-roll'),
  storageDialog: $('#storage-dialog'),
  storageSummary: $('#storage-summary'),
  storageList: $('#storage-list'),
  readinessDialog: $('#readiness-dialog'),
  readinessSummary: $('#readiness-summary'),
  readinessChecks: $('#readiness-checks'),
  readinessProducts: $('#readiness-products'),
  journalDialog: $('#journal-dialog'),
  journalSummary: $('#journal-summary'),
  journalList: $('#journal-list'),
  ambienceLabel: $('#ambience-label'),
  toasts: $('#toasts'),
};
const DIALOGS = ['settingsDialog', 'errorDialog', 'appsDialog', 'aboutDialog', 'creditsDialog', 'storageDialog', 'readinessDialog', 'journalDialog'];
const anyDialogOpen = () => DIALOGS.some((key) => elements[key].open);

// The field behind a dialog cannot be seen, and drawing it under a full-window dialog costs frames
// the dialog needs. It stops while any dialog is open and resumes when the last one closes.
function openDialog(dialog) {
  if (dialog.open) return;
  window.instrumentaField?.stop();
  dialog.showModal();
}
for (const key of DIALOGS) elements[key].addEventListener('close', () => { if (!anyDialogOpen()) window.instrumentaField?.start(); });

// ---- Local preferences ---------------------------------------------------------------------
// Sound, celebrations, ambience, the journal and which release notes were read live in this
// window's own storage. They are conveniences: losing them loses nothing that matters.
const local = {
  get(key, fallback) { try { const raw = localStorage.getItem(`instrumenta.${key}`); return raw === null ? fallback : JSON.parse(raw); } catch { return fallback; } },
  set(key, value) { try { localStorage.setItem(`instrumenta.${key}`, JSON.stringify(value)); } catch { /* storage unavailable */ } },
};
const prefs = () => ({ sound: local.get('sound', false) === true, celebrate: local.get('celebrate', true) !== false, ambience: local.get('ambience', 'seasons'), theme: local.get('theme', 'system') });

// Dark, light, or whatever Windows is set to. Applied before the first paint of real content.
const systemLight = matchMedia('(prefers-color-scheme: light)');
function applyTheme() {
  const choice = prefs().theme;
  const light = choice === 'light' || (choice === 'system' && systemLight.matches);
  document.documentElement.dataset.theme = light ? 'light' : 'dark';
}
systemLight.addEventListener('change', applyTheme);
applyTheme();

// ---- Products ------------------------------------------------------------------------------
const TAGS = {
  fabula: 'Video from a transcript', imago: 'Images and designs', ludere: 'Screenplays', discere: 'Learning',
  learnchess: 'Chess trainer', luna: 'Local voice', forge3d: '3D workstation',
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

const themeOf = (product) => product?.tile?.theme || product?.id || 'instrumenta';
const nameOf = (product) => product?.displayName || product?.id || '';
const hasIcon = (id) => icons.PRODUCTS.some((entry) => entry.id === id);

// The icon library draws every known product; a product added to the catalogue before it has a
// glyph falls back to its tile art, so a new product never shows a hole.
function iconInto(target, product, size) {
  target.replaceChildren();
  if (product && hasIcon(product.id)) {
    target.innerHTML = icons.render(product.id, { size, label: '' });
  } else if (product?.tile?.art) {
    const image = document.createElement('img');
    image.src = `../../${product.tile.art}`;
    image.alt = '';
    target.append(image);
  }
}

// Plays an icon's movement for a while, then lets it come to rest.
function playFor(element, ms = 2400) {
  if (!element) return;
  clearTimeout(element._playTimer);
  element.classList.add('ii-play');
  element._playTimer = setTimeout(() => element.classList.remove('ii-play'), ms);
}

// ---- Rail ----------------------------------------------------------------------------------
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
    iconInto(mark, product, 40);
    button.addEventListener('click', () => select(product.id));
    button.addEventListener('dblclick', () => activate(product.id));
    item.style.setProperty('--order', String(rows.size));
    elements.rail.append(fragment);
    rows.set(product.id, {
      item,
      button,
      mark,
      name: item.querySelector('.rail-name'),
      tag: item.querySelector('.rail-tag'),
      flag: item.querySelector('.rail-flag'),
    });
  }
}

function renderRail() {
  const busy = state.value?.busyTool || '';
  for (const product of products()) {
    const ui = rows.get(product.id);
    if (!ui) continue;
    ui.button.style.setProperty('--accent', `var(--${themeOf(product)})`);
    ui.name.textContent = nameOf(product);
    ui.tag.textContent = TAGS[product.id] || '';
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
  indicator.style.setProperty('--accent', `var(--${themeOf(productFor(state.selected))})`);
  indicator.classList.add('placed');
}

// ---- Hero ----------------------------------------------------------------------------------
function renderLatin(product) {
  const name = delight.meaning(product?.id);
  elements.heroLatin.replaceChildren();
  if (!name) return;
  const word = document.createElement('i');
  word.textContent = name.word;
  elements.heroLatin.append(word, document.createTextNode(`  ${name.gloss}`));
}

function renderHero() {
  const product = selectedProduct();
  const busyTool = state.value?.busyTool || '';
  if (!product) {
    elements.heroName.textContent = 'No products registered';
    elements.heroBlurb.textContent = 'Choose the workspace folder that holds the registered product checkouts.';
    elements.heroDetail.textContent = '';
    elements.heroVersion.textContent = '';
    elements.heroLatin.textContent = '';
    elements.heroMark.replaceChildren();
    elements.heroPrimary.disabled = true;
    elements.whatsNew.hidden = true;
    return;
  }
  const name = nameOf(product);
  const job = jobFor(product.id);
  const action = primaryAction(product);
  // The overlay covers foreground work and an install actually running; a queued install
  // or a background download of an update leaves the product usable.
  const isBusy = busyTool === product.id || Boolean(job && job.kind === 'install' && job.state === 'running');

  elements.hero.style.setProperty('--accent', `var(--${themeOf(product)})`);
  elements.hero.classList.toggle('unavailable', !product.ready);
  if (elements.heroMark.dataset.product !== product.id) {
    iconInto(elements.heroMark, product, 220);
    elements.heroMark.dataset.product = product.id;
  }
  elements.heroName.textContent = name;
  elements.heroVersion.textContent = product.version && product.version !== 'unknown' ? product.version : '';
  renderLatin(product);
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
  elements.heroReport.setAttribute('aria-label', `Report a problem with ${name}`);
  elements.heroReport.title = `Report a problem with ${name}`;

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
  renderWhatsNew(product);
}

// ---- What's new ----------------------------------------------------------------------------
// A product's release notes show on its stage after it reaches that version, until read.
function unreadNotes(product) {
  const notes = product?.releaseNotes;
  if (!notes || !notes.text || notes.version !== product.version) return null;
  const seen = local.get('notesSeen', {});
  return seen[product.id] === notes.version ? null : notes;
}

function renderWhatsNew(product) {
  const notes = unreadNotes(product);
  elements.whatsNew.hidden = !notes;
  if (!notes) return;
  elements.whatsNewTitle.textContent = `What's new in ${nameOf(product)} ${notes.version}`;
  elements.whatsNewNotes.replaceChildren();
  for (const block of delight.noteBlocks(notes.text)) {
    if (block.type === 'para') {
      const paragraph = document.createElement('p');
      paragraph.textContent = block.text;
      elements.whatsNewNotes.append(paragraph);
    } else if (block.type === 'list') {
      const list = document.createElement('ul');
      for (const text of block.items) { const item = document.createElement('li'); item.textContent = text; list.append(item); }
      elements.whatsNewNotes.append(list);
    }
  }
}

$('#whats-new-dismiss').addEventListener('click', () => {
  const product = selectedProduct();
  const notes = product?.releaseNotes;
  if (!notes) return;
  local.set('notesSeen', { ...local.get('notesSeen', {}), [product.id]: notes.version });
  renderWhatsNew(product);
});

// ---- Selection and transitions -------------------------------------------------------------
// Re-running an animation needs the class off, a reflow, then the class on.
// Without the forced reflow the browser coalesces both writes and nothing replays.
function replayHeroEntrance() {
  elements.hero.classList.remove('entering');
  void elements.hero.offsetWidth;
  elements.hero.classList.add('entering');
}

// Hand the outgoing mark to its own layer so it can leave while the new one
// arrives. Without this the old product simply blinks out of existence.
function handOffMark(previousMarkup) {
  const outgoing = elements.heroMarkOut;
  if (!outgoing || !previousMarkup) return;
  outgoing.innerHTML = previousMarkup;
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
function accentNow() {
  return elements.accentProbe ? getComputedStyle(elements.accentProbe).color : '';
}

function syncField({ pulse = false } = {}) {
  const accent = accentNow();
  if (!accent) return;
  elements.shell?.style.setProperty('--accent', accent);
  window.instrumentaField?.setAccent(accent);
  if (!pulse) return;
  const mark = elements.heroMark.getBoundingClientRect();
  window.instrumentaField?.pulse(mark.left + mark.width / 2, mark.top + mark.height / 2);
}

function select(id) {
  if (!productFor(id) || id === state.selected) return;
  const previousMarkup = elements.heroMark.innerHTML;
  elements.hero.style.setProperty('--dir', String(directionBetween(state.selected, id)));
  state.selected = id;
  handOffMark(previousMarkup);
  renderRail();
  renderHero();
  replayHeroEntrance();
  playFor(elements.heroStage, 2600);
  syncField({ pulse: true });
}

// ---- Celebrations --------------------------------------------------------------------------
function celebrate(product, from) {
  if (prefs().celebrate) {
    const ui = rows.get(product.id);
    if (ui) {
      playFor(ui.button, 2600);
      const box = ui.mark.getBoundingClientRect();
      const probe = document.createElement('span');
      probe.style.color = `var(--${themeOf(product)})`;
      document.body.append(probe);
      window.instrumentaField?.burst(box.left + box.width / 2, box.top + box.height / 2, getComputedStyle(probe).color);
      probe.remove();
    }
    toast(`${nameOf(product)} updated itself to ${product.version}${from ? `, from ${from}` : ''}.`);
  }
  journal({ type: 'updated' });
}

// A version that changes between two states while the product stays ready is an update that
// landed; the first state seen only records versions.
function noticeUpdates() {
  for (const product of products()) {
    const before = state.versions.get(product.id);
    const now = product.ready ? product.version : '';
    if (before && now && before !== now) celebrate(product, before);
    if (now) state.versions.set(product.id, now);
  }
  const list = products();
  if (list.length && list.every((product) => product.ready)) journal({ type: 'all-ready' });
}

// ---- Render --------------------------------------------------------------------------------
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
  elements.aboutVersion.textContent = `Version ${nextState.version}${nextState.packaged ? '' : ', running from source'}`;
  renderLauncherUpdate(nextState);
  renderRail();
  renderHero();
  if (elements.appsDialog.open) renderChooser();
  if (!state.painted) {
    state.painted = true;
    replayHeroEntrance();
    playFor(elements.organ, 2600);
  }
  syncField();
  noticeUpdates();
  greet();
  announceLauncherNotes(nextState.launcherNotes);
  // The chooser opens by itself once, on the first run that has something to offer.
  if (!state.chooserOffered && model.shouldOfferChooser(nextState) && !elements.errorDialog.open) {
    state.chooserOffered = true;
    openChooser();
  }
}

// After the launcher updates itself, its own notes arrive once, as a note in the corner.
function announceLauncherNotes(notes) {
  if (!notes?.text || local.get('launcherNotesSeen', '') === notes.version) return;
  local.set('launcherNotesSeen', notes.version);
  const first = delight.noteBlocks(notes.text).find((block) => block.type !== 'gap');
  const line = first?.type === 'list' ? first.items[0] : first?.text || '';
  toast(line, { title: `Instrumenta ${notes.version}` });
}

// Once per session, with the first real state: the journal's day, and the organ's chord.
function greet() {
  if (state.greeted || !products().length) return;
  state.greeted = true;
  journal({ type: 'start' });
  if (prefs().sound) organ.chord(products().filter((product) => product.ready).map((product) => product.id));
}

// ---- App chooser ---------------------------------------------------------------------------
const picked = new Set();
let chooserRows = [];

function renderChooser() {
  const list = model.chooserRows(state.value);
  for (const id of [...picked]) {
    if (!list.some((row) => row.id === id && row.selectable)) picked.delete(id);
  }
  elements.autoUpdate.checked = state.value?.preferences?.autoUpdate !== false;
  elements.appsInstall.disabled = !picked.size;
  elements.appsWorkspace.hidden = !list.some((row) => row.developerOnly);
  if (model.sameRowShape(chooserRows, list) && elements.appsList.children.length === list.length) {
    list.forEach((row, index) => {
      const item = elements.appsList.children[index];
      item.querySelector('.app-status').textContent = row.status;
      item.querySelector('.app-size').textContent = row.size;
    });
    chooserRows = list;
    return;
  }
  chooserRows = list;
  elements.appsList.replaceChildren();
  for (const row of list) {
    const fragment = elements.appRowTemplate.content.cloneNode(true);
    const item = fragment.querySelector('.app-row');
    const pick = fragment.querySelector('.app-pick');
    const mark = fragment.querySelector('.app-mark');
    const auto = fragment.querySelector('.app-auto');
    const autoBox = auto.querySelector('input');
    item.style.setProperty('--accent', `var(--${row.theme})`);
    item.classList.toggle('muted', !row.selectable && row.developerOnly);
    iconInto(mark, { id: row.id, tile: { art: row.art } }, 36);
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
  if (!elements.appsDialog.open) openDialog(elements.appsDialog);
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
  openDialog(elements.settingsDialog);
});

// ---- Launcher self-update ------------------------------------------------------------------
// Instrumenta's own newer version, beside its version number: Update, the download's progress,
// Restart once it is verified. Nothing when this is the newest.
function renderLauncherUpdate(nextState) {
  const view = model.launcherUpdateView(nextState.launcherUpdate);
  const button = elements.launcherUpdate;
  button.hidden = !view;
  if (!view) return;
  button.textContent = view.label;
  button.title = view.title;
  button.dataset.tone = view.tone;
  button.dataset.action = view.action || '';
  button.disabled = !view.action;
}
elements.launcherUpdate.addEventListener('click', () => {
  const action = elements.launcherUpdate.dataset.action;
  if (action) perform(() => window.instrumenta.launcherUpdate(action));
});

// ---- Errors and actions --------------------------------------------------------------------
function showError(error) {
  elements.errorMessage.textContent = error?.message || String(error);
  openDialog(elements.errorDialog);
}

async function perform(operation) {
  try {
    const nextState = await operation();
    if (nextState) render(nextState);
    return true;
  } catch (error) {
    showError(error);
    render(await window.instrumenta.refresh());
    return false;
  }
}

async function activate(id) {
  const product = productFor(id);
  if (!product) return;
  select(id);
  switch (primaryAction(product)) {
    case 'open': {
      if (prefs().sound) organ.note(id);
      playFor(elements.heroStage, 2600);
      const opened = await perform(() => window.instrumenta.launch(id));
      if (opened) journal({ type: 'launch', id });
      return undefined;
    }
    case 'update':
    case 'install': return perform(() => window.instrumenta.install(id));
    case 'prepare': return perform(() => window.instrumenta.prepare(id));
    case 'busy':
    case 'unreleased': return undefined;
    default: openDialog(elements.settingsDialog);
  }
  return undefined;
}

function moveSelection(offset) {
  const list = products();
  if (!list.length) return;
  const index = list.findIndex((product) => product.id === state.selected);
  select(list[(index + offset + list.length) % list.length].id);
}

async function openLink(key) {
  try { await window.instrumenta.openLink(key); } catch (error) { showError(error); }
}

// ---- Toasts --------------------------------------------------------------------------------
function toast(text, { title = '' } = {}) {
  const item = document.createElement('div');
  item.className = 'toast';
  if (title) { const strong = document.createElement('b'); strong.textContent = title; item.append(strong); }
  const body = document.createElement('span');
  body.textContent = text;
  item.append(body);
  elements.toasts.append(item);
  setTimeout(() => item.classList.add('leaving'), 4600);
  setTimeout(() => item.remove(), 5200);
}

// ---- Journal -------------------------------------------------------------------------------
function journal(event) {
  const { journal: next, earned } = delight.record(local.get('journal', null), event);
  local.set('journal', next);
  for (const milestone of earned) toast(milestone.text, { title: milestone.title });
}

function renderJournal() {
  const kept = delight.normaliseJournal(local.get('journal', null));
  const earned = delight.MILESTONES.filter((m) => kept.earned[m.key]);
  elements.journalSummary.textContent = `${earned.length} of ${delight.MILESTONES.length} found. Apps opened ${kept.total} ${kept.total === 1 ? 'time' : 'times'}, on ${kept.days.length} ${kept.days.length === 1 ? 'day' : 'days'} recently.`;
  elements.journalList.replaceChildren();
  for (const milestone of delight.MILESTONES) {
    const when = kept.earned[milestone.key];
    const item = document.createElement('li');
    item.className = when ? 'earned' : 'unearned';
    const title = document.createElement('b');
    title.textContent = when ? milestone.title : 'Not yet';
    const text = document.createElement('span');
    text.textContent = when ? milestone.text : milestone.hint;
    const date = document.createElement('time');
    if (when) { date.dateTime = when; date.textContent = new Date(when).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }); }
    item.append(title, text, date);
    elements.journalList.append(item);
  }
}

// ---- The organ in the masthead -------------------------------------------------------------
elements.organ.innerHTML = icons.render('instrumenta', { size: 44, label: '' });
$('#about-organ').innerHTML = icons.render('instrumenta', { size: 96, label: '' });
let organClicks = [];
elements.organ.addEventListener('click', () => {
  const now = Date.now();
  organClicks = organClicks.filter((time) => now - time < 2600).concat(now);
  playFor(elements.organ, 2000);
  if (organClicks.length >= 7) {
    organClicks = [];
    const seconds = organ.tune();
    playFor(elements.organ, seconds * 1000 + 600);
    journal({ type: 'tune' });
    return;
  }
  if (prefs().sound) organ.note('instrumenta', 0.6);
});

// ---- About, credits, links -----------------------------------------------------------------
$('#about-button').addEventListener('click', () => openDialog(elements.aboutDialog));
$('#bonehead-link').addEventListener('click', () => openLink('site'));
document.querySelectorAll('[data-link]').forEach((button) => button.addEventListener('click', () => openLink(button.dataset.link)));
elements.heroReport.addEventListener('click', () => openLink(`issues:${state.selected}`));

function rollCredits() {
  elements.creditsRoll.replaceChildren();
  const opening = document.createElement('div');
  opening.className = 'credits-title';
  opening.innerHTML = icons.render('instrumenta', { size: 120, label: '' });
  const name = document.createElement('h3');
  name.textContent = 'Instrumenta';
  opening.append(name);
  elements.creditsRoll.append(opening);
  for (const section of delight.CREDITS) {
    const block = document.createElement('section');
    const heading = document.createElement('h4');
    heading.textContent = section.heading;
    block.append(heading);
    if (hasIcon(section.heading.toLowerCase())) {
      const mark = document.createElement('span');
      mark.className = 'credits-mark';
      mark.innerHTML = icons.render(section.heading.toLowerCase(), { size: 48, label: '' });
      block.prepend(mark);
    }
    for (const line of section.lines) { const p = document.createElement('p'); p.textContent = line; block.append(p); }
    elements.creditsRoll.append(block);
  }
  const end = document.createElement('p');
  end.className = 'credits-end';
  end.textContent = 'Thank you for making things.';
  elements.creditsRoll.append(end);
  elements.creditsRoll.classList.remove('rolling');
  void elements.creditsRoll.offsetWidth;
  elements.creditsRoll.classList.add('rolling');
}
$('#credits-button').addEventListener('click', () => {
  elements.aboutDialog.close();
  rollCredits();
  openDialog(elements.creditsDialog);
  journal({ type: 'credits' });
  if (prefs().sound) organ.chord(Object.keys(delight.NOTES));
});
$('#credits-replay').addEventListener('click', rollCredits);

// ---- Storage -------------------------------------------------------------------------------
// The last answer shows at once; a fresh one replaces it when it arrives.
let lastStorage = null;
async function loadStorage() {
  if (lastStorage) renderStorage(lastStorage, true);
  else { elements.storageSummary.textContent = 'Measuring…'; elements.storageList.replaceChildren(); }
  let report;
  try { report = await window.instrumenta.storage(); } catch (error) { elements.storageSummary.textContent = error?.message || String(error); return; }
  lastStorage = report;
  renderStorage(report, false);
}

function renderStorage(report, stale) {
  elements.storageList.replaceChildren();
  const format = model.formatBytes;
  elements.storageSummary.textContent = `The apps and their downloads use ${format(report.total)} on this computer${Number.isFinite(report.free) ? `. ${format(report.free)} is free on that drive.` : '.'}${stale ? ' Measuring again…' : ''}`;
  for (const entry of report.items) {
    const item = document.createElement('li');
    const mark = document.createElement('span');
    mark.className = 'panel-mark';
    if (hasIcon(entry.product)) mark.innerHTML = icons.render(entry.product, { size: 32, label: '' });
    const text = document.createElement('span');
    text.className = 'panel-text';
    const title = document.createElement('b');
    title.textContent = entry.label;
    const note = document.createElement('small');
    note.textContent = entry.note || entry.path || '';
    text.append(title, note);
    const size = document.createElement('span');
    size.className = 'panel-size';
    size.textContent = entry.bytes === null ? 'unknown' : format(entry.bytes);
    item.append(mark, text, size);
    if (entry.clean) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'secondary small';
      button.textContent = entry.clean.label;
      button.title = entry.clean.detail || '';
      button.addEventListener('click', async () => {
        button.disabled = true;
        try {
          await window.instrumenta.clean(entry.clean.key);
          journal({ type: 'cleaned' });
          toast(`${entry.label}: cleaned up.`);
        } catch (error) { showError(error); }
        loadStorage();
      });
      item.append(button);
    }
    elements.storageList.append(item);
  }
}
$('#storage-button').addEventListener('click', () => { openDialog(elements.storageDialog); loadStorage(); });
$('#storage-refresh').addEventListener('click', loadStorage);

// ---- Readiness -----------------------------------------------------------------------------
const READY_WORDS = { ok: 'Ready', missing: 'Missing', warn: 'Check', unknown: 'Unknown' };
let lastReadiness = null;
async function loadReadiness() {
  if (lastReadiness) renderReadiness(lastReadiness, true);
  else { elements.readinessSummary.textContent = 'Checking this computer…'; elements.readinessChecks.replaceChildren(); elements.readinessProducts.replaceChildren(); }
  let report;
  try { report = await window.instrumenta.readiness(); } catch (error) { elements.readinessSummary.textContent = error?.message || String(error); return; }
  lastReadiness = report;
  renderReadiness(report, false);
}

function renderReadiness(report, stale) {
  elements.readinessChecks.replaceChildren();
  elements.readinessProducts.replaceChildren();
  const missing = report.checks.filter((check) => check.state === 'missing').length;
  elements.readinessSummary.textContent = `${missing ? `${missing} of ${report.checks.length} things are missing. Each app below says what it needs.` : 'This computer has everything the apps need.'}${stale ? ' Checking again…' : ''}`;
  for (const check of report.checks) {
    const item = document.createElement('li');
    const badge = document.createElement('span');
    badge.className = `badge ${check.state}`;
    badge.textContent = READY_WORDS[check.state] || check.state;
    const text = document.createElement('span');
    text.className = 'panel-text';
    const title = document.createElement('b');
    title.textContent = check.label;
    const note = document.createElement('small');
    note.textContent = check.detail || '';
    text.append(title, note);
    item.append(badge, text);
    elements.readinessChecks.append(item);
  }
  for (const entry of report.products) {
    const item = document.createElement('li');
    const mark = document.createElement('span');
    mark.className = 'panel-mark';
    if (hasIcon(entry.id)) mark.innerHTML = icons.render(entry.id, { size: 24, label: '' });
    const text = document.createElement('span');
    text.className = 'panel-text';
    const title = document.createElement('b');
    title.textContent = entry.name;
    const note = document.createElement('small');
    note.textContent = entry.summary;
    text.append(title, note);
    const badge = document.createElement('span');
    badge.className = `badge ${entry.state}`;
    badge.textContent = READY_WORDS[entry.state] || entry.state;
    item.append(mark, text, badge);
    elements.readinessProducts.append(item);
  }
}
$('#readiness-button').addEventListener('click', () => { openDialog(elements.readinessDialog); loadReadiness(); });
$('#readiness-refresh').addEventListener('click', loadReadiness);

// ---- Journal and settings ------------------------------------------------------------------
$('#journal-button').addEventListener('click', () => { renderJournal(); openDialog(elements.journalDialog); });

const prefSound = $('#pref-sound');
const prefCelebrate = $('#pref-celebrate');
const prefAmbience = $('#pref-ambience');
const prefTheme = $('#pref-theme');
function syncPrefControls() {
  const current = prefs();
  prefSound.checked = current.sound;
  prefCelebrate.checked = current.celebrate;
  prefAmbience.value = current.ambience;
  prefTheme.value = current.theme;
}
prefSound.addEventListener('change', () => { local.set('sound', prefSound.checked); if (prefSound.checked) organ.note('instrumenta', 0.6); });
prefCelebrate.addEventListener('change', () => local.set('celebrate', prefCelebrate.checked));
prefTheme.addEventListener('change', () => { local.set('theme', prefTheme.value); applyTheme(); });
prefAmbience.addEventListener('change', () => { local.set('ambience', prefAmbience.value); applyAmbience(); });

function applyAmbience() {
  const choice = prefs().ambience;
  let timeZone = '';
  try { timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch { /* default */ }
  const season = delight.ambienceFor(new Date(), timeZone);
  const mode = choice === 'off' ? 'off' : choice === 'motes' ? 'motes' : season.mode;
  window.instrumentaField?.setMode(mode);
  elements.ambienceLabel.textContent = choice === 'seasons' ? season.label : '';
}
setInterval(applyAmbience, 10 * 60 * 1000);

// ---- Wiring --------------------------------------------------------------------------------
elements.heroPrimary.addEventListener('click', () => activate(state.selected));
elements.heroReveal.addEventListener('click', () => perform(() => window.instrumenta.reveal(state.selected)));
elements.heroUpdate.addEventListener('click', () => perform(() => window.instrumenta.install(state.selected)));
elements.heroRollback.addEventListener('click', () => perform(() => window.instrumenta.rollback(state.selected)));
elements.heroUninstall.addEventListener('click', () => perform(() => window.instrumenta.uninstall(state.selected)));
$('#add-product').addEventListener('click', () => openChooser());
$('#refresh-button').addEventListener('click', () => perform(() => window.instrumenta.refresh()));
$('#workspace-button').addEventListener('click', () => perform(() => window.instrumenta.openWorkspace()));
$('#settings-button').addEventListener('click', () => { syncPrefControls(); openDialog(elements.settingsDialog); });
elements.workspacePath.addEventListener('click', () => perform(() => window.instrumenta.chooseWorkspace()));
$('#choose-workspace-button').addEventListener('click', () => perform(() => window.instrumenta.chooseWorkspace()));

document.addEventListener('keydown', (event) => {
  if (anyDialogOpen()) return;
  if ((event.ctrlKey || event.metaKey) && event.key === ',') { syncPrefControls(); openDialog(elements.settingsDialog); return; }
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
applyAmbience();
window.instrumenta.onState(render);
perform(() => window.instrumenta.getState());
