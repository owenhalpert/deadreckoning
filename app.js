// ============================================================
// Markov's Dead — Grateful Dead Setlist Navigator
// ============================================================

// ── State ───────────────────────────────────────────────────
const allShows   = { gd: [], dandc: [] };
let currentBand  = 'gd';
let selectedPath = [];   // songs chosen so far (ordered)
let freePlay     = false; // false = prefix (from opener), true = substring (anywhere)

// ── DOM refs ─────────────────────────────────────────────────
const loadingScreen  = document.getElementById('loading-screen');
const btnGd          = document.getElementById('btn-gd');
const btnDandc       = document.getElementById('btn-dandc');
const btnOpener      = document.getElementById('btn-opener');
const btnFreePlay    = document.getElementById('btn-freeplay');
const pathSection    = document.getElementById('path-section');
const pathInner      = document.getElementById('path-inner');
const btnInfo        = document.getElementById('btn-info');
const modalInfo      = document.getElementById('modal-info');
const modalBackdrop  = document.getElementById('modal-backdrop');
const modalClose     = document.getElementById('modal-close');
const btnBack        = document.getElementById('btn-back');
const btnRestart     = document.getElementById('btn-restart');
const counterNumber  = document.getElementById('counter-number');
const counterLabel   = document.getElementById('counter-label');
const promptText     = document.getElementById('prompt-text');
const optionsGrid    = document.getElementById('options-grid');
const showReveal     = document.getElementById('show-reveal');

// ── Bootstrap ────────────────────────────────────────────────
async function init() {
  try {
    const [gdRes, dandcRes] = await Promise.all([
      fetch('./data/setlists.json'),
      fetch('./data/dandc.json').catch(() => null),
    ]);

    if (!gdRes.ok) throw new Error(`HTTP ${gdRes.status}`);
    allShows.gd = await gdRes.json();

    if (dandcRes?.ok) {
      allShows.dandc = await dandcRes.json();
    } else {
      // D&C data not yet fetched — disable that button
      btnDandc.disabled = true;
      btnDandc.title = 'Run: npm run fetch:dandc';
    }

    hideLoading();
    history.replaceState({ band: currentBand, path: [], mode: 'opener' }, '');
    renderState();
  } catch (err) {
    console.error(err);
    document.querySelector('.loading-text').textContent =
      'Could not load setlists. Run: npm run fetch';
  }
}

function hideLoading() {
  loadingScreen.classList.add('fade-out');
  setTimeout(() => { loadingScreen.hidden = true; }, 580);
}

// ── Event handlers ───────────────────────────────────────────
[btnGd, btnDandc].forEach(btn => {
  btn.addEventListener('click', () => {
    if (btn.disabled || btn.classList.contains('active')) return;
    currentBand = btn.dataset.band;
    btnGd.classList.toggle('active', currentBand === 'gd');
    btnDandc.classList.toggle('active', currentBand === 'dandc');
    selectedPath = [];
    history.pushState({ band: currentBand, path: [], mode: freePlay ? 'freeplay' : 'opener' }, '');
    renderState();
  });
});

[btnOpener, btnFreePlay].forEach(btn => {
  btn.addEventListener('click', () => {
    if (btn.classList.contains('active')) return;
    freePlay = btn.dataset.mode === 'freeplay';
    btnOpener.classList.toggle('active', !freePlay);
    btnFreePlay.classList.toggle('active', freePlay);
    selectedPath = [];
    history.pushState({ band: currentBand, path: [], mode: freePlay ? 'freeplay' : 'opener' }, '');
    renderState();
  });
});

btnInfo.addEventListener('click', openModal);
modalClose.addEventListener('click', closeModal);
modalBackdrop.addEventListener('click', closeModal);
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

function openModal() {
  modalInfo.hidden     = false;
  modalBackdrop.hidden = false;
  modalInfo.removeAttribute('aria-hidden');
  modalBackdrop.removeAttribute('aria-hidden');
  modalClose.focus();
}

function closeModal() {
  modalInfo.hidden     = true;
  modalBackdrop.hidden = true;
  modalInfo.setAttribute('aria-hidden', 'true');
  modalBackdrop.setAttribute('aria-hidden', 'true');
  btnInfo.focus();
}

btnBack.addEventListener('click', () => {
  if (selectedPath.length > 0) history.back();
});

btnRestart.addEventListener('click', restart);

window.addEventListener('popstate', e => {
  const state = e.state;
  if (!state) return;
  if (state.band && state.band !== currentBand) {
    currentBand = state.band;
    btnGd.classList.toggle('active', currentBand === 'gd');
    btnDandc.classList.toggle('active', currentBand === 'dandc');
  }
  if (state.mode) {
    freePlay = state.mode === 'freeplay';
    btnOpener.classList.toggle('active', !freePlay);
    btnFreePlay.classList.toggle('active', freePlay);
  }
  selectedPath = state.path ?? [];
  renderState();
});

