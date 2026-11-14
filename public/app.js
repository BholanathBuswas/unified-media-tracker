/**
 * Unified Media Tracker - Frontend Application
 * Modern, responsive single-page application with SQLite backend integration.
 */

// --- Category & Type Configuration ---
const TYPE_CONFIG = {
  Anime: ['Anime', 'Movie', 'OVA', 'Special', 'Cartoon'],
  Movie: [
    'Hollywood Movie',
    'Bollywood Movie',
    'South Indian Movie',
    'Web Series',
    'Korean Drama',
    'Chinese Drama',
    'Bengali Movie',
    'Korean Movies',
    'Chinese Movies',
    'Animation Movie',
    'Other Drama',
    'Hoichoi',
    'That type of movie'
  ],
  Hentai: ['Japanese', 'Anime', '3D Animation']
};

// --- Web Audio Synthesizer (Zero External Audio Files) ---
let audioCtx = null;
function getAudioContext() {
  if (!audioCtx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) audioCtx = new AudioContext();
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

function playTickSound() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(600, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.03);
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.03);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.03);
  } catch (e) {
    // Audio context not allowed or failed
  }
}

function playWinSound() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const notes = [440, 554.37, 659.25, 880]; // A chord
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.15, ctx.currentTime + idx * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.08 + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + idx * 0.08);
      osc.stop(ctx.currentTime + idx * 0.08 + 0.4);
    });
  } catch (e) {
    // Audio failure ignored
  }
}

// --- Application State ---
const state = {
  category: 'All',
  type: 'All',
  status: 'All',
  search: '',
  sortBy: 'name',
  sortDir: 'asc',
  page: 1,
  limit: 24,
  view: 'grid',
  activeEditingId: null,
  activeSeasonItem: null,
  wheelItems: [],
  wheelAngle: 0,
  isSpinning: false,
  duplicateTimeout: null
};

// --- DOM References ---
const elements = {
  categoryTabs: document.querySelectorAll('.category-tab'),
  filterType: document.getElementById('filter-type'),
  filterStatus: document.getElementById('filter-status'),
  sortKey: document.getElementById('sort-key'),
  btnSortDir: document.getElementById('btn-sort-dir'),
  searchInput: document.getElementById('search-input'),
  searchClearBtn: document.getElementById('search-clear-btn'),
  btnResetFilters: document.getElementById('btn-reset-filters'),
  activeFilterText: document.getElementById('active-filter-text'),
  countDisplay: document.getElementById('count-display'),
  
  // Views
  btnViewGrid: document.getElementById('btn-view-grid'),
  btnViewTable: document.getElementById('btn-view-table'),
  gridView: document.getElementById('grid-view'),
  tableView: document.getElementById('table-view'),
  tableBody: document.getElementById('table-body'),
  loadingState: document.getElementById('loading-state'),
  emptyState: document.getElementById('empty-state'),
  
  // Pagination
  currentPageDisplay: document.getElementById('current-page-display'),
  totalPagesDisplay: document.getElementById('total-pages-display'),
  paginationNumbers: document.getElementById('pagination-numbers'),
  btnPageFirst: document.getElementById('btn-page-first'),
  btnPagePrev: document.getElementById('btn-page-prev'),
  btnPageNext: document.getElementById('btn-page-next'),
  btnPageLast: document.getElementById('btn-page-last'),
  itemsPerPage: document.getElementById('items-per-page'),
  
  // Metrics
  statTotal: document.getElementById('stat-total'),
  statWatching: document.getElementById('stat-watching'),
  statCompleted: document.getElementById('stat-completed'),
  statFavorites: document.getElementById('stat-favorites'),
  statCompletionPct: document.getElementById('stat-completion-pct'),
  
  // Media Modal
  mediaModal: document.getElementById('media-modal'),
  mediaForm: document.getElementById('media-form'),
  modalTitle: document.getElementById('modal-title'),
  saveBtnText: document.getElementById('save-btn-text'),
  entryId: document.getElementById('entry-id'),
  entryCategory: document.getElementById('entry-category'),
  entryType: document.getElementById('entry-type'),
  entryName: document.getElementById('entry-name'),
  entryAltName: document.getElementById('entry-alt-name'),
  entrySeasons: document.getElementById('entry-seasons'),
  entryYear: document.getElementById('entry-year'),
  entryRating: document.getElementById('entry-rating'),
  entryPlatform: document.getElementById('entry-platform'),
  entryPosterUrl: document.getElementById('entry-poster-url'),
  entryNotes: document.getElementById('entry-notes'),
  modalSeasonsContainer: document.getElementById('modal-seasons-container'),
  btnModalMarkAll: document.getElementById('btn-modal-mark-all'),
  btnModalClearAll: document.getElementById('btn-modal-clear-all'),
  duplicateWarning: document.getElementById('duplicate-warning'),
  duplicateWarningText: document.getElementById('duplicate-warning-text'),
  btnViewDuplicate: document.getElementById('btn-view-duplicate'),
  btnCleanDuplicates: document.getElementById('btn-clean-duplicates'),
  btnSaveEntry: document.getElementById('btn-save-entry'),
  
  // Season Modal
  seasonModal: document.getElementById('season-modal'),
  seasonModalItemName: document.getElementById('season-modal-item-name'),
  seasonModalProgressBar: document.getElementById('season-modal-progress-bar'),
  seasonModalProgressText: document.getElementById('season-modal-progress-text'),
  seasonModalGrid: document.getElementById('season-modal-grid'),
  btnQuickMarkAll: document.getElementById('btn-quick-mark-all'),
  btnQuickClearAll: document.getElementById('btn-quick-clear-all'),
  btnSeasonModalDone: document.getElementById('btn-season-modal-done'),
  
  // Lucky Wheel
  wheelModal: document.getElementById('wheel-modal'),
  wheelCategory: document.getElementById('wheel-category'),
  wheelType: document.getElementById('wheel-type'),
  wheelCanvas: document.getElementById('wheel-canvas'),
  btnSpinWheel: document.getElementById('btn-spin-wheel'),
  wheelPoolCount: document.getElementById('wheel-pool-count'),
  winnerModal: document.getElementById('winner-modal'),
  winnerTitle: document.getElementById('winner-title'),
  winnerMeta: document.getElementById('winner-meta'),
  btnWinnerWatchNow: document.getElementById('btn-winner-watch-now'),
  btnWinnerSearchGoogle: document.getElementById('btn-winner-search-google'),
  
  // Backup / Export
  backupModal: document.getElementById('backup-modal'),
  importFileInput: document.getElementById('import-file-input'),
  shortcutsModal: document.getElementById('shortcuts-modal'),
  
  // Theme
  btnThemeToggle: document.getElementById('btn-theme-toggle'),
  themeIcon: document.getElementById('theme-icon'),
  toastContainer: document.getElementById('toast-container')
};

