// Leonida Legend — trophy checklist, filters, spoiler mode and progress saving.
// Loads app/data/trophies.json (same origin, no other request is ever made) and
// keeps the earned set in localStorage so the tracker survives a reload.

const DATA_URL = 'data/trophies.json';
const STORAGE_KEY = 'leonida-legend-progress-v1';
const TOTAL = 55;
// Demo preset: the first fourteen non-platinum trophies, so ?demo=1 reads 14 / 55.
const DEMO_EARNED = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];

const grid = document.getElementById('grid');
const emptyNote = document.getElementById('empty');
const progressText = document.getElementById('progress-text');
const progressPercent = document.getElementById('progress-percent');
const progressFill = document.getElementById('progress-fill');
const searchBox = document.getElementById('search');
const spoilerBox = document.getElementById('spoiler');
const detailPanel = document.getElementById('detail');
const filterStatus = document.getElementById('filter-status');
const kindChips = document.getElementById('kind-chips');

let trophies = [];
let earned = new Set();
let openId = null;
let kindFilter = 'all';

const params = new URLSearchParams(location.search);
const demoMode = params.get('demo') === '1';

function loadStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    const ids = Array.isArray(parsed) ? parsed : parsed.earned;
    return new Set((ids || []).filter((id) => Number.isInteger(id)));
  } catch {
    return new Set();
  }
}

function saveStored() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ app: 'leonida-legend', earned: [...earned].sort((a, b) => a - b) }));
  } catch {
    // Private mode or full storage: the checklist still works for this visit.
  }
}

function isHiddenFromViewer(trophy) {
  return spoilerBox.checked && trophy.hidden && !earned.has(trophy.id);
}

function visibleName(trophy) {
  return isHiddenFromViewer(trophy) ? 'Hidden trophy' : trophy.name;
}

function visibleDescription(trophy) {
  return isHiddenFromViewer(trophy)
    ? 'Hidden until earned — spoiler mode is on.'
    : trophy.description;
}

function badge(label, cls) {
  const span = document.createElement('span');
  span.className = 'badge ' + cls;
  span.textContent = label;
  return span;
}

function sourceList(trophy) {
  const wrap = document.createElement('div');
  const label = document.createElement('p');
  label.className = 'sources-label';
  label.textContent = 'Sources';
  wrap.appendChild(label);
  const list = document.createElement('ul');
  list.className = 'sources';
  for (const source of trophy.sources || []) {
    const item = document.createElement('li');
    const link = document.createElement('a');
    link.href = source.url;
    link.textContent = source.name;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    item.appendChild(link);
    list.appendChild(item);
  }
  wrap.appendChild(list);
  return wrap;
}

function renderDetail() {
  const trophy = trophies.find((t) => t.id === openId);
  detailPanel.querySelectorAll('*').forEach((el) => el.remove());
  if (!trophy) {
    detailPanel.hidden = true;
    return;
  }
  detailPanel.hidden = false;
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'detail-close';
  close.textContent = 'Close ×';
  close.addEventListener('click', () => { openId = null; render(); });
  detailPanel.appendChild(close);

  const title = document.createElement('h2');
  title.textContent = visibleName(trophy);
  detailPanel.appendChild(title);

  const desc = document.createElement('p');
  desc.className = 'detail-desc';
  desc.textContent = visibleDescription(trophy);
  detailPanel.appendChild(desc);

  const badges = document.createElement('div');
  badges.className = 'badges';
  badges.appendChild(badge(trophy.grade, trophy.grade));
  badges.appendChild(badge(trophy.kind, 'kind'));
  if (trophy.missable) badges.appendChild(badge('Missable', 'missable-flag'));
  if (trophy.hidden) badges.appendChild(badge('Hidden', 'hidden-flag'));
  if (trophy.count != null) badges.appendChild(badge('Count: ' + trophy.count, 'kind'));
  detailPanel.appendChild(badges);

  if (isHiddenFromViewer(trophy)) {
    const masked = document.createElement('p');
    masked.className = 'detail-guide spoiler-hidden';
    masked.textContent = 'This trophy is hidden on PlayStation until earned. Earn it (or turn spoiler mode off) to read its guide.';
    detailPanel.appendChild(masked);
    return;
  }

  const guide = document.createElement('p');
  guide.className = 'detail-guide';
  guide.textContent = trophy.guide;
  detailPanel.appendChild(guide);

  if (trophy.missable) {
    const warn = document.createElement('p');
    warn.className = 'detail-guide';
    warn.textContent = 'Missable: this is the list’s only missable trophy. Start its 18 meditation spots in Chapter 1 — the first spot is gone once that chapter closes.';
    detailPanel.appendChild(warn);
  }
  detailPanel.appendChild(sourceList(trophy));
}

