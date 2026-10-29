import { getAll, count } from '../db.js';
import { formatDate, formatLapTime, bestLap } from '../models.js';
import { groupLapsBySession } from '../stats.js';
import { escapeHtml } from '../ui.js';
import { thumbImgHtml } from '../photos.js';

export async function renderHome(root) {
  const [circuits, pilots, karts, sessions, laps] = await Promise.all([
    count('circuits'),
    count('pilots'),
    count('karts'),
    getAll('sessions'),
    getAll('laps')
  ]);

  const lapsBySession = groupLapsBySession(laps);
  const recent = [...sessions]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 5);

  const circuitMap = Object.fromEntries((await getAll('circuits')).map((c) => [c.id, c]));
  const pilotMap = Object.fromEntries((await getAll('pilots')).map((p) => [p.id, p]));

  root.innerHTML = `
    <div class="stack">
      <div>
        <h1>Accueil</h1>
        <p>Ingénieur de piste — données locales sur cet appareil.</p>
      </div>

      <div class="stat-grid">
        <div class="stat">
          <div class="stat__value">${circuits}</div>
          <div class="stat__label">Circuits</div>
        </div>
        <div class="stat">
          <div class="stat__value">${pilots}</div>
          <div class="stat__label">Pilotes</div>
        </div>
        <div class="stat">
          <div class="stat__value">${karts}</div>
          <div class="stat__label">Karts</div>
        </div>
      </div>

      <a class="btn btn--block btn--xl" href="#/session">Nouvelle session</a>

      <div class="row row--spread">
        <h2>Sessions récentes</h2>
        <a class="muted" href="#/stats">Voir stats</a>
      </div>

      ${
        recent.length === 0
          ? `<div class="empty">Aucune session. Crée d'abord un circuit, un pilote et un kart, puis lance une session.</div>`
          : `<div class="list">${recent
              .map((s) => {
                const best = bestLap(lapsBySession.get(s.id) || []);
                const circuit = circuitMap[s.circuitId]?.name || 'Circuit';
                const pilot = pilotMap[s.pilotId]?.name || 'Pilote';
                const pilotPhoto = pilotMap[s.pilotId]?.photo;
                return `
                <a class="list-item card--clickable" href="#/session/${s.id}" style="text-decoration:none;color:inherit">
                  <div class="list-item__main">
                    ${thumbImgHtml(pilotPhoto, { className: 'photo-avatar', alt: escapeHtml(pilot) })}
                    <div>
                      <div class="list-item__title">${escapeHtml(circuit)}</div>
                      <div class="list-item__meta">${escapeHtml(pilot)} · ${formatDate(s.date)}</div>
                    </div>
                  </div>
                  <div class="badge">${best ? formatLapTime(best.timeMs) : '—'}</div>
                </a>`;
              })
              .join('')}</div>`
      }

      <div class="card">
        <h3>Démarrage rapide</h3>
        <p class="muted" style="margin:0">Gère circuits, pilotes et karts dans l’onglet Données.</p>
        <div class="row" style="margin-top:10px">
          <a class="btn btn--secondary btn--sm" href="#/circuits">Circuits</a>
          <a class="btn btn--secondary btn--sm" href="#/pilots">Pilotes</a>
          <a class="btn btn--secondary btn--sm" href="#/karts">Karts</a>
        </div>
      </div>
    </div>
  `;
}