function restart() {
  selectedPath = [];
  history.pushState({ band: currentBand, path: [], mode: freePlay ? 'freeplay' : 'opener' }, '');
  renderState();
}

// ── Core data logic ──────────────────────────────────────────

// Shows whose songs array starts with selectedPath (exact prefix match).
function getMatchingShows() {
  const n = selectedPath.length;
  return allShows[currentBand].filter(show => {
    if (show.songs.length < n) return false;
    for (let i = 0; i < n; i++) {
      if (show.songs[i] !== selectedPath[i]) return false;
    }
    return true;
  });
}

// Distribution of next songs across a set of matching shows,
// sorted by frequency desc, then alphabetically.
function getNextOptions(shows) {
  const counts = Object.create(null);
  const pos = selectedPath.length;
  for (const show of shows) {
    const next = show.songs[pos];
    if (next !== undefined) counts[next] = (counts[next] ?? 0) + 1;
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([song, count]) => ({ song, count }));
}

// ── Free Play core logic ──────────────────────────────────────

// All start indices where path appears as a contiguous subsequence in songs.
function findPositions(songs, path) {
  const positions = [];
  const n = path.length;
  outer: for (let i = 0; i <= songs.length - n; i++) {
    for (let j = 0; j < n; j++) {
      if (songs[i + j] !== path[j]) continue outer;
    }
    positions.push(i);
  }
  return positions;
}

// Shows that contain selectedPath as a contiguous substring anywhere in songs[].
function getMatchingShowsFreePlay() {
  const n = selectedPath.length;
  if (n === 0) return allShows[currentBand];
  return allShows[currentBand].filter(show =>
    findPositions(show.songs, selectedPath).length > 0
  );
}

// Distribution of next songs across all matching positions in all shows.
function getNextOptionsFreePlay(shows) {
  const counts = Object.create(null);
  const n = selectedPath.length;
  for (const show of shows) {
    const positions = n === 0
      ? show.songs.map((_, i) => i)
      : findPositions(show.songs, selectedPath);
    const seen = new Set();
    for (const pos of positions) {
      const next = show.songs[pos + n];
      if (next !== undefined && !seen.has(next)) {
        seen.add(next);
        counts[next] = (counts[next] ?? 0) + 1;
      }
    }
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([song, count]) => ({ song, count }));
}

// ── Render orchestrator ───────────────────────────────────────
function renderState() {
  const matching = freePlay ? getMatchingShowsFreePlay() : getMatchingShows();
  const options  = freePlay ? getNextOptionsFreePlay(matching) : getNextOptions(matching);

  // Has the user navigated to a unique show (or exhausted all songs in the
  // remaining shows, which is functionally the same end-state)?
  const isFound = matching.length === 1 || (options.length === 0 && matching.length > 0);

  renderPath();
  updatePrompt();

  if (isFound) {
    // Dramatic reveal
    counterNumber.textContent = matching.length.toLocaleString();
    counterLabel.textContent  = matching.length === 1 ? 'show found' : 'matching setlists found';
    counterNumber.classList.add('found');

    optionsGrid.hidden   = true;
    optionsGrid.innerHTML = '';
    showReveal.hidden    = false;
    renderReveal(matching);
  } else {
    // Normal navigation
    counterNumber.classList.remove('found');
    setCounter(matching.length, `show${matching.length !== 1 ? 's' : ''}`);

    showReveal.hidden    = true;
    showReveal.innerHTML = '';
    optionsGrid.hidden   = false;
    renderGrid(options);
  }
}

// ── Render helpers ────────────────────────────────────────────

function renderPath() {
  if (selectedPath.length === 0) {
    pathSection.hidden = true;
    return;
  }
  pathSection.hidden = false;
  pathInner.innerHTML = '';

  selectedPath.forEach((song, i) => {
    if (i > 0) {
      const arrow = document.createElement('span');
      arrow.className   = 'path-arrow';
      arrow.textContent = '→';
      pathInner.appendChild(arrow);
    }
    const chip = document.createElement('span');
    chip.className   = 'path-chip';
    chip.innerHTML   =
      `<span class="path-chip-num">${i + 1}.</span>${esc(song)}`;
    pathInner.appendChild(chip);
  });
}

function setCounter(num, label) {
  counterNumber.textContent = num.toLocaleString();
  counterLabel.textContent  = label;
}

function updatePrompt() {
  if (freePlay) {
    promptText.textContent = selectedPath.length === 0
      ? 'Pick any song from anywhere in a show'
      : 'What came next?';
  } else {
    promptText.textContent = selectedPath.length === 0
      ? 'Which song opened the show?'
      : 'What came next?';
  }
}

