import {
  getAll,
  getById,
  getByIndex,
  put,
  remove,
  createId
} from '../db.js';
import { Chronometer, formatLapTime } from '../chrono.js';
import { parseLapTime, bestLap, sessionStats } from '../models.js';
import { createSessionLapChart } from '../stats.js';
import { fetchWeatherFromGps, manualWeather, formatWeather } from '../weather.js';
import { confirmAction, escapeHtml, showToast, navigate } from '../ui.js';
import { photoUrl, thumbImgHtml } from '../photos.js';

let activeChrono = null;
let sessionLapChart = null;

function destroySessionLapChart() {
  if (sessionLapChart) {
    sessionLapChart.destroy();
    sessionLapChart = null;
  }
}

export async function renderSession(root, params = {}) {
  if (activeChrono) {
    activeChrono.reset();
    activeChrono = null;
  }
  destroySessionLapChart();

  if (params.sessionId) {
    await renderSessionDetail(root, params.sessionId);
    return;
  }
  await renderSessionCreate(root);
}

async function renderSessionCreate(root) {
  const [circuits, pilots, karts, setups] = await Promise.all([
    getAll('circuits'),
    getAll('pilots'),
    getAll('karts'),
    getAll('setups')
  ]);

  const missing = [];
  if (!circuits.length) missing.push('circuit');
  if (!pilots.length) missing.push('pilote');
  if (!karts.length) missing.push('kart');

  if (missing.length) {
    root.innerHTML = `
      <div class="stack">
        <h1>Nouvelle session</h1>
        <div class="empty">
          Il manque : ${missing.join(', ')}.<br />
          <a href="#/data">Compléter les données</a>
        </div>
      </div>
    `;
    return;
  }

  circuits.sort((a, b) => a.name.localeCompare(b.name));
  pilots.sort((a, b) => a.name.localeCompare(b.name));
  karts.sort((a, b) => a.name.localeCompare(b.name));

  root.innerHTML = `
    <div class="stack">
      <div>
        <h1>Nouvelle session</h1>
        <p>Choisis circuit, pilote, kart, météo puis démarre.</p>
      </div>

      <form class="form" id="session-form">
        <div class="field">
          <label for="circuitId">Circuit</label>
          <select id="circuitId" name="circuitId" required>
            ${circuits.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('')}
          </select>
        </div>
        <div class="field">
          <label for="pilotId">Pilote</label>
          <select id="pilotId" name="pilotId" required>
            ${pilots.map((p) => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('')}
          </select>
        </div>
        <div class="field">
          <label for="kartId">Kart</label>
          <select id="kartId" name="kartId" required>
            ${karts.map((k) => `<option value="${k.id}">${escapeHtml(k.name)}</option>`).join('')}
          </select>
        </div>
        <div class="field">
          <label for="setupId">Réglage</label>
          <select id="setupId" name="setupId">
            <option value="">— Aucun —</option>
          </select>
        </div>
        <div class="field">
          <label for="date">Date</label>
          <input id="date" name="date" type="datetime-local" required />
        </div>

        <div class="card">
          <h3>Météo</h3>
          <p id="weather-preview" class="muted">Non renseignée</p>
          <div class="row" style="margin-top:8px">
            <button type="button" class="btn btn--secondary btn--sm" id="btn-weather-gps">Météo GPS</button>
            <button type="button" class="btn btn--ghost btn--sm" id="btn-weather-manual">Saisie manuelle</button>
          </div>
          <div id="manual-weather" class="stack hidden" style="margin-top:12px">
            <div class="grid-2">
              <div class="field">
                <label for="tempC">Température (°C)</label>
                <input id="tempC" type="number" step="0.1" />
              </div>
              <div class="field">
                <label for="windKmh">Vent (km/h)</label>
                <input id="windKmh" type="number" step="0.1" />
              </div>
            </div>
            <div class="grid-2">
              <div class="field">
                <label for="humidity">Humidité (%)</label>
                <input id="humidity" type="number" min="0" max="100" />
              </div>
              <div class="field">
                <label for="condition">Condition</label>
                <input id="condition" type="text" maxlength="60" placeholder="Sec, humide…" />
              </div>
            </div>
            <button type="button" class="btn btn--sm" id="btn-apply-manual">Appliquer</button>
          </div>
        </div>

        <div class="field">
          <label for="notes">Notes de session</label>
          <textarea id="notes" name="notes" maxlength="2000"></textarea>
        </div>

        <button type="submit" class="btn btn--block btn--xl">Créer la session</button>
      </form>
    </div>
  `;

  let weather = null;
  const weatherPreview = root.querySelector('#weather-preview');
  const setupSelect = root.querySelector('#setupId');
  const kartSelect = root.querySelector('#kartId');
  const dateInput = root.querySelector('#date');

  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  dateInput.value = now.toISOString().slice(0, 16);

  function refreshSetups() {
    const kartId = kartSelect.value;
    const list = setups.filter((s) => s.kartId === kartId);
    setupSelect.innerHTML =
      `<option value="">— Aucun —</option>` +
      list.map((s) => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('');
  }
  refreshSetups();
  kartSelect.addEventListener('change', refreshSetups);

  root.querySelector('#btn-weather-gps').addEventListener('click', async () => {
    weatherPreview.textContent = 'Récupération…';
    try {
      weather = await fetchWeatherFromGps();
      weatherPreview.textContent = formatWeather(weather);
      showToast('Météo GPS récupérée');
    } catch (err) {
      weatherPreview.textContent = 'Échec GPS — utilise la saisie manuelle';
      showToast(err.message || 'Météo GPS impossible');
    }
  });

  root.querySelector('#btn-weather-manual').addEventListener('click', () => {
    root.querySelector('#manual-weather').classList.toggle('hidden');
  });

  root.querySelector('#btn-apply-manual').addEventListener('click', () => {
    weather = manualWeather({
      tempC: root.querySelector('#tempC').value,
      windKmh: root.querySelector('#windKmh').value,
      humidity: root.querySelector('#humidity').value,
      condition: root.querySelector('#condition').value
    });
    weatherPreview.textContent = formatWeather(weather);
    showToast('Météo manuelle enregistrée');
  });

  root.querySelector('#session-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const localDate = String(fd.get('date'));
    const dateIso = new Date(localDate).toISOString();
    const session = {
      id: createId(),
      circuitId: String(fd.get('circuitId')),
      pilotId: String(fd.get('pilotId')),
      kartId: String(fd.get('kartId')),
      setupId: String(fd.get('setupId') || '') || null,
      date: dateIso,
      weather,
      notes: String(fd.get('notes') || '').trim()
    };
    await put('sessions', session);
    showToast('Session créée');
    navigate(`#/session/${session.id}`);
  });
}

