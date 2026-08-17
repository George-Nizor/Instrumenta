const state = { value: null };
const cards = new Map();

const elements = {
  grid: document.querySelector('#instrument-grid'),
  activity: document.querySelector('#activity'),
  signal: document.querySelector('#signal'),
  version: document.querySelector('#version'),
  workspacePath: document.querySelector('#workspace-path'),
  settingsPath: document.querySelector('#settings-path'),
  settingsDialog: document.querySelector('#settings-dialog'),
  errorDialog: document.querySelector('#error-dialog'),
  errorMessage: document.querySelector('#error-message'),
};

function icon(path) {
  return `<svg viewBox="0 0 24 24"><path d="${path}"/></svg>`;
}

function buildCards(products) {
  elements.grid.replaceChildren();
  cards.clear();
  for (const product of products) {
    const article = document.createElement('article');
    const theme = product.tile?.theme || product.id;
    article.className = `instrument ${product.id} theme-${theme}`;
    article.style.setProperty('--order', String(cards.size));
    article.dataset.tool = product.id;
    const art = product.tile?.art ? `../../${product.tile.art}` : '';
    article.innerHTML = `
      ${art ? `<img class="instrument-art" src="${art}" alt="">` : '<div class="instrument-art placeholder-art" aria-hidden="true"></div>'}
      <div class="art-vignette"></div><div class="art-sheen"></div>
      <button class="launch-surface" type="button"></button>
      <div class="instrument-heading"><h1></h1><span class="state-dot"><span class="sr-only"></span></span></div>
      <div class="card-actions">
        <button class="card-action rebuild" type="button">${icon('M20 7v5h-5M4 17v-5h5M6.1 8.1A7 7 0 0 1 18.7 7M17.9 15.9A7 7 0 0 1 5.3 17')}</button>
        <button class="card-action folder" type="button">${icon('M3.5 6.5h6l2 2h9v9.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2V6.5Z')}</button>
      </div>
      <div class="busy-indicator" aria-hidden="true"><span></span></div>
      <span class="detail sr-only"></span>`;
    elements.grid.append(article);
    const ui = {
      card: article,
      heading: article.querySelector('h1'),
      state: article.querySelector('.state-dot .sr-only'),
      dot: article.querySelector('.state-dot'),
      detail: article.querySelector('.detail'),
      primary: article.querySelector('.launch-surface'),
      folder: article.querySelector('.folder'),
      rebuild: article.querySelector('.rebuild'),
    };
    ui.primary.addEventListener('click', () => activate(product.id));
    ui.folder.addEventListener('click', () => perform(() => window.instrumenta.reveal(product.id)));
    ui.rebuild.addEventListener('click', () => perform(() => window.instrumenta.prepare(product.id)));
    ui.card.addEventListener('pointermove', (event) => {
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      const bounds = ui.card.getBoundingClientRect();
      const x = (event.clientX - bounds.left) / bounds.width;
      const y = (event.clientY - bounds.top) / bounds.height;
      ui.card.style.setProperty('--rx', `${(0.5 - y) * 2.2}deg`);
      ui.card.style.setProperty('--ry', `${(x - 0.5) * 2.8}deg`);
      ui.card.style.setProperty('--mx', `${x * 100}%`);
      ui.card.style.setProperty('--my', `${y * 100}%`);
    });
    ui.card.addEventListener('pointerleave', () => {
      ui.card.style.setProperty('--rx', '0deg');
      ui.card.style.setProperty('--ry', '0deg');
    });
    cards.set(product.id, ui);
  }
}

function renderTool(toolState, busyTool) {
  const ui = cards.get(toolState.id);
  if (!ui) return;
  const name = toolState.displayName || toolState.id;
  const isBusy = busyTool === toolState.id;
  ui.heading.textContent = name;
  ui.card.classList.toggle('busy', isBusy);
  ui.card.classList.toggle('unavailable', !toolState.ready);
  ui.state.textContent = isBusy ? 'Preparing' : toolState.state;
  ui.dot.className = `state-dot ${toolState.ready ? 'ready' : 'error'}`;
  ui.detail.textContent = toolState.detail;
  ui.card.title = toolState.detail;
  ui.primary.disabled = Boolean(busyTool) || (!toolState.ready && !toolState.canPrepare);
  ui.primary.setAttribute('aria-label', isBusy
    ? `Preparing ${name}`
    : toolState.ready ? `Open ${name}` : toolState.canPrepare ? `Prepare ${name}` : `Locate ${name}`);
  ui.folder.disabled = !toolState.location;
  ui.rebuild.disabled = Boolean(busyTool) || !toolState.canPrepare;
  ui.rebuild.setAttribute('aria-label', toolState.canPrepare ? `Prepare ${name}` : `Refresh ${name}`);
  ui.rebuild.title = toolState.canPrepare ? `Prepare ${name}` : `Refresh ${name}`;
  ui.folder.setAttribute('aria-label', `Reveal ${name}`);
  ui.folder.title = `Reveal ${name}`;
}

function render(nextState) {
  state.value = nextState;
  const products = Array.isArray(nextState.products) ? nextState.products : [];
  if (products.length !== cards.size || products.some((product) => !cards.has(product.id))) buildCards(products);
  elements.workspacePath.textContent = nextState.workspace || 'Choose the Instrumenta workspace';
  elements.workspacePath.title = nextState.workspace || '';
  elements.settingsPath.textContent = nextState.workspace || 'No workspace selected';
  elements.activity.textContent = nextState.activity;
  elements.version.textContent = `${nextState.version}${nextState.packaged ? '' : ' · dev'}`;
  const allReady = products.length > 0 && products.filter((product) => product.packagePolicy !== 'optional').every((product) => product.ready);
  elements.signal.className = `suite-signal ${allReady ? 'ready' : ''}`;
  products.forEach((product) => renderTool(product, nextState.busyTool));
}

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

async function activate(tool) {
  const toolState = state.value?.[tool] || state.value?.products?.find((product) => product.id === tool);
  if (!toolState) return;
  if (toolState.ready) await perform(() => window.instrumenta.launch(tool));
  else if (toolState.canPrepare) await perform(() => window.instrumenta.prepare(tool));
  else elements.settingsDialog.showModal();
}

document.querySelector('#refresh-button').addEventListener('click', () => perform(() => window.instrumenta.refresh()));
document.querySelector('#workspace-button').addEventListener('click', () => perform(() => window.instrumenta.openWorkspace()));
document.querySelector('#settings-button').addEventListener('click', () => elements.settingsDialog.showModal());
elements.workspacePath.addEventListener('click', () => elements.settingsDialog.showModal());
document.querySelector('#choose-workspace-button').addEventListener('click', async () => {
  await perform(() => window.instrumenta.chooseWorkspace());
  elements.settingsDialog.close();
});

document.addEventListener('keydown', (event) => {
  if (elements.settingsDialog.open || elements.errorDialog.open) return;
  const products = state.value?.products || [];
  const product = products[Number(event.key) - 1];
  if (product) activate(product.id);
  if ((event.ctrlKey || event.metaKey) && event.key === ',') elements.settingsDialog.showModal();
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'r') {
    event.preventDefault();
    perform(() => window.instrumenta.refresh());
  }
});

window.instrumenta.onState(render);
perform(() => window.instrumenta.getState());