function trophyMatches(trophy) {
  if (kindFilter === 'missable' && !trophy.missable) return false;
  if (kindFilter === 'online' && trophy.kind !== 'online') return false;
  if (kindFilter !== 'all' && kindFilter !== 'missable' && kindFilter !== 'online' && trophy.kind !== kindFilter) return false;
  const query = searchBox.value.trim().toLowerCase();
  if (!query) return true;
  const haystack = [trophy.name, trophy.description, trophy.guide].join(' ').toLowerCase();
  return haystack.includes(query);
}

function renderCard(trophy) {
  const card = document.createElement('article');
  card.className = 'card' + (earned.has(trophy.id) ? ' earned' : '') + (openId === trophy.id ? ' open' : '');
  card.dataset.trophyId = String(trophy.id);

  const top = document.createElement('div');
  top.className = 'card-top';
  const check = document.createElement('input');
  check.type = 'checkbox';
  check.className = 'card-check';
  check.checked = earned.has(trophy.id);
  check.setAttribute('aria-label', 'Earned: ' + visibleName(trophy));
  check.addEventListener('click', (event) => {
    event.stopPropagation();
    if (check.checked) earned.add(trophy.id); else earned.delete(trophy.id);
    saveStored();
    render();
  });
  top.appendChild(check);
  const name = document.createElement('h3');
  name.className = 'card-name';
  name.textContent = visibleName(trophy);
  top.appendChild(name);
  card.appendChild(top);

  const desc = document.createElement('p');
  desc.className = 'card-desc';
  desc.textContent = visibleDescription(trophy);
  card.appendChild(desc);

  const badges = document.createElement('div');
  badges.className = 'badges';
  badges.appendChild(badge(trophy.grade, trophy.grade));
  badges.appendChild(badge(trophy.kind, 'kind'));
  if (trophy.missable) badges.appendChild(badge('Missable', 'missable-flag'));
  if (trophy.hidden) badges.appendChild(badge('Hidden', 'hidden-flag'));
  card.appendChild(badges);

  if (isHiddenFromViewer(trophy)) {
    const masked = document.createElement('p');
    masked.className = 'card-guide spoiler-hidden';
    masked.textContent = 'Guide hidden by spoiler mode.';
    card.appendChild(masked);
  } else {
    const guide = document.createElement('p');
    guide.className = 'card-guide';
    guide.textContent = trophy.guide;
    card.appendChild(guide);
    if (trophy.count != null) {
      const count = document.createElement('p');
      count.className = 'card-count';
      count.textContent = 'Tracked count: ' + trophy.count;
      card.appendChild(count);
    }
    const sources = document.createElement('p');
    sources.className = 'card-sources';
    sources.textContent = 'Sources: ';
    (trophy.sources || []).forEach((source, i) => {
      if (i > 0) sources.appendChild(document.createTextNode(', '));
      const link = document.createElement('a');
      link.href = source.url;
      link.textContent = source.name;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      sources.appendChild(link);
    });
    card.appendChild(sources);
  }

  card.addEventListener('click', () => {
    openId = openId === trophy.id ? null : trophy.id;
    render();
  });
  return card;
}

function renderProgress() {
  const n = earned.size;
  progressText.textContent = n + ' / ' + TOTAL;
  progressPercent.textContent = Math.round((n / TOTAL) * 100) + '% to the platinum';
  progressFill.style.width = (n / TOTAL) * 100 + '%';
}