async function renderSessionDetail(root, sessionId) {
  let session = await getById('sessions', sessionId);
  if (!session) {
    root.innerHTML = `<div class="empty">Session introuvable. <a href="#/session">Nouvelle</a></div>`;
    return;
  }

  const [circuit, pilot, kart, setup, laps] = await Promise.all([
    getById('circuits', session.circuitId),
    getById('pilots', session.pilotId),
    getById('karts', session.kartId),
    session.setupId ? getById('setups', session.setupId) : null,
    getByIndex('laps', 'bySession', sessionId)
  ]);

  laps.sort((a, b) => a.lapNumber - b.lapNumber);
  const stats = sessionStats(laps);
  const best = bestLap(laps);

  const circuitThumb = circuit?.photo
    ? `<img class="photo-thumb" src="${photoUrl(circuit.photo)}" alt="Plan" />`
    : '';
  const pilotThumb = pilot?.photo
    ? `<img class="photo-avatar" src="${photoUrl(pilot.photo)}" alt="${escapeHtml(pilot.name)}" />`
    : '';

  root.innerHTML = `
    <div class="stack">
      <div>
        <a class="muted" href="#/">← Accueil</a>
        <h1>${escapeHtml(circuit?.name || 'Session')}</h1>
        <p>${escapeHtml(pilot?.name || '—')} · ${escapeHtml(kart?.name || '—')}${
          setup ? ` · ${escapeHtml(setup.name)}` : ''
        }</p>
        <div class="session-photos" style="margin-top:8px">
          ${circuitThumb}${pilotThumb}
          ${kart?.photo ? thumbImgHtml(kart.photo, { className: 'photo-thumb', alt: escapeHtml(kart.name) }) : ''}
        </div>
      </div>

      <div class="card">
        <div class="muted">Météo</div>
        <div>${escapeHtml(formatWeather(session.weather))}</div>
      </div>

      <div class="card">
        <h3>Notes de session</h3>
        <div class="field">
          <textarea id="session-notes" maxlength="2000" rows="3">${escapeHtml(session.notes || '')}</textarea>
        </div>
        <button type="button" class="btn btn--secondary btn--sm" id="btn-save-notes">Enregistrer les notes</button>
      </div>

      <div class="stat-grid">
        <div class="stat">
          <div class="stat__value">${stats.count}</div>
          <div class="stat__label">Tours</div>
        </div>
        <div class="stat">
          <div class="stat__value">${formatLapTime(stats.bestMs)}</div>
          <div class="stat__label">Best</div>
        </div>
        <div class="stat">
          <div class="stat__value">${formatLapTime(stats.avgMs)}</div>
          <div class="stat__label">Moyenne</div>
        </div>
      </div>

      <div class="card" id="session-chart-card">
        <h3>Graphique des tours</h3>
        <div class="chart-wrap"><canvas id="chart-session-laps"></canvas></div>
        <p class="muted" id="session-chart-empty" ${laps.some((l) => !l.invalidated) ? 'hidden' : ''}>Ajoute des tours pour voir le graphique.</p>
      </div>

      <div class="card chrono">
        <div class="chrono__lap" id="chrono-state-label">Prêt</div>
        <div class="chrono__display" id="chrono-display">0:00.000</div>
        <div class="row" style="justify-content:center">
          <button type="button" class="btn btn--xl" id="btn-start-pause">Start</button>
          <button type="button" class="btn btn--secondary btn--xl" id="btn-split" disabled>Split</button>
          <button type="button" class="btn btn--ghost btn--xl" id="btn-stop" disabled>Stop</button>
        </div>
      </div>

      <div class="card">
        <h3>Saisie manuelle</h3>
        <form class="form" id="manual-form">
          <div class="field">
            <label for="manual-time">Temps (m:ss.mmm)</label>
            <input id="manual-time" name="time" placeholder="1:12.345" required />
          </div>
          <div class="field">
            <label for="manual-notes">Note du tour (optionnel)</label>
            <input id="manual-notes" name="notes" maxlength="300" placeholder="Freinage T3, sous-vire…" />
          </div>
          <button type="submit" class="btn btn--block">Ajouter le tour</button>
        </form>
      </div>

      <div>
        <h2>Tours</h2>
        <div id="laps-list">
          ${renderLapsHtml(laps, best?.id)}
        </div>
      </div>

      <button type="button" class="btn btn--danger btn--block" id="btn-delete-session">Supprimer la session</button>
    </div>
  `;

  const chrono = new Chronometer();
  activeChrono = chrono;
  const display = root.querySelector('#chrono-display');
  const stateLabel = root.querySelector('#chrono-state-label');
  const btnStartPause = root.querySelector('#btn-start-pause');
  const btnSplit = root.querySelector('#btn-split');
  const btnStop = root.querySelector('#btn-stop');

  function syncChronoUi({ lapMs, state }) {
    display.textContent = formatLapTime(lapMs);
    if (state === 'running') {
      btnStartPause.textContent = 'Pause';
      btnStartPause.disabled = false;
      btnSplit.disabled = false;
      btnStop.disabled = false;
      stateLabel.textContent = 'En course';
    } else if (state === 'paused') {
      btnStartPause.textContent = 'Reprendre';
      btnStartPause.disabled = false;
      btnSplit.disabled = true;
      btnStop.disabled = false;
      stateLabel.textContent = 'En pause';
    } else {
      btnStartPause.textContent = 'Start';
      btnStartPause.disabled = false;
      btnSplit.disabled = true;
      btnStop.disabled = true;
      stateLabel.textContent = 'Prêt';
    }
  }

  chrono.onTick = syncChronoUi;

  btnStartPause.addEventListener('click', () => {
    chrono.togglePause();
  });

  btnSplit.addEventListener('click', async () => {
    const timeMs = chrono.split();
    if (timeMs == null || timeMs < 50) return;
    await addLap(sessionId, timeMs, 'chrono');
    await refreshLaps(root, sessionId);
  });

  btnStop.addEventListener('click', async () => {
    const last = chrono.stop();
    syncChronoUi({ lapMs: 0, state: 'idle' });
    display.textContent = '0:00.000';
    if (last != null && last >= 50) {
      await addLap(sessionId, last, 'chrono');
      await refreshLaps(root, sessionId);
    }
  });

  root.querySelector('#btn-save-notes').addEventListener('click', async () => {
    const notes = root.querySelector('#session-notes').value.trim();
    session = { ...session, notes };
    await put('sessions', session);
    showToast('Notes enregistrées');
  });

  root.querySelector('#manual-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = root.querySelector('#manual-time');
    const notesInput = root.querySelector('#manual-notes');
    const timeMs = parseLapTime(input.value);
    if (timeMs == null) {
      showToast('Format invalide (ex. 1:12.345)');
      return;
    }
    await addLap(sessionId, timeMs, 'manual', notesInput.value.trim());
    input.value = '';
    notesInput.value = '';
    await refreshLaps(root, sessionId);
    showToast('Tour ajouté');
  });

  root.querySelector('#laps-list').addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const lapId = btn.closest('[data-lap-id]').dataset.lapId;
    const lap = (await getByIndex('laps', 'bySession', sessionId)).find((l) => l.id === lapId);
    if (!lap) return;

    if (btn.dataset.action === 'toggle') {
      lap.invalidated = !lap.invalidated;
      await put('laps', lap);
      await refreshLaps(root, sessionId);
    }
    if (btn.dataset.action === 'edit') {
      openLapEditModal(root, sessionId, lap);
    }
    if (btn.dataset.action === 'delete') {
      if (!confirmAction('Supprimer ce tour ?')) return;
      await remove('laps', lapId);
      await renumberLaps(sessionId);
      await refreshLaps(root, sessionId);
    }
  });

  root.querySelector('#btn-delete-session').addEventListener('click', async () => {
    if (!confirmAction('Supprimer cette session et tous ses tours ?')) return;
    const all = await getByIndex('laps', 'bySession', sessionId);
    for (const l of all) await remove('laps', l.id);
    await remove('sessions', sessionId);
    if (activeChrono) {
      activeChrono.reset();
      activeChrono = null;
    }
    destroySessionLapChart();
    showToast('Session supprimée');
    navigate('#/');
  });

  paintSessionChart(root, laps);
}