// --- Toast Notifications ---
function showToast(message, type = 'info', duration = 3500) {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  let iconName = 'info';
  if (type === 'success') iconName = 'check-circle-2';
  else if (type === 'error') iconName = 'alert-octagon';
  else if (type === 'warning') iconName = 'alert-triangle';

  toast.innerHTML = `
    <i data-lucide="${iconName}" class="w-4 h-4 flex-shrink-0"></i>
    <span class="flex-1">${message}</span>
  `;

  elements.toastContainer.appendChild(toast);
  if (window.lucide) window.lucide.createIcons({ root: toast });

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'opacity 0.25s ease, transform 0.25s ease';
    setTimeout(() => toast.remove(), 250);
  }, duration);
}

// --- Theme Management ---
function initTheme() {
  const saved = localStorage.getItem('media_tracker_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
  updateThemeIcon(saved);
}

function updateThemeIcon(theme) {
  if (elements.themeIcon) {
    elements.themeIcon.setAttribute('data-lucide', theme === 'dark' ? 'sun' : 'moon');
    if (window.lucide) window.lucide.createIcons();
  }
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('media_tracker_theme', next);
  updateThemeIcon(next);
}

// --- Fetch Statistics ---
async function loadStats() {
  try {
    const res = await fetch('/api/stats');
    const json = await res.json();
    if (!json.success) return;

    const stats = json.data;
    elements.statTotal.textContent = stats.total.toLocaleString();
    elements.statWatching.textContent = stats.watching.toLocaleString();
    elements.statCompleted.textContent = stats.completed.toLocaleString();
    elements.statFavorites.textContent = stats.favorites.toLocaleString();

    const pct = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;
    elements.statCompletionPct.textContent = `(${pct}%)`;
  } catch (err) {
    console.error('Failed to load stats:', err);
  }
}

// --- Populate Filter Type Options ---
function updateFilterTypeOptions() {
  const cat = state.category;
  let types = [];

  if (cat === 'All' || cat === 'Favorites') {
    types = Array.from(new Set([
      ...TYPE_CONFIG.Anime,
      ...TYPE_CONFIG.Movie,
      ...TYPE_CONFIG.Hentai
    ])).sort();
  } else if (TYPE_CONFIG[cat]) {
    types = TYPE_CONFIG[cat];
  }

  const currentVal = elements.filterType.value;
  elements.filterType.innerHTML = '<option value="All">All Types</option>';
  types.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t;
    opt.textContent = t;
    if (t === currentVal) opt.selected = true;
    elements.filterType.appendChild(opt);
  });
}

// --- Populate Modal Type Options ---
function updateModalTypeOptions(selectedCat, currentType = '') {
  const cat = selectedCat || elements.entryCategory.value;
  const types = TYPE_CONFIG[cat] || TYPE_CONFIG.Movie;

  elements.entryType.innerHTML = '';
  types.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t;
    opt.textContent = t;
    if (t === currentType) opt.selected = true;
    elements.entryType.appendChild(opt);
  });
}

// --- Fetch Media Items ---
async function fetchMedia() {
  elements.loadingState.classList.remove('hidden');
  elements.emptyState.classList.add('hidden');
  elements.gridView.classList.add('hidden');
  elements.tableView.classList.add('hidden');

  const params = new URLSearchParams({
    category: state.category,
    type: state.type,
    status: state.status,
    search: state.search,
    sortBy: state.sortBy,
    sortDir: state.sortDir,
    page: state.page,
    limit: state.limit
  });

  if (state.category === 'Favorites') {
    params.set('category', 'All');
    params.set('favorite', 'true');
  }

  try {
    const res = await fetch(`/api/media?${params.toString()}`);
    const json = await res.json();

    elements.loadingState.classList.add('hidden');

    if (!json.success || !json.data || json.data.items.length === 0) {
      elements.countDisplay.textContent = '0';
      elements.emptyState.classList.remove('hidden');
      renderPagination(0, 1, state.limit);
      return;
    }

    const { items, total, totalPages, page } = json.data;
    elements.countDisplay.textContent = total.toLocaleString();

    // Render active view
    if (state.view === 'grid') {
      renderGrid(items);
      elements.gridView.classList.remove('hidden');
    } else {
      renderTable(items);
      elements.tableView.classList.remove('hidden');
    }

    renderPagination(total, page, totalPages);
    updateFilterBadges();

    // Re-initialize Lucide Icons
    if (window.lucide) window.lucide.createIcons();

  } catch (err) {
    elements.loadingState.classList.add('hidden');
    showToast('Failed to load media records.', 'error');
    console.error(err);
  }
}

// --- External Media Portal Router ---
function createSearchLink(item) {
  const name = (item.name || '').trim();
  const safeName = encodeURIComponent(name);
  const year = item.year && item.year !== '-' && item.year !== 'N/A' ? item.year : '';
  const safeNameYear = encodeURIComponent(`${name} ${year}`.trim());
  const category = (item.category || '').trim();
  const safeType = (item.type || '').toLowerCase().trim();

  // 1. Anime -> MyAnimeList
  if (category === 'Anime') {
    return {
      portalName: 'MyAnimeList',
      url: `https://myanimelist.net/anime.php?q=${safeName}`,
      badgeClass: 'bg-blue-500/15 text-blue-400 border-blue-500/30'
    };
  }

  // 2. Movie -> IMDb
  if (category === 'Movie') {
    return {
      portalName: 'IMDb',
      url: `https://www.imdb.com/find/?q=${safeNameYear}`,
      badgeClass: 'bg-amber-500/15 text-amber-400 border-amber-500/30'
    };
  }

  // 2. Hentai -> MissAV (Japanese) or HentaiHaven (Anime)
  if (category === 'Hentai') {
    if (safeType === 'japanese') {
      return {
        portalName: 'MissAV',
        url: `https://missav.ws/en/search/${safeName}`,
        badgeClass: 'bg-rose-500/15 text-rose-400 border-rose-500/30'
      };
    } else if (safeType === 'anime') {
      return {
        portalName: 'HentaiHaven',
        url: `https://hentaihaven.xxx/search/?q=${safeName}`,
        badgeClass: 'bg-purple-500/15 text-purple-400 border-purple-500/30'
      };
    } else {
      return {
        portalName: 'Google',
        url: `https://www.google.com/search?q=${encodeURIComponent(name + ' hentai')}`,
        badgeClass: 'bg-blue-500/15 text-blue-400 border-blue-500/30'
      };
    }
  }

  // Fallback
  return {
    portalName: 'IMDb',
    url: `https://www.imdb.com/find/?q=${safeNameYear}`,
    badgeClass: 'bg-amber-500/15 text-amber-400 border-amber-500/30'
  };
}

