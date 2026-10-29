import { initDb } from './db.js';
import { escapeHtml, setNavigateHandler } from './ui.js';
import { revokeAllPhotoUrls } from './photos.js';
import { renderHome } from './views/home.js';
import { renderData } from './views/data.js';
import { renderCircuits } from './views/circuits.js';
import { renderPilots } from './views/pilots.js';
import { renderKarts } from './views/karts.js';
import { renderSession } from './views/session.js';
import { renderStats } from './views/stats.js';

const viewEl = document.getElementById('view');
const installBtn = document.getElementById('install-btn');
let deferredPrompt = null;

function parseRoute() {
  const raw = (location.hash || '#/').replace(/^#/, '') || '/';
  const path = raw.startsWith('/') ? raw : `/${raw}`;
  const parts = path.split('/').filter(Boolean);

  if (parts.length === 0) return { name: 'home', params: {} };
  if (parts[0] === 'data') return { name: 'data', params: {} };
  if (parts[0] === 'circuits') return { name: 'circuits', params: {} };
  if (parts[0] === 'pilots') return { name: 'pilots', params: {} };
  if (parts[0] === 'karts') return { name: 'karts', params: { kartId: parts[1] || null } };
  if (parts[0] === 'stats') return { name: 'stats', params: {} };
  if (parts[0] === 'session') {
    return { name: 'session', params: { sessionId: parts[1] || null } };
  }
  return { name: 'home', params: {} };
}

function updateNav(route) {
  const map = {
    home: '/',
    session: '/session',
    stats: '/stats',
    data: '/data',
    circuits: '/data',
    pilots: '/data',
    karts: '/data'
  };
  const active = map[route.name] || '/';
  document.querySelectorAll('.bottom-nav__item').forEach((a) => {
    a.classList.toggle('is-active', a.dataset.route === active);
  });
}

async function route() {
  const r = parseRoute();
  updateNav(r);
  revokeAllPhotoUrls();
  viewEl.innerHTML = '<p class="muted">Chargement…</p>';

  try {
    switch (r.name) {
      case 'home':
        await renderHome(viewEl);
        break;
      case 'data':
        await renderData(viewEl);
        break;
      case 'circuits':
        await renderCircuits(viewEl);
        break;
      case 'pilots':
        await renderPilots(viewEl);
        break;
      case 'karts':
        await renderKarts(viewEl, r.params);
        break;
      case 'session':
        await renderSession(viewEl, r.params);
        break;
      case 'stats':
        await renderStats(viewEl);
        break;
      default:
        await renderHome(viewEl);
    }
  } catch (err) {
    console.error(err);
    viewEl.innerHTML = `<div class="empty">Erreur : ${escapeHtml(err.message || String(err))}</div>`;
  }
}

function setupInstall() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    installBtn.classList.remove('hidden');
  });

  installBtn.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    installBtn.classList.add('hidden');
  });

  window.addEventListener('appinstalled', () => {
    installBtn.classList.add('hidden');
    deferredPrompt = null;
  });
}

function registerSw() {
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((err) => {
      console.warn('SW registration failed', err);
    });
  });
}

async function boot() {
  await initDb();
  setupInstall();
  registerSw();
  setNavigateHandler(route);
  window.addEventListener('hashchange', route);
  await route();
}

boot();
