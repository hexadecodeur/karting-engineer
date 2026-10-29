import { getAll } from '../db.js';
import { formatLapTime, formatDate } from '../models.js';
import {
  groupLapsBySession,
  bestLapBySessionOverTime,
  byMonth,
  comparePilots,
  computeSessionView,
  createSessionLapChart
} from '../stats.js';
import { escapeHtml } from '../ui.js';

let chartInstance = null;

function destroyChart() {
  if (chartInstance) {
    chartInstance.destroy();
    chartInstance = null;
  }
}

export async function renderStats(root) {
  destroyChart();

  const [circuits, pilots, sessions, laps] = await Promise.all([
    getAll('circuits'),
    getAll('pilots'),
    getAll('sessions'),
    getAll('laps')
  ]);

  circuits.sort((a, b) => a.name.localeCompare(b.name));
  pilots.sort((a, b) => a.name.localeCompare(b.name));
  sessions.sort((a, b) => new Date(b.date) - new Date(a.date));

  const lapsBySession = groupLapsBySession(laps);
  const circuitMap = Object.fromEntries(circuits.map((c) => [c.id, c]));
  const pilotMap = Object.fromEntries(pilots.map((p) => [p.id, p]));

  root.innerHTML = `
    <div class="stack">
      <div>
        <h1>Statistiques</h1>
        <p>Progression, volumes et comparaisons pilotes.</p>
      </div>

      <div class="tabs" role="tablist">
        <button type="button" class="tab is-active" data-tab="session">Session</button>
        <button type="button" class="tab" data-tab="circuit">Circuit</button>
        <button type="button" class="tab" data-tab="month">Mois</button>
        <button type="button" class="tab" data-tab="compare">Comparer</button>
      </div>

      <div id="stats-panel"></div>
    </div>
  `;

  const panel = root.querySelector('#stats-panel');
  const tabs = root.querySelectorAll('.tab');

  const state = {
    tab: 'session',
    sessionId: sessions[0]?.id || '',
    circuitId: circuits[0]?.id || '',
    pilotId: ''
  };

  function setTab(tab) {
    state.tab = tab;
    tabs.forEach((t) => t.classList.toggle('is-active', t.dataset.tab === tab));
    renderPanel();
  }

  tabs.forEach((t) => t.addEventListener('click', () => setTab(t.dataset.tab)));

  function renderPanel() {
    destroyChart();
    if (state.tab === 'session') renderSessionTab();
    else if (state.tab === 'circuit') renderCircuitTab();
    else if (state.tab === 'month') renderMonthTab();
    else renderCompareTab();
  }

  function renderSessionTab() {
    if (!sessions.length) {
      panel.innerHTML = `<div class="empty">Aucune session à analyser.</div>`;
      return;
    }

    panel.innerHTML = `
      <div class="field">
        <label for="session-select">Session</label>
        <select id="session-select">
          ${sessions
            .map((s) => {
              const label = `${formatDate(s.date)} — ${circuitMap[s.circuitId]?.name || '?'} / ${pilotMap[s.pilotId]?.name || '?'}`;
              return `<option value="${s.id}" ${s.id === state.sessionId ? 'selected' : ''}>${escapeHtml(label)}</option>`;
            })
            .join('')}
        </select>
      </div>
      <div id="session-body"></div>
    `;

    const select = panel.querySelector('#session-select');
    select.addEventListener('change', () => {
      state.sessionId = select.value;
      paintSessionBody();
    });
    paintSessionBody();
  }

  function paintSessionBody() {
    const body = panel.querySelector('#session-body');
    const session = sessions.find((s) => s.id === state.sessionId);
    if (!session || !body) return;
    const view = computeSessionView(session, lapsBySession.get(session.id) || []);
    const { stats, laps: sessionLaps } = view;
    const bestId = sessionLaps
      .filter((l) => !l.invalidated)
      .sort((a, b) => a.timeMs - b.timeMs)[0]?.id;

    const hasChartData = sessionLaps.some((l) => !l.invalidated && l.timeMs > 0);

    body.innerHTML = `
      <div class="stat-grid" style="margin-top:12px">
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
      <div class="stat" style="margin-top:8px">
        <div class="stat__value">${formatLapTime(stats.stdMs)}</div>
        <div class="stat__label">Régularité (écart-type)</div>
      </div>
      ${
        hasChartData
          ? `<div class="card" style="margin-top:12px">
              <h3>Graphique des tours</h3>
              <div class="chart-wrap"><canvas id="chart-session-laps"></canvas></div>
            </div>`
          : ''
      }
      <div style="margin-top:12px">
        ${
          sessionLaps.length
            ? sessionLaps
                .map(
                  (l) => `
              <div class="lap-row ${l.id === bestId ? 'lap-row--best' : ''} ${l.invalidated ? 'lap-row--invalid' : ''}">
                <div>#${l.lapNumber}</div>
                <div class="lap-row__time">${formatLapTime(l.timeMs)}</div>
                <div class="muted">${l.source}</div>
              </div>`
                )
                .join('')
            : `<div class="empty">Pas de tours.</div>`
        }
      </div>
      <a class="btn btn--secondary btn--block" style="margin-top:12px" href="#/session/${session.id}">Ouvrir la session</a>
    `;

    destroyChart();
    if (hasChartData) {
      const canvas = body.querySelector('#chart-session-laps');
      chartInstance = createSessionLapChart(canvas, sessionLaps);
    }
  }

  function renderCircuitTab() {
    if (!circuits.length || !sessions.length) {
      panel.innerHTML = `<div class="empty">Pas assez de données.</div>`;
      return;
    }

    panel.innerHTML = `
      <div class="field">
        <label for="circuit-select">Circuit</label>
        <select id="circuit-select">
          ${circuits
            .map(
              (c) =>
                `<option value="${c.id}" ${c.id === state.circuitId ? 'selected' : ''}>${escapeHtml(c.name)}</option>`
            )
            .join('')}
        </select>
      </div>
      <div class="field">
        <label for="pilot-filter">Pilote (optionnel)</label>
        <select id="pilot-filter">
          <option value="">Tous</option>
          ${pilots
            .map(
              (p) =>
                `<option value="${p.id}" ${p.id === state.pilotId ? 'selected' : ''}>${escapeHtml(p.name)}</option>`
            )
            .join('')}
        </select>
      </div>
      <div class="chart-wrap"><canvas id="chart-circuit"></canvas></div>
      <p class="muted" id="circuit-hint"></p>
    `;

    panel.querySelector('#circuit-select').addEventListener('change', (e) => {
      state.circuitId = e.target.value;
      paintCircuitChart();
    });
    panel.querySelector('#pilot-filter').addEventListener('change', (e) => {
      state.pilotId = e.target.value;
      paintCircuitChart();
    });
    paintCircuitChart();
  }

  function paintCircuitChart() {
    let scoped = sessions.filter((s) => s.circuitId === state.circuitId);
    if (state.pilotId) scoped = scoped.filter((s) => s.pilotId === state.pilotId);
    const series = bestLapBySessionOverTime(scoped, lapsBySession);
    const hint = panel.querySelector('#circuit-hint');
    if (hint) {
      hint.textContent = series.length
        ? `${series.length} session(s) avec best lap`
        : 'Aucun best lap sur ce filtre';
    }

    const canvas = panel.querySelector('#chart-circuit');
    if (!canvas || typeof Chart === 'undefined') return;

    destroyChart();
    chartInstance = new Chart(canvas, {
      type: 'line',
      data: {
        labels: series.map((r) => formatDate(r.date)),
        datasets: [
          {
            label: 'Best lap',
            data: series.map((r) => r.bestMs / 1000),
            borderColor: '#c4f542',
            backgroundColor: 'rgba(196, 245, 66, 0.15)',
            tension: 0.25,
            fill: true,
            pointRadius: 4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => formatLapTime(Math.round(ctx.parsed.y * 1000))
            }
          }
        },
        scales: {
          y: {
            title: { display: true, text: 'Secondes', color: '#8b97a8' },
            ticks: { color: '#8b97a8' },
            grid: { color: '#2a3340' }
          },
          x: {
            ticks: { color: '#8b97a8', maxRotation: 45 },
            grid: { display: false }
          }
        }
      }
    });
  }

  function renderMonthTab() {
    if (!sessions.length) {
      panel.innerHTML = `<div class="empty">Aucune session.</div>`;
      return;
    }

    const rows = byMonth(sessions, lapsBySession);
    panel.innerHTML = `
      <div class="chart-wrap"><canvas id="chart-month"></canvas></div>
      <div class="list" style="margin-top:12px">
        ${rows
          .map(
            (r) => `
          <div class="list-item">
            <div>
              <div class="list-item__title">${escapeHtml(r.label)}</div>
              <div class="list-item__meta">${r.sessionCount} session(s) · ${r.lapCount} tours</div>
            </div>
            <div class="badge">${formatLapTime(r.bestMs)}</div>
          </div>`
          )
          .join('')}
      </div>
    `;

    const canvas = panel.querySelector('#chart-month');
    if (!canvas || typeof Chart === 'undefined') return;
    destroyChart();
    chartInstance = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: rows.map((r) => r.label),
        datasets: [
          {
            label: 'Tours',
            data: rows.map((r) => r.lapCount),
            backgroundColor: '#c4f542',
            borderRadius: 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { color: '#8b97a8', precision: 0 },
            grid: { color: '#2a3340' }
          },
          x: {
            ticks: { color: '#8b97a8' },
            grid: { display: false }
          }
        }
      }
    });
  }

  function renderCompareTab() {
    if (pilots.length < 1 || !circuits.length) {
      panel.innerHTML = `<div class="empty">Ajoute des pilotes et des sessions pour comparer.</div>`;
      return;
    }

    panel.innerHTML = `
      <div class="field">
        <label for="compare-circuit">Circuit</label>
        <select id="compare-circuit">
          ${circuits
            .map(
              (c) =>
                `<option value="${c.id}" ${c.id === state.circuitId ? 'selected' : ''}>${escapeHtml(c.name)}</option>`
            )
            .join('')}
        </select>
      </div>
      <div class="chart-wrap"><canvas id="chart-compare"></canvas></div>
      <div id="compare-table" style="margin-top:12px"></div>
    `;

    panel.querySelector('#compare-circuit').addEventListener('change', (e) => {
      state.circuitId = e.target.value;
      paintCompare();
    });
    paintCompare();
  }

  function paintCompare() {
    const scoped = sessions.filter((s) => s.circuitId === state.circuitId);
    const rows = comparePilots(scoped, lapsBySession, pilots);
    const table = panel.querySelector('#compare-table');
    if (table) {
      table.innerHTML = rows.length
        ? rows
            .map(
              (r) => `
            <div class="list-item">
              <div>
                <div class="list-item__title">${escapeHtml(r.name)}</div>
                <div class="list-item__meta">${r.lapCount} tours · moy. ${formatLapTime(r.avgMs)}</div>
              </div>
              <div class="badge">${formatLapTime(r.bestMs)}</div>
            </div>`
            )
            .join('')
        : `<div class="empty">Pas de données sur ce circuit.</div>`;
    }

    const canvas = panel.querySelector('#chart-compare');
    if (!canvas || typeof Chart === 'undefined') return;
    destroyChart();
    chartInstance = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: rows.map((r) => r.name),
        datasets: [
          {
            label: 'Best (s)',
            data: rows.map((r) => (r.bestMs == null ? null : r.bestMs / 1000)),
            backgroundColor: '#c4f542',
            borderRadius: 6
          },
          {
            label: 'Moyenne (s)',
            data: rows.map((r) => (r.avgMs == null ? null : r.avgMs / 1000)),
            backgroundColor: '#3dd68c',
            borderRadius: 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: '#8b97a8' } },
          tooltip: {
            callbacks: {
              label: (ctx) =>
                `${ctx.dataset.label}: ${formatLapTime(Math.round(ctx.parsed.y * 1000))}`
            }
          }
        },
        scales: {
          y: {
            ticks: { color: '#8b97a8' },
            grid: { color: '#2a3340' }
          },
          x: {
            ticks: { color: '#8b97a8' },
            grid: { display: false }
          }
        }
      }
    });
  }

  renderPanel();
}