// --- Render Card Grid View ---
function renderGrid(items) {
  elements.gridView.innerHTML = '';

  items.forEach(item => {
    const card = document.createElement('div');
    card.className = 'glow-card rounded-xl p-4 bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex flex-col justify-between space-y-3';

    // External portal link
    const portal = createSearchLink(item);

    // Status pill style
    let statusClass = 'plan';
    if (item.status === 'Completed') statusClass = 'completed';
    else if (item.status === 'Watching') statusClass = 'watching';

    // Poster or Fallback
    const posterHtml = item.poster_url 
      ? `<img src="${item.poster_url}" alt="${item.name}" class="w-full h-36 object-cover rounded-lg mb-2" onerror="this.style.display='none'">`
      : '';

    // Quick Season Chips HTML
    const seasonChipsHtml = item.watched.map((isWatched, idx) => `
      <button 
        type="button" 
        class="season-chip ${isWatched ? 'watched' : 'unwatched'}" 
        data-id="${item.id}" 
        data-season-idx="${idx}"
        title="Toggle Season ${idx + 1}"
      >
        <span>S${idx + 1}</span>
        <i data-lucide="${isWatched ? 'check' : 'circle'}" class="w-2.5 h-2.5"></i>
      </button>
    `).join('');

    card.innerHTML = `
      <div>
        ${posterHtml}
        
        <!-- Top Badges -->
        <div class="flex items-center justify-between gap-1 mb-1.5">
          <span class="badge-status ${statusClass}">${item.status}</span>
          <div class="flex items-center gap-1.5">
            <span class="text-[11px] font-medium text-[var(--text-muted)]">${item.year || 'N/A'}</span>
            <button 
              type="button" 
              class="btn-toggle-favorite text-[var(--text-muted)] hover:text-rose-500 transition-colors" 
              data-id="${item.id}"
              aria-label="Toggle Favorite"
            >
              <i data-lucide="heart" class="w-4 h-4 ${item.favorite ? 'fill-rose-500 text-rose-500' : ''}"></i>
            </button>
          </div>
        </div>

        <!-- Title Link to External Media Portal (IMDb / MissAV / HentaiHaven) -->
        <a 
          href="${portal.url}" 
          target="_blank" 
          rel="noopener noreferrer" 
          class="group block text-sm font-bold text-[var(--text-primary)] hover:text-indigo-400 transition-colors"
          title="Open on ${portal.portalName}: ${escapeHtml(item.name)}"
        >
          <span class="line-clamp-2">${escapeHtml(item.name)}</span>
          <span class="inline-flex items-center gap-1 mt-1 text-[10px] font-semibold px-1.5 py-0.5 rounded border ${portal.badgeClass}">
            <span>${portal.portalName}</span>
            <i data-lucide="external-link" class="w-2.5 h-2.5 opacity-75"></i>
          </span>
        </a>
        ${item.alt_name ? `<p class="text-[11px] text-[var(--text-muted)] truncate mt-1">${escapeHtml(item.alt_name)}</p>` : ''}
        
        <!-- Category & Format -->
        <div class="flex items-center gap-1.5 mt-2">
          <span class="text-[10px] font-semibold px-2 py-0.5 rounded bg-[var(--bg-surface-elevated)] text-[var(--text-secondary)] border border-[var(--border-subtle)]">
            ${escapeHtml(item.type)}
          </span>
          <span class="text-[10px] text-[var(--text-muted)]">
            ${item.seasons} ${item.seasons === 1 ? 'Season' : 'Seasons'}
          </span>
          ${item.rating > 0 ? `
            <span class="ml-auto text-[11px] font-bold text-amber-400 flex items-center gap-0.5">
              <i data-lucide="star" class="w-3 h-3 fill-amber-400"></i> ${item.rating}
            </span>
          ` : ''}
        </div>
      </div>

      <!-- Bottom Season Progress & Actions -->
      <div class="pt-2 border-t border-[var(--border-subtle)] space-y-2">
        <div class="flex flex-wrap gap-1 max-h-16 overflow-y-auto no-scrollbar">
          ${seasonChipsHtml}
        </div>

        <div class="flex items-center justify-between text-xs pt-1">
          <button 
            type="button" 
            class="btn-open-season-modal text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
            data-id="${item.id}"
          >
            <i data-lucide="list-checks" class="w-3.5 h-3.5"></i>
            <span>Seasons</span>
          </button>

          <div class="flex items-center gap-2">
            <a 
              href="${portal.url}" 
              target="_blank" 
              rel="noopener noreferrer" 
              class="p-1 text-[var(--text-muted)] hover:text-indigo-400 transition-colors"
              title="Open on ${portal.portalName}"
            >
              <i data-lucide="external-link" class="w-3.5 h-3.5"></i>
            </a>
            <button 
              type="button" 
              class="btn-edit-item p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
              data-id="${item.id}"
              title="Edit Entry"
            >
              <i data-lucide="pencil" class="w-3.5 h-3.5"></i>
            </button>
            <button 
              type="button" 
              class="btn-delete-item p-1 text-[var(--text-muted)] hover:text-rose-500 transition-colors"
              data-id="${item.id}"
              title="Delete Entry"
            >
              <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
            </button>
          </div>
        </div>
      </div>
    `;

    elements.gridView.appendChild(card);
  });
}