function openLapEditModal(root, sessionId, lap) {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true">
      <h2>Tour #${lap.lapNumber}</h2>
      <form class="form" id="lap-edit-form">
        <div class="field">
          <label for="edit-time">Temps (m:ss.mmm)</label>
          <input id="edit-time" name="time" required value="${formatLapTime(lap.timeMs)}" />
        </div>
        <div class="field">
          <label for="edit-notes">Note du tour</label>
          <textarea id="edit-notes" name="notes" maxlength="300" rows="3">${escapeHtml(lap.notes || '')}</textarea>
        </div>
        <div class="row">
          <button type="button" class="btn btn--ghost" id="cancel">Annuler</button>
          <button type="submit" class="btn" style="flex:1">Enregistrer</button>
        </div>
      </form>
    </div>
  `;
  document.body.appendChild(backdrop);
  const close = () => backdrop.remove();
  backdrop.querySelector('#cancel').addEventListener('click', close);
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) close();
  });

  backdrop.querySelector('#lap-edit-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const timeMs = parseLapTime(backdrop.querySelector('#edit-time').value);
    if (timeMs == null) {
      showToast('Format invalide (ex. 1:12.345)');
      return;
    }
    lap.timeMs = Math.round(timeMs);
    lap.notes = backdrop.querySelector('#edit-notes').value.trim();
    await put('laps', lap);
    showToast('Tour mis à jour');
    close();
    await refreshLaps(root, sessionId);
  });
}

function renderLapsHtml(laps, bestId) {
  if (!laps.length) return `<div class="empty">Aucun tour pour l’instant.</div>`;
  return laps
    .map((l) => {
      const classes = [
        'lap-row',
        l.id === bestId && !l.invalidated ? 'lap-row--best' : '',
        l.invalidated ? 'lap-row--invalid' : ''
      ]
        .filter(Boolean)
        .join(' ');
      const notePreview = l.notes
        ? `<div class="lap-note" title="${escapeHtml(l.notes)}">${escapeHtml(l.notes)}</div>`
        : '';
      return `
        <div class="${classes}" data-lap-id="${l.id}">
          <div>#${l.lapNumber}</div>
          <div>
            <div class="lap-row__time">${formatLapTime(l.timeMs)} <span class="muted">${l.source === 'chrono' ? 'chrono' : 'manuel'}</span></div>
            ${notePreview}
          </div>
          <div class="row">
            <button type="button" class="btn btn--ghost btn--sm" data-action="edit">Édit.</button>
            <button type="button" class="btn btn--ghost btn--sm" data-action="toggle">${l.invalidated ? 'OK' : 'Inval.'}</button>
            <button type="button" class="btn btn--danger btn--sm" data-action="delete">×</button>
          </div>
        </div>`;
    })
    .join('');
}

async function addLap(sessionId, timeMs, source, notes = '') {
  const existing = await getByIndex('laps', 'bySession', sessionId);
  const lapNumber = existing.length + 1;
  await put('laps', {
    id: createId(),
    sessionId,
    lapNumber,
    timeMs: Math.round(timeMs),
    source,
    notes: notes || '',
    invalidated: false
  });
}

async function renumberLaps(sessionId) {
  const laps = (await getByIndex('laps', 'bySession', sessionId)).sort(
    (a, b) => a.lapNumber - b.lapNumber
  );
  let n = 1;
  for (const lap of laps) {
    lap.lapNumber = n++;
    await put('laps', lap);
  }
}

function paintSessionChart(root, laps) {
  destroySessionLapChart();
  const canvas = root.querySelector('#chart-session-laps');
  const empty = root.querySelector('#session-chart-empty');
  const hasData = laps.some((l) => !l.invalidated && l.timeMs > 0);
  if (empty) empty.hidden = hasData;
  if (!hasData || !canvas) return;
  sessionLapChart = createSessionLapChart(canvas, laps);
}

async function refreshLaps(root, sessionId) {
  const laps = (await getByIndex('laps', 'bySession', sessionId)).sort(
    (a, b) => a.lapNumber - b.lapNumber
  );
  const stats = sessionStats(laps);
  const best = bestLap(laps);
  const list = root.querySelector('#laps-list');
  if (list) list.innerHTML = renderLapsHtml(laps, best?.id);

  const statsEls = root.querySelectorAll('.stat__value');
  if (statsEls.length >= 3) {
    statsEls[0].textContent = String(stats.count);
    statsEls[1].textContent = formatLapTime(stats.bestMs);
    statsEls[2].textContent = formatLapTime(stats.avgMs);
  }

  paintSessionChart(root, laps);
}
