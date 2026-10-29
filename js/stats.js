import {
  bestLap,
  averageLap,
  validLaps,
  monthKey,
  monthLabel,
  sessionStats,
  formatLapTime
} from './models.js';

export function computeSessionView(session, laps) {
  return {
    session,
    laps: [...laps].sort((a, b) => a.lapNumber - b.lapNumber),
    stats: sessionStats(laps)
  };
}

/** Line chart of lap times for one session (Chart.js). Returns Chart instance or null. */
export function createSessionLapChart(canvas, laps) {
  if (!canvas || typeof Chart === 'undefined') return null;

  const ordered = [...laps].sort((a, b) => a.lapNumber - b.lapNumber);
  const plottable = ordered.filter((l) => !l.invalidated && l.timeMs > 0);
  if (!plottable.length) return null;

  const stats = sessionStats(plottable);
  const labels = plottable.map((l) => `#${l.lapNumber}`);
  const dataSec = plottable.map((l) => l.timeMs / 1000);
  const bestSec = stats.bestMs != null ? stats.bestMs / 1000 : null;
  const avgSec = stats.avgMs != null ? stats.avgMs / 1000 : null;

  const pointColors = plottable.map((l) =>
    stats.bestMs != null && l.timeMs === stats.bestMs ? '#c4f542' : '#8b97a8'
  );

  return new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Temps au tour',
          data: dataSec,
          borderColor: '#c4f542',
          backgroundColor: 'rgba(196, 245, 66, 0.12)',
          tension: 0.25,
          fill: true,
          pointRadius: 5,
          pointBackgroundColor: pointColors,
          pointBorderColor: pointColors,
          borderWidth: 2
        },
        ...(avgSec != null
          ? [
              {
                label: 'Moyenne',
                data: labels.map(() => avgSec),
                borderColor: '#3dd68c',
                borderDash: [6, 4],
                borderWidth: 1.5,
                pointRadius: 0,
                fill: false
              }
            ]
          : []),
        ...(bestSec != null
          ? [
              {
                label: 'Best',
                data: labels.map(() => bestSec),
                borderColor: '#ffb020',
                borderDash: [2, 4],
                borderWidth: 1.5,
                pointRadius: 0,
                fill: false
              }
            ]
          : [])
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          labels: { color: '#8b97a8', boxWidth: 12, font: { size: 11 } }
        },
        tooltip: {
          callbacks: {
            label: (ctx) =>
              `${ctx.dataset.label}: ${formatLapTime(Math.round(ctx.parsed.y * 1000))}`
          }
        }
      },
      scales: {
        y: {
          title: { display: true, text: 'Secondes', color: '#8b97a8' },
          ticks: { color: '#8b97a8' },
          grid: { color: '#2a3340' },
          reverse: false
        },
        x: {
          ticks: { color: '#8b97a8' },
          grid: { display: false }
        }
      }
    }
  });
}

/** Best lap per session over time for a circuit */
export function bestLapBySessionOverTime(sessions, lapsBySessionId) {
  const rows = sessions
    .map((s) => {
      const laps = lapsBySessionId.get(s.id) || [];
      const best = bestLap(laps);
      return best
        ? { sessionId: s.id, date: s.date, pilotId: s.pilotId, bestMs: best.timeMs }
        : null;
    })
    .filter(Boolean)
    .sort((a, b) => new Date(a.date) - new Date(b.date));
  return rows;
}

/** Aggregate by calendar month */
export function byMonth(sessions, lapsBySessionId) {
  const map = new Map();

  for (const s of sessions) {
    const key = monthKey(s.date);
    if (!map.has(key)) {
      map.set(key, { key, label: monthLabel(key), lapCount: 0, bestMs: null, sessionCount: 0 });
    }
    const row = map.get(key);
    row.sessionCount += 1;
    const laps = validLaps(lapsBySessionId.get(s.id) || []);
    row.lapCount += laps.length;
    for (const l of laps) {
      if (row.bestMs == null || l.timeMs < row.bestMs) row.bestMs = l.timeMs;
    }
  }

  return [...map.values()].sort((a, b) => a.key.localeCompare(b.key));
}

/** Compare pilots on a circuit: best + avg of their valid laps */
export function comparePilots(sessions, lapsBySessionId, pilots) {
  const byPilot = new Map();

  for (const p of pilots) {
    byPilot.set(p.id, { pilotId: p.id, name: p.name, times: [] });
  }

  for (const s of sessions) {
    const bucket = byPilot.get(s.pilotId);
    if (!bucket) continue;
    const laps = validLaps(lapsBySessionId.get(s.id) || []);
    for (const l of laps) bucket.times.push(l.timeMs);
  }

  return [...byPilot.values()]
    .map((b) => {
      const fakeLaps = b.times.map((timeMs) => ({ timeMs, invalidated: false }));
      return {
        pilotId: b.pilotId,
        name: b.name,
        lapCount: b.times.length,
        bestMs: bestLap(fakeLaps)?.timeMs ?? null,
        avgMs: averageLap(fakeLaps)
      };
    })
    .filter((r) => r.lapCount > 0)
    .sort((a, b) => (a.bestMs ?? Infinity) - (b.bestMs ?? Infinity));
}

export function groupLapsBySession(allLaps) {
  const map = new Map();
  for (const lap of allLaps) {
    if (!map.has(lap.sessionId)) map.set(lap.sessionId, []);
    map.get(lap.sessionId).push(lap);
  }
  return map;
}