// --- Render Compact Table View ---
function renderTable(items) {
  elements.tableBody.innerHTML = '';

  items.forEach((item, index) => {
    const tr = document.createElement('tr');
    const portal = createSearchLink(item);

    let statusClass = 'plan';
    if (item.status === 'Completed') statusClass = 'completed';
    else if (item.status === 'Watching') statusClass = 'watching';

    const seasonChipsHtml = item.watched.map((isWatched, idx) => `
      <button 
        type="button" 
        class="season-chip ${isWatched ? 'watched' : 'unwatched'}" 
        data-id="${item.id}" 
        data-season-idx="${idx}"
        title="Toggle Season ${idx + 1}"
      >
        <span>S${idx + 1}</span>
      </button>
    `).join(' ');

    tr.innerHTML = `
      <td class="text-center text-xs text-[var(--text-muted)]">${(state.page - 1) * state.limit + index + 1}</td>
      <td>
        <div class="flex flex-col">
          <a 
            href="${portal.url}" 
            target="_blank" 
            rel="noopener noreferrer" 
            class="inline-flex items-center gap-1.5 font-semibold text-sm text-[var(--text-primary)] hover:text-indigo-400 transition-colors group"
            title="Open on ${portal.portalName}"
          >
            <span>${escapeHtml(item.name)}</span>
            <span class="text-[10px] font-bold px-1.5 py-0.5 rounded border ${portal.badgeClass}">
              ${portal.portalName}
            </span>
            <i data-lucide="external-link" class="w-3 h-3 text-[var(--text-muted)] group-hover:text-indigo-400 opacity-60 group-hover:opacity-100 transition-opacity"></i>
          </a>
          ${item.alt_name ? `<div class="text-[11px] text-[var(--text-muted)] mt-0.5">${escapeHtml(item.alt_name)}</div>` : ''}
        </div>
      </td>
      <td>
        <span class="text-xs px-2 py-0.5 rounded bg-[var(--bg-surface-elevated)] text-[var(--text-secondary)]">
          ${item.category}
        </span>
      </td>
      <td class="text-xs text-[var(--text-secondary)]">${escapeHtml(item.type)}</td>
      <td>
        <div class="flex flex-wrap items-center gap-1">
          ${seasonChipsHtml}
        </div>
      </td>
      <td class="text-xs text-[var(--text-muted)]">${item.year || 'N/A'}</td>
      <td>
        <span class="badge-status ${statusClass}">${item.status}</span>
      </td>
      <td>
        ${item.rating > 0 ? `
          <span class="text-xs font-bold text-amber-400 flex items-center gap-0.5">
            <i data-lucide="star" class="w-3 h-3 fill-amber-400"></i> ${item.rating}
          </span>
        ` : '<span class="text-xs text-[var(--text-muted)]">-</span>'}
      </td>
      <td class="text-right">
        <div class="flex items-center justify-end gap-1.5">
          <button 
            type="button" 
            class="btn-toggle-favorite p-1 text-[var(--text-muted)] hover:text-rose-500 transition-colors" 
            data-id="${item.id}"
            title="Toggle Favorite"
          >
            <i data-lucide="heart" class="w-3.5 h-3.5 ${item.favorite ? 'fill-rose-500 text-rose-500' : ''}"></i>
          </button>
          <a 
            href="${portal.url}" 
            target="_blank" 
            rel="noopener noreferrer" 
            class="p-1 text-[var(--text-muted)] hover:text-indigo-400"
            title="Open on ${portal.portalName}"
          >
            <i data-lucide="external-link" class="w-3.5 h-3.5"></i>
          </a>
          <button 
            type="button" 
            class="btn-edit-item p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            data-id="${item.id}"
            title="Edit"
          >
            <i data-lucide="pencil" class="w-3.5 h-3.5"></i>
          </button>
          <button 
            type="button" 
            class="btn-delete-item p-1 text-[var(--text-muted)] hover:text-rose-500"
            data-id="${item.id}"
            title="Delete"
          >
            <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
          </button>
        </div>
      </td>
    `;

    elements.tableBody.appendChild(tr);
  });
}

// --- Render Pagination Controls ---
function renderPagination(total, page, totalPages) {
  elements.currentPageDisplay.textContent = total > 0 ? page : 0;
  elements.totalPagesDisplay.textContent = totalPages || 1;

  elements.btnPageFirst.disabled = page <= 1;
  elements.btnPagePrev.disabled = page <= 1;
  elements.btnPageNext.disabled = page >= totalPages;
  elements.btnPageLast.disabled = page >= totalPages;

  elements.paginationNumbers.innerHTML = '';
  if (totalPages <= 1) return;

  const maxButtons = 5;
  let start = Math.max(1, page - 2);
  let end = Math.min(totalPages, start + maxButtons - 1);
  if (end - start < maxButtons - 1) {
    start = Math.max(1, end - maxButtons + 1);
  }

  for (let p = start; p <= end; p++) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `w-7 h-7 text-xs font-semibold rounded-md transition-colors ${
      p === page 
        ? 'bg-indigo-600 text-white' 
        : 'bg-[var(--bg-surface-elevated)] hover:bg-[var(--bg-surface-hover)] text-[var(--text-secondary)]'
    }`;
    btn.textContent = p;
    btn.onclick = () => {
      state.page = p;
      fetchMedia();
    };
    elements.paginationNumbers.appendChild(btn);
  }
}

// --- Update Active Filter Tags Badge ---
function updateFilterBadges() {
  const parts = [];
  if (state.category !== 'All') parts.push(`Category: ${state.category}`);
  if (state.type !== 'All') parts.push(`Type: ${state.type}`);
  if (state.status !== 'All') parts.push(`Status: ${state.status}`);
  if (state.search) parts.push(`Search: "${state.search}"`);

  if (parts.length > 0) {
    elements.activeFilterText.textContent = `(${parts.join(', ')})`;
    elements.btnResetFilters.classList.remove('hidden');
  } else {
    elements.activeFilterText.textContent = '';
    elements.btnResetFilters.classList.add('hidden');
  }
}

// --- Season Chips / Direct Toggle ---
async function toggleSeasonDirect(id, seasonIdx, btnEl) {
  try {
    // Optimistic UI toggle
    const isWatched = btnEl.classList.contains('watched');
    btnEl.classList.toggle('watched', !isWatched);
    btnEl.classList.toggle('unwatched', isWatched);

    const res = await fetch(`/api/media/${id}/toggle-season`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seasonIndex: seasonIdx })
    });

    const json = await res.json();
    if (!json.success) {
      // Revert if error
      btnEl.classList.toggle('watched', isWatched);
      btnEl.classList.toggle('unwatched', !isWatched);
      showToast('Failed to toggle season.', 'error');
      return;
    }

    loadStats();
    showToast(json.message, 'success', 2000);
  } catch (err) {
    showToast('Network error updating season.', 'error');
  }
}

// --- Toggle Favorite ---
async function toggleFavorite(id) {
  try {
    const res = await fetch(`/api/media/${id}/favorite`, { method: 'PATCH' });
    const json = await res.json();
    if (json.success) {
      showToast(json.message, 'success', 2000);
      fetchMedia();
      loadStats();
    }
  } catch (err) {
    showToast('Failed to update favorite.', 'error');
  }
}

// --- Open Season Tracker Modal ---
async function openSeasonModal(id) {
  try {
    const res = await fetch(`/api/media/${id}`);
    const json = await res.json();
    if (!json.success) return;

    const item = json.data;
    state.activeSeasonItem = item;

    elements.seasonModalItemName.textContent = `${item.name} (${item.seasons} Seasons)`;
    renderSeasonModalGrid();

    elements.seasonModal.classList.remove('hidden');
    document.body.classList.add('modal-open');
  } catch (err) {
    showToast('Failed to open season tracker.', 'error');
  }
}

function renderSeasonModalGrid() {
  const item = state.activeSeasonItem;
  if (!item) return;

  const total = item.seasons;
  const watchedCount = item.watched.filter(Boolean).length;
  const pct = total > 0 ? Math.round((watchedCount / total) * 100) : 0;

  elements.seasonModalProgressText.textContent = `${watchedCount}/${total} (${pct}%)`;
  elements.seasonModalProgressBar.style.width = `${pct}%`;

  elements.seasonModalGrid.innerHTML = '';
  item.watched.forEach((isWatched, idx) => {
    const box = document.createElement('label');
    box.className = `p-3 rounded-lg border cursor-pointer flex items-center justify-between text-xs font-semibold transition-colors ${
      isWatched 
        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
        : 'bg-[var(--bg-surface-elevated)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)]'
    }`;
    box.innerHTML = `
      <span>Season ${idx + 1}</span>
      <input type="checkbox" class="rounded accent-emerald-500 w-4 h-4" ${isWatched ? 'checked' : ''}>
    `;

    box.querySelector('input').onchange = (e) => {
      item.watched[idx] = e.target.checked;
      renderSeasonModalGrid();
      saveSeasonModalChanges();
    };

    elements.seasonModalGrid.appendChild(box);
  });
}