function renderRoadmapCounts() {
  document.querySelectorAll('.stage-count').forEach((el) => {
    const stage = Number(el.dataset.stage);
    const n = trophies.filter((t) => t.stage === stage).length;
    el.textContent = '(' + n + ' trophies)';
  });
}

function render() {
  renderProgress();
  renderDetail();
  grid.querySelectorAll('*').forEach((el) => el.remove());
  const shown = trophies.filter(trophyMatches);
  for (const trophy of shown) grid.appendChild(renderCard(trophy));
  emptyNote.hidden = shown.length !== 0;
  const kindLabel = kindFilter === 'all' ? '' : ' — ' + kindFilter + ' only';
  const queryLabel = searchBox.value.trim() ? ' — matching “' + searchBox.value.trim() + '”' : '';
  filterStatus.textContent = 'Showing ' + shown.length + ' of ' + trophies.length + ' trophies' + kindLabel + queryLabel + '.';
}

function setKind(kind) {
  kindFilter = kind;
  kindChips.querySelectorAll('.chip').forEach((chip) => {
    chip.classList.toggle('active', chip.dataset.kind === kind);
  });
  render();
}

function exportProgress() {
  const payload = { app: 'leonida-legend', game: 'Grand Theft Auto VI', earned: [...earned].sort((a, b) => a - b) };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'leonida-legend-progress.json';
  anchor.click();
  URL.revokeObjectURL(url);
}

function importProgressText(text) {
  const parsed = JSON.parse(text);
  const ids = Array.isArray(parsed) ? parsed : parsed.earned;
  if (!Array.isArray(ids)) throw new Error('progress file must hold an earned list');
  const valid = new Set(trophies.map((t) => t.id));
  const next = new Set();
  for (const id of ids) {
    if (valid.has(id)) next.add(id);
  }
  earned = next;
  saveStored();
  render();
  return earned.size;
}

kindChips.addEventListener('click', (event) => {
  const chip = event.target.closest('.chip');
  if (chip) setKind(chip.dataset.kind);
});
searchBox.addEventListener('input', render);
spoilerBox.addEventListener('change', render);
document.getElementById('export').addEventListener('click', exportProgress);
document.getElementById('import').addEventListener('change', async (event) => {
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  try {
    const count = importProgressText(await file.text());
    filterStatus.textContent = 'Imported progress: ' + count + ' trophies earned.';
  } catch {
    filterStatus.textContent = 'That file could not be imported — it needs an earned list of trophy ids.';
  }
  event.target.value = '';
});
document.getElementById('reset').addEventListener('click', () => {
  if (window.confirm('Clear all earned trophies?')) {
    earned = new Set();
    saveStored();
    render();
  }
});

async function start() {
  const response = await fetch(DATA_URL);
  const data = await response.json();
  trophies = data.trophies || data;
  earned = loadStored();
  if (demoMode) earned = new Set(DEMO_EARNED);
  const openParam = Number(params.get('open'));
  if (Number.isInteger(openParam) && trophies.some((t) => t.id === openParam)) openId = openParam;
  const view = params.get('view');
  if (view === 'missable') {
    kindFilter = 'missable';
    kindChips.querySelectorAll('.chip').forEach((chip) => {
      chip.classList.toggle('active', chip.dataset.kind === 'missable');
    });
  }
  if (view === 'spoiler') spoilerBox.checked = true;
  render();
  renderRoadmapCounts();
  if (view === 'roadmap') {
    document.getElementById('roadmap').scrollIntoView();
  }
}

// Small hook for the maker's own verification runs; not part of the guide's UI.
window.__leonida = {
  get earned() { return [...earned].sort((a, b) => a - b); },
  get total() { return trophies.length; },
  exportText() {
    return JSON.stringify({ app: 'leonida-legend', game: 'Grand Theft Auto VI', earned: [...earned].sort((a, b) => a - b) }, null, 2);
  },
  importText(text) { return importProgressText(text); },
};

start();