function renderGrid(options) {
  optionsGrid.innerHTML = '';
  const maxCount = options[0]?.count ?? 1;

  options.forEach(({ song, count }, i) => {
    const card = document.createElement('button');
    card.className = 'song-card' + (i === 0 ? ' top' : '');
    card.style.setProperty('--freq', (count / maxCount).toFixed(4));
    card.setAttribute('role', 'listitem');

    const showsLabel = count === 1 ? '1 show' : `${count.toLocaleString()} shows`;
    card.innerHTML =
      `<span class="song-name">${esc(song)}</span>` +
      `<span class="song-count">${showsLabel}</span>`;

    card.addEventListener('click', () => {
      selectedPath.push(song);
      history.pushState({ band: currentBand, path: selectedPath.slice(), mode: freePlay ? 'freeplay' : 'opener' }, '');
      renderState();
    });

    optionsGrid.appendChild(card);
  });
}

function renderReveal(shows) {
  showReveal.innerHTML = '';

  shows.forEach((show, idx) => {
    if (idx > 0) {
      const sep = document.createElement('div');
      sep.className = 'reveal-separator';
      showReveal.appendChild(sep);
    }
    showReveal.appendChild(buildRevealCard(show));
  });
}

function buildRevealCard(show) {
  const wrap = document.createElement('div');

  // Date
  const dateEl = document.createElement('div');
  dateEl.className   = 'reveal-date';
  dateEl.textContent = formatDate(show.date);
  wrap.appendChild(dateEl);

  // Venue
  const venueEl = document.createElement('div');
  venueEl.className   = 'reveal-venue';
  venueEl.textContent = show.venue;
  wrap.appendChild(venueEl);

  // Location
  if (show.location) {
    const locEl = document.createElement('div');
    locEl.className   = 'reveal-location';
    locEl.textContent = show.location;
    wrap.appendChild(locEl);
  }

  // Divider
  const div1 = document.createElement('div');
  div1.className = 'reveal-divider';
  wrap.appendChild(div1);

  // Sets
  const setsEl = document.createElement('div');
  setsEl.className = 'reveal-sets';

  const setsData = (show.sets && show.sets.length > 0)
    ? show.sets
    : [{ name: 'Setlist', songs: show.songs }];

  // Track global song index so we can highlight path songs by position
  let globalIdx = 0;

  // In free play mode, find the first match position (not necessarily 0)
  const pathStart = freePlay && selectedPath.length > 0
    ? (findPositions(show.songs, selectedPath)[0] ?? 0)
    : 0;

  setsData.forEach(set => {
    const setEl   = document.createElement('div');
    setEl.className = 'reveal-set';

    const nameEl = document.createElement('div');
    nameEl.className   = 'reveal-set-name';
    nameEl.textContent = set.name;
    setEl.appendChild(nameEl);

    const listEl = document.createElement('ol');
    listEl.className = 'reveal-song-list';

    set.songs.forEach((song, localIdx) => {
      const pos    = globalIdx++;
      const inPath = pos >= pathStart && pos < pathStart + selectedPath.length;

      const li = document.createElement('li');
      li.className = 'reveal-song-item' + (inPath ? ' in-path' : '');

      const numEl = document.createElement('span');
      numEl.className   = 'reveal-song-num';
      numEl.textContent = localIdx + 1;

      const nameSpan = document.createElement('span');
      nameSpan.className   = 'reveal-song-name';
      nameSpan.textContent = song;

      li.appendChild(numEl);
      li.appendChild(nameSpan);
      listEl.appendChild(li);
    });

    setEl.appendChild(listEl);
    setsEl.appendChild(setEl);
  });

  wrap.appendChild(setsEl);

  // Divider
  const div2 = document.createElement('div');
  div2.className = 'reveal-divider';
  wrap.appendChild(div2);

  // Actions
  const actions = document.createElement('div');
  actions.className = 'reveal-actions';

  const link = document.createElement('a');
  link.className  = 'btn-setlist';
  link.href       = show.url;
  link.target     = '_blank';
  link.rel        = 'noopener noreferrer';
  link.textContent = 'View on setlist.fm ↗';
  actions.appendChild(link);

  const archiveLink = document.createElement('a');
  archiveLink.className  = 'btn-setlist';
  const archiveCollection = currentBand === 'dandc' ? 'DeadAndCompany' : 'GratefulDead';
  archiveLink.href       = `https://archive.org/details/${archiveCollection}?tab=collection&query=${show.date}`;
  archiveLink.target     = '_blank';
  archiveLink.rel        = 'noopener noreferrer';
  archiveLink.textContent = 'Listen on archive.org ↗';
  actions.appendChild(archiveLink);

  const again = document.createElement('button');
  again.className   = 'btn-again';
  again.textContent = 'Start Over';
  again.addEventListener('click', restart);
  actions.appendChild(again);

  wrap.appendChild(actions);
  return wrap;
}

// ── Utilities ─────────────────────────────────────────────────

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDate(iso) {
  // iso: "YYYY-MM-DD"
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    weekday: 'long',
    year:    'numeric',
    month:   'long',
    day:     'numeric',
  });
}

// ── Go ────────────────────────────────────────────────────────
init();