async function saveSeasonModalChanges() {
  const item = state.activeSeasonItem;
  if (!item) return;

  try {
    const res = await fetch(`/api/media/${item.id}/watched`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ watched: item.watched })
    });
    const json = await res.json();
    if (json.success) {
      loadStats();
    }
  } catch (err) {
    console.error('Failed to sync seasons:', err);
  }
}

function closeSeasonModal() {
  elements.seasonModal.classList.add('hidden');
  document.body.classList.remove('modal-open');
  state.activeSeasonItem = null;
  fetchMedia();
}

// --- Add / Edit Media Modal ---
function openAddModal() {
  state.activeEditingId = null;
  elements.modalTitle.textContent = 'Add New Media';
  elements.saveBtnText.textContent = 'Save Entry';
  elements.mediaForm.reset();
  elements.entryId.value = '';
  elements.duplicateWarning.classList.add('hidden');
  currentDuplicateEntry = null;
  if (elements.btnSaveEntry) {
    elements.btnSaveEntry.disabled = false;
    elements.btnSaveEntry.classList.remove('opacity-50', 'cursor-not-allowed');
  }

  elements.entryCategory.value = state.category !== 'All' && state.category !== 'Favorites' ? state.category : 'Movie';
  updateModalTypeOptions(elements.entryCategory.value);
  elements.entrySeasons.value = 1;
  elements.entryYear.value = new Date().getFullYear().toString();
  elements.entryRating.value = 0;

  renderModalSeasonChips(1, [false]);

  elements.mediaModal.classList.remove('hidden');
  document.body.classList.add('modal-open');
  elements.entryName.focus();
}

async function openEditModal(id) {
  try {
    const res = await fetch(`/api/media/${id}`);
    const json = await res.json();
    if (!json.success) return;

    const item = json.data;
    state.activeEditingId = item.id;
    elements.modalTitle.textContent = 'Edit Media Record';
    elements.saveBtnText.textContent = 'Update Entry';
    elements.duplicateWarning.classList.add('hidden');

    elements.entryId.value = item.id;
    elements.entryCategory.value = item.category;
    updateModalTypeOptions(item.category, item.type);
    elements.entryName.value = item.name;
    elements.entryAltName.value = item.alt_name || '';
    elements.entrySeasons.value = item.seasons;
    elements.entryYear.value = item.year || 'N/A';
    elements.entryRating.value = item.rating || 0;
    elements.entryPlatform.value = item.platform || '';
    elements.entryPosterUrl.value = item.poster_url || '';
    elements.entryNotes.value = item.notes || '';

    renderModalSeasonChips(item.seasons, item.watched);

    elements.mediaModal.classList.remove('hidden');
    document.body.classList.add('modal-open');
    elements.entryName.focus();
  } catch (err) {
    showToast('Failed to load entry for editing.', 'error');
  }
}

function renderModalSeasonChips(seasonsCount, watchedArr = []) {
  elements.modalSeasonsContainer.innerHTML = '';
  const count = Math.max(1, Number(seasonsCount) || 1);

  for (let i = 0; i < count; i++) {
    const isWatched = Boolean(watchedArr[i]);
    const label = document.createElement('label');
    label.className = `season-chip ${isWatched ? 'watched' : 'unwatched'} cursor-pointer`;
    label.innerHTML = `
      <span>S${i + 1}</span>
      <input type="checkbox" class="hidden modal-season-check" data-idx="${i}" ${isWatched ? 'checked' : ''}>
    `;

    label.querySelector('input').onchange = (e) => {
      label.classList.toggle('watched', e.target.checked);
      label.classList.toggle('unwatched', !e.target.checked);
    };

    elements.modalSeasonsContainer.appendChild(label);
  }
}

function closeMediaModal() {
  elements.mediaModal.classList.add('hidden');
  document.body.classList.remove('modal-open');
  state.activeEditingId = null;
}

// --- Live Duplicate Check ---
let currentDuplicateEntry = null;

async function checkDuplicateTitle(name, category, excludeId) {
  const trimmed = (name || '').trim();
  if (!trimmed) {
    elements.duplicateWarning.classList.add('hidden');
    currentDuplicateEntry = null;
    if (elements.btnSaveEntry) {
      elements.btnSaveEntry.disabled = false;
      elements.btnSaveEntry.classList.remove('opacity-50', 'cursor-not-allowed');
    }
    return;
  }

  try {
    const res = await fetch('/api/media/check-duplicate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: trimmed, category, excludeId })
    });
    const json = await res.json();
    if (json.duplicate && json.existing) {
      currentDuplicateEntry = json.existing;
      if (elements.duplicateWarningText) {
        elements.duplicateWarningText.textContent = `Duplicate Detected: "${json.existing.name}" already exists in ${json.existing.category} (${json.existing.status}).`;
      }
      elements.duplicateWarning.classList.remove('hidden');
      if (elements.btnSaveEntry) {
        elements.btnSaveEntry.disabled = true;
        elements.btnSaveEntry.classList.add('opacity-50', 'cursor-not-allowed');
      }
    } else {
      currentDuplicateEntry = null;
      elements.duplicateWarning.classList.add('hidden');
      if (elements.btnSaveEntry) {
        elements.btnSaveEntry.disabled = false;
        elements.btnSaveEntry.classList.remove('opacity-50', 'cursor-not-allowed');
      }
    }
  } catch (err) {
    elements.duplicateWarning.classList.add('hidden');
    if (elements.btnSaveEntry) {
      elements.btnSaveEntry.disabled = false;
      elements.btnSaveEntry.classList.remove('opacity-50', 'cursor-not-allowed');
    }
  }
}

// --- Form Submit Handler ---
async function handleMediaFormSubmit(e) {
  e.preventDefault();

  if (elements.btnSaveEntry && elements.btnSaveEntry.disabled) {
    return;
  }

  const id = elements.entryId.value;
  const originalSaveHtml = elements.btnSaveEntry ? elements.btnSaveEntry.innerHTML : '';
  if (elements.btnSaveEntry) {
    elements.btnSaveEntry.disabled = true;
    elements.btnSaveEntry.innerHTML = '<div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> <span>Saving…</span>';
  }
  const seasons = Math.max(1, Number(elements.entrySeasons.value) || 1);
  const checkInputs = elements.modalSeasonsContainer.querySelectorAll('.modal-season-check');
  const watched = [];

  for (let i = 0; i < seasons; i++) {
    watched.push(checkInputs[i] ? checkInputs[i].checked : false);
  }

  const payload = {
    name: elements.entryName.value.trim(),
    alt_name: elements.entryAltName.value.trim(),
    category: elements.entryCategory.value,
    type: elements.entryType.value,
    seasons,
    year: elements.entryYear.value.trim() || 'N/A',
    rating: Number(elements.entryRating.value) || 0,
    platform: elements.entryPlatform.value.trim(),
    poster_url: elements.entryPosterUrl.value.trim(),
    notes: elements.entryNotes.value.trim(),
    watched
  };

  const isEdit = Boolean(id);
  const url = isEdit ? `/api/media/${id}` : '/api/media';
  const method = isEdit ? 'PUT' : 'POST';

  try {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const json = await res.json();
    if (!json.success) {
      showToast(json.error || 'Failed to save entry.', 'error');
      if (elements.btnSaveEntry) {
        elements.btnSaveEntry.disabled = false;
        elements.btnSaveEntry.innerHTML = originalSaveHtml;
      }
      return;
    }

    showToast(json.message || 'Saved successfully.', 'success');
    closeMediaModal();
    fetchMedia();
    loadStats();
  } catch (err) {
    showToast('Network error while saving.', 'error');
  } finally {
    if (elements.btnSaveEntry) {
      elements.btnSaveEntry.disabled = false;
      elements.btnSaveEntry.innerHTML = originalSaveHtml;
    }
  }
}

// --- Delete Entry ---
async function deleteItem(id) {
  if (!confirm('Are you sure you want to permanently delete this media entry?')) return;

  try {
    const res = await fetch(`/api/media/${id}`, { method: 'DELETE' });
    const json = await res.json();
    if (json.success) {
      showToast('Entry deleted successfully.', 'success');
      fetchMedia();
      loadStats();
    } else {
      showToast(json.error || 'Failed to delete entry.', 'error');
    }
  } catch (err) {
    showToast('Network error deleting entry.', 'error');
  }
}

// --- Lucky Decision Wheel Logic ---
const WHEEL_COLORS = [
  '#4f46e5', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4',
  '#6366f1', '#a855f7', '#d946ef', '#eab308', '#14b8a6', '#3b82f6'
];

async function openLuckyWheel() {
  elements.wheelCategory.value = state.category !== 'Favorites' ? state.category : 'All';
  updateWheelTypeOptions();
  await loadWheelCandidates();
  elements.wheelModal.classList.remove('hidden');
  document.body.classList.add('modal-open');
  drawWheel();
}

function updateWheelTypeOptions() {
  const cat = elements.wheelCategory.value;
  let types = [];
  if (cat === 'All') {
    types = Array.from(new Set([
      ...TYPE_CONFIG.Anime,
      ...TYPE_CONFIG.Movie,
      ...TYPE_CONFIG.Hentai
    ])).sort();
  } else if (TYPE_CONFIG[cat]) {
    types = TYPE_CONFIG[cat];
  }

  elements.wheelType.innerHTML = '<option value="All">All Formats</option>';
  types.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t;
    opt.textContent = t;
    elements.wheelType.appendChild(opt);
  });
}

async function loadWheelCandidates() {
  const cat = elements.wheelCategory.value;
  const type = elements.wheelType.value;

  try {
    const res = await fetch(`/api/wheel?category=${encodeURIComponent(cat)}&type=${encodeURIComponent(type)}`);
    const json = await res.json();
    if (json.success) {
      state.wheelItems = json.data || [];
      elements.wheelPoolCount.textContent = `${state.wheelItems.length} unwatched candidate${state.wheelItems.length === 1 ? '' : 's'}`;
      drawWheel();
    }
  } catch (err) {
    console.error('Failed to load wheel candidates:', err);
  }
}

function drawWheel() {
  const canvas = elements.wheelCanvas;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const numSlices = Math.min(24, Math.max(state.wheelItems.length, 1));
  const sliceAngle = (2 * Math.PI) / numSlices;
  const radius = canvas.width / 2;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.translate(radius, radius);
  ctx.rotate(state.wheelAngle);

  for (let i = 0; i < numSlices; i++) {
    const angle = i * sliceAngle;
    const item = state.wheelItems[i];
    const color = WHEEL_COLORS[i % WHEEL_COLORS.length];

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, radius - 4, angle, angle + sliceAngle);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.stroke();

    // Text Label
    ctx.save();
    ctx.rotate(angle + sliceAngle / 2);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px Inter, sans-serif';
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 4;

    const label = item ? item.name : `Option ${i + 1}`;
    const truncated = label.length > 18 ? label.substring(0, 16) + '…' : label;
    ctx.fillText(truncated, radius - 20, 4);
    ctx.restore();
  }

  // Center Hub
  ctx.beginPath();
  ctx.arc(0, 0, 24, 0, 2 * Math.PI);
  ctx.fillStyle = '#0f172a';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#6366f1';
  ctx.stroke();

  ctx.restore();
}

function spinWheel() {
  if (state.isSpinning || state.wheelItems.length === 0) return;

  state.isSpinning = true;
  elements.btnSpinWheel.disabled = true;

  const numSlices = Math.min(24, state.wheelItems.length);
  const sliceAngle = (2 * Math.PI) / numSlices;
  const spinRotations = 5 + Math.random() * 4; // 5 to 9 full spins
  const targetOffset = Math.random() * 2 * Math.PI;
  const targetAngle = state.wheelAngle + spinRotations * 2 * Math.PI + targetOffset;

  const duration = 4000;
  const startAngle = state.wheelAngle;
  const startTime = performance.now();
  let lastSliceIndex = -1;

  function animate(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(1, elapsed / duration);
    // Cubic ease-out
    const easeOut = 1 - Math.pow(1 - progress, 3);

    state.wheelAngle = startAngle + (targetAngle - startAngle) * easeOut;

    // Tick Sound on slice boundary pass
    const currentSlice = Math.floor((state.wheelAngle % (2 * Math.PI)) / sliceAngle);
    if (currentSlice !== lastSliceIndex) {
      playTickSound();
      lastSliceIndex = currentSlice;
    }

    drawWheel();

    if (progress < 1) {
      requestAnimationFrame(animate);
    } else {
      state.isSpinning = false;
      elements.btnSpinWheel.disabled = false;
      onWheelSpinComplete();
    }
  }

  requestAnimationFrame(animate);
}

function onWheelSpinComplete() {
  const numSlices = Math.min(24, state.wheelItems.length);
  const sliceAngle = (2 * Math.PI) / numSlices;
  // Normalized angle
  const normalized = (state.wheelAngle % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
  // Pointer is at 12 o'clock (-PI / 2)
  const pointerAngle = (3 * Math.PI / 2 - normalized + 2 * Math.PI) % (2 * Math.PI);
  const winningIndex = Math.floor(pointerAngle / sliceAngle) % numSlices;
  const winner = state.wheelItems[winningIndex];

  if (!winner) return;

  playWinSound();

  // Confetti burst
  if (window.confetti) {
    window.confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 }
    });
  }

  state.luckyWinner = winner;
  elements.winnerTitle.textContent = winner.name;
  elements.winnerMeta.textContent = `${winner.category} • ${winner.type} • ${winner.seasons} Seasons • ${winner.year || 'N/A'}`;

  const portal = createSearchLink(winner);
  const searchBtnSpan = elements.btnWinnerSearchGoogle.querySelector('span');
  if (searchBtnSpan) {
    searchBtnSpan.textContent = `Open on ${portal.portalName}`;
  }

  elements.wheelModal.classList.add('hidden');
  elements.winnerModal.classList.remove('hidden');
}

// --- Import JSON Backup ---
async function handleJsonImport(e) {
  const file = e.target.files[0];
  if (!file) return;

  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const items = Array.isArray(parsed) ? parsed : (parsed.data || []);

    if (!items || items.length === 0) {
      showToast('Import file contains no valid media records.', 'warning');
      return;
    }

    const res = await fetch('/api/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items, replaceExisting: true })
    });

    const json = await res.json();
    if (json.success) {
      showToast(json.message, 'success');
      elements.backupModal.classList.add('hidden');
      fetchMedia();
      loadStats();
    } else {
      showToast(json.error || 'Import failed.', 'error');
    }
  } catch (err) {
    showToast('Failed to parse JSON file.', 'error');
  } finally {
    e.target.value = '';
  }
}

// --- Utilities ---
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// --- Event Listeners Setup ---
function setupEventListeners() {
  // Category Navigation Tabs
  elements.categoryTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      elements.categoryTabs.forEach(t => t.classList.remove('active', 'bg-indigo-600', 'text-white'));
      tab.classList.add('active');

      const cat = tab.getAttribute('data-category');
      state.category = cat;
      state.type = 'All';
      state.page = 1;

      updateFilterTypeOptions();
      fetchMedia();
    });
  });

  // Filter & Search Controls
  elements.filterType.addEventListener('change', (e) => {
    state.type = e.target.value;
    state.page = 1;
    fetchMedia();
  });

  elements.filterStatus.addEventListener('change', (e) => {
    state.status = e.target.value;
    state.page = 1;
    fetchMedia();
  });

  elements.sortKey.addEventListener('change', (e) => {
    state.sortBy = e.target.value;
    fetchMedia();
  });

  elements.btnSortDir.addEventListener('click', () => {
    state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
    fetchMedia();
  });

  // Search input debounced
  let searchTimer = null;
  elements.searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    const val = e.target.value;
    elements.searchClearBtn.classList.toggle('hidden', !val);

    searchTimer = setTimeout(() => {
      state.search = val;
      state.page = 1;
      fetchMedia();
    }, 280);
  });

  elements.searchClearBtn.addEventListener('click', () => {
    elements.searchInput.value = '';
    elements.searchClearBtn.classList.add('hidden');
    state.search = '';
    state.page = 1;
    fetchMedia();
  });

  elements.btnResetFilters.addEventListener('click', () => {
    state.type = 'All';
    state.status = 'All';
    state.search = '';
    elements.filterType.value = 'All';
    elements.filterStatus.value = 'All';
    elements.searchInput.value = '';
    elements.searchClearBtn.classList.add('hidden');
    state.page = 1;
    fetchMedia();
  });

  // View Switchers
  elements.btnViewGrid.addEventListener('click', () => {
    state.view = 'grid';
    elements.btnViewGrid.classList.add('active');
    elements.btnViewTable.classList.remove('active');
    fetchMedia();
  });

  elements.btnViewTable.addEventListener('click', () => {
    state.view = 'table';
    elements.btnViewTable.classList.add('active');
    elements.btnViewGrid.classList.remove('active');
    fetchMedia();
  });

  // Items per page
  elements.itemsPerPage.addEventListener('change', (e) => {
    state.limit = Number(e.target.value);
    state.page = 1;
    fetchMedia();
  });

  // Pagination navigation
  elements.btnPageFirst.addEventListener('click', () => { state.page = 1; fetchMedia(); });
  elements.btnPagePrev.addEventListener('click', () => { if (state.page > 1) { state.page--; fetchMedia(); } });
  elements.btnPageNext.addEventListener('click', () => { state.page++; fetchMedia(); });
  elements.btnPageLast.addEventListener('click', () => {
    const totalPages = Number(elements.totalPagesDisplay.textContent) || 1;
    state.page = totalPages;
    fetchMedia();
  });

  // Add / Edit Entry
  document.getElementById('btn-add-media').addEventListener('click', openAddModal);
  elements.mediaForm.addEventListener('submit', handleMediaFormSubmit);
  elements.entryCategory.addEventListener('change', (e) => {
    updateModalTypeOptions(e.target.value);
    checkDuplicateTitle(elements.entryName.value, e.target.value, state.activeEditingId);
  });

  elements.entryName.addEventListener('input', (e) => {
    clearTimeout(state.duplicateTimeout);
    state.duplicateTimeout = setTimeout(() => {
      checkDuplicateTitle(e.target.value, elements.entryCategory.value, state.activeEditingId);
    }, 300);
  });

  elements.entrySeasons.addEventListener('input', (e) => {
    renderModalSeasonChips(e.target.value);
  });

  elements.btnModalMarkAll.addEventListener('click', () => {
    elements.modalSeasonsContainer.querySelectorAll('.modal-season-check').forEach(c => {
      c.checked = true;
      c.parentElement.classList.add('watched');
      c.parentElement.classList.remove('unwatched');
    });
  });

  elements.btnModalClearAll.addEventListener('click', () => {
    elements.modalSeasonsContainer.querySelectorAll('.modal-season-check').forEach(c => {
      c.checked = false;
      c.parentElement.classList.remove('watched');
      c.parentElement.classList.add('unwatched');
    });
  });

  // Close modals
  document.querySelectorAll('.btn-close-modal').forEach(btn => btn.addEventListener('click', closeMediaModal));
  document.querySelectorAll('.btn-close-season-modal').forEach(btn => btn.addEventListener('click', closeSeasonModal));
  elements.btnSeasonModalDone.addEventListener('click', closeSeasonModal);

  elements.btnQuickMarkAll.addEventListener('click', () => {
    if (state.activeSeasonItem) {
      state.activeSeasonItem.watched = state.activeSeasonItem.watched.map(() => true);
      renderSeasonModalGrid();
      saveSeasonModalChanges();
    }
  });

  elements.btnQuickClearAll.addEventListener('click', () => {
    if (state.activeSeasonItem) {
      state.activeSeasonItem.watched = state.activeSeasonItem.watched.map(() => false);
      renderSeasonModalGrid();
      saveSeasonModalChanges();
    }
  });

  // Lucky Wheel
  document.getElementById('btn-open-wheel').addEventListener('click', openLuckyWheel);
  document.querySelectorAll('.btn-close-wheel-modal').forEach(btn => {
    btn.addEventListener('click', () => {
      elements.wheelModal.classList.add('hidden');
      document.body.classList.remove('modal-open');
    });
  });

  elements.wheelCategory.addEventListener('change', () => {
    updateWheelTypeOptions();
    loadWheelCandidates();
  });

  elements.wheelType.addEventListener('change', loadWheelCandidates);
  elements.btnSpinWheel.addEventListener('click', spinWheel);

  document.querySelectorAll('.btn-close-winner').forEach(btn => {
    btn.addEventListener('click', () => {
      elements.winnerModal.classList.add('hidden');
      document.body.classList.remove('modal-open');
    });
  });

  elements.btnWinnerWatchNow.addEventListener('click', async () => {
    if (!state.luckyWinner) return;
    try {
      await fetch(`/api/media/${state.luckyWinner.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'Watching' })
      });
      showToast(`"${state.luckyWinner.name}" marked as Currently Watching!`, 'success');
      elements.winnerModal.classList.add('hidden');
      document.body.classList.remove('modal-open');
      fetchMedia();
      loadStats();
    } catch (err) {
      showToast('Failed to update status.', 'error');
    }
  });

  elements.btnWinnerSearchGoogle.addEventListener('click', () => {
    if (!state.luckyWinner) return;
    const portal = createSearchLink(state.luckyWinner);
    window.open(portal.url, '_blank', 'noopener,noreferrer');
  });

  // Backup / Import Modal
  document.getElementById('btn-backup-modal').addEventListener('click', () => {
    elements.backupModal.classList.remove('hidden');
    document.body.classList.add('modal-open');
  });

  document.querySelectorAll('.btn-close-backup').forEach(btn => {
    btn.addEventListener('click', () => {
      elements.backupModal.classList.add('hidden');
      document.body.classList.remove('modal-open');
    });
  });

  elements.importFileInput.addEventListener('change', handleJsonImport);

  // View Duplicate button in warning box
  if (elements.btnViewDuplicate) {
    elements.btnViewDuplicate.addEventListener('click', () => {
      if (currentDuplicateEntry) {
        openEditModal(currentDuplicateEntry.id);
      }
    });
  }

  // Clean Duplicates tool
  if (elements.btnCleanDuplicates) {
    elements.btnCleanDuplicates.addEventListener('click', async () => {
      elements.btnCleanDuplicates.disabled = true;
      elements.btnCleanDuplicates.textContent = 'Scanning…';
      try {
        const res = await fetch('/api/media/clean-duplicates', { method: 'POST' });
        const json = await res.json();
        if (json.success) {
          showToast(json.message, 'success');
          fetchMedia();
          loadStats();
        } else {
          showToast(json.error || 'Clean failed.', 'error');
        }
      } catch (err) {
        showToast('Error cleaning duplicates.', 'error');
      } finally {
        elements.btnCleanDuplicates.disabled = false;
        elements.btnCleanDuplicates.innerHTML = '<i data-lucide="sparkles" class="w-3.5 h-3.5"></i> <span>Clean Library</span>';
        if (window.lucide) window.lucide.createIcons({ root: elements.btnCleanDuplicates });
      }
    });
  }

  // Shortcuts Modal
  document.getElementById('btn-shortcuts-modal').addEventListener('click', () => {
    elements.shortcutsModal.classList.remove('hidden');
    document.body.classList.add('modal-open');
  });

  document.querySelectorAll('.btn-close-shortcuts').forEach(btn => {
    btn.addEventListener('click', () => {
      elements.shortcutsModal.classList.add('hidden');
      document.body.classList.remove('modal-open');
    });
  });

  // Theme Toggle
  elements.btnThemeToggle.addEventListener('click', toggleTheme);

  // Delegated clicks for dynamic table and card elements
  document.addEventListener('click', (e) => {
    // Season chip toggle
    const seasonChip = e.target.closest('.season-chip');
    if (seasonChip && seasonChip.dataset.id && seasonChip.dataset.seasonIdx !== undefined) {
      e.stopPropagation();
      toggleSeasonDirect(seasonChip.dataset.id, Number(seasonChip.dataset.seasonIdx), seasonChip);
      return;
    }

    // Favorite toggle
    const favBtn = e.target.closest('.btn-toggle-favorite');
    if (favBtn && favBtn.dataset.id) {
      e.stopPropagation();
      toggleFavorite(favBtn.dataset.id);
      return;
    }

    // Open season modal
    const seasonModalBtn = e.target.closest('.btn-open-season-modal');
    if (seasonModalBtn && seasonModalBtn.dataset.id) {
      e.stopPropagation();
      openSeasonModal(seasonModalBtn.dataset.id);
      return;
    }

    // Edit item
    const editBtn = e.target.closest('.btn-edit-item');
    if (editBtn && editBtn.dataset.id) {
      e.stopPropagation();
      openEditModal(editBtn.dataset.id);
      return;
    }

// Title clicks now directly open external portals (IMDb / MissAV / HentaiHaven)

    // Delete item
    const deleteBtn = e.target.closest('.btn-delete-item');
    if (deleteBtn && deleteBtn.dataset.id) {
      e.stopPropagation();
      deleteItem(deleteBtn.dataset.id);
      return;
    }
  });

  // Global Keyboard Shortcuts
  window.addEventListener('keydown', (e) => {
    // Ignore when typing inside input / textarea / select
    const isEditingInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);

    if (e.key === 'Escape') {
      closeMediaModal();
      closeSeasonModal();
      elements.wheelModal.classList.add('hidden');
      elements.winnerModal.classList.add('hidden');
      elements.backupModal.classList.add('hidden');
      elements.shortcutsModal.classList.add('hidden');
      document.body.classList.remove('modal-open');
      return;
    }

    if (isEditingInput) return;

    if (e.key === '/') {
      e.preventDefault();
      elements.searchInput.focus();
    } else if (e.key === 'n' || e.key === 'N') {
      e.preventDefault();
      openAddModal();
    } else if (e.key === 'w' || e.key === 'W') {
      e.preventDefault();
      openLuckyWheel();
    } else if (e.key === 'g' || e.key === 'G') {
      elements.btnViewGrid.click();
    } else if (e.key === 't' || e.key === 'T') {
      elements.btnViewTable.click();
    }
  });
}

// --- Application Bootstrap ---
document.addEventListener('DOMContentLoaded', () => {
  if (window.lucide) window.lucide.createIcons();
  initTheme();
  updateFilterTypeOptions();
  setupEventListeners();
  loadStats();
  fetchMedia();
});

window.addEventListener('load', () => {
  if (window.lucide) window.lucide.createIcons();
});
