/** Format milliseconds to m:ss.mmm */
export function formatLapTime(ms) {
  if (ms == null || Number.isNaN(ms) || ms < 0) return '—';
  const total = Math.floor(ms);
  const minutes = Math.floor(total / 60000);
  const seconds = Math.floor((total % 60000) / 1000);
  const millis = total % 1000;
  return `${minutes}:${String(seconds).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
}

/**
 * Parse lap time string:
 * - "1:12.345"
 * - "72.345"
 * - "72345" (raw ms if integer-looking >= 1000 and no colon/dot?)
 * Prefer explicit formats.
 */
export function parseLapTime(input) {
  if (input == null) return null;
  const raw = String(input).trim().replace(',', '.');
  if (!raw) return null;

  const colon = raw.match(/^(\d+):(\d{1,2})(?:\.(\d{1,3}))?$/);
  if (colon) {
    const min = Number(colon[1]);
    const sec = Number(colon[2]);
    let msPart = colon[3] || '0';
    msPart = msPart.padEnd(3, '0').slice(0, 3);
    if (sec >= 60) return null;
    return min * 60000 + sec * 1000 + Number(msPart);
  }

  const decimal = raw.match(/^(\d+)(?:\.(\d{1,3}))?$/);
  if (decimal) {
    const sec = Number(decimal[1]);
    let msPart = decimal[2] || '0';
    msPart = msPart.padEnd(3, '0').slice(0, 3);
    return sec * 1000 + Number(msPart);
  }

  return null;
}

export function validLaps(laps) {
  return (laps || []).filter((l) => !l.invalidated && l.timeMs > 0);
}

export function bestLap(laps) {
  const list = validLaps(laps);
  if (!list.length) return null;
  return list.reduce((a, b) => (a.timeMs <= b.timeMs ? a : b));
}

export function averageLap(laps) {
  const list = validLaps(laps);
  if (!list.length) return null;
  const sum = list.reduce((acc, l) => acc + l.timeMs, 0);
  return Math.round(sum / list.length);
}

export function stdDevLap(laps) {
  const list = validLaps(laps);
  if (list.length < 2) return null;
  const avg = list.reduce((acc, l) => acc + l.timeMs, 0) / list.length;
  const variance = list.reduce((acc, l) => acc + (l.timeMs - avg) ** 2, 0) / list.length;
  return Math.round(Math.sqrt(variance));
}

export function sessionStats(laps) {
  return {
    count: validLaps(laps).length,
    bestMs: bestLap(laps)?.timeMs ?? null,
    avgMs: averageLap(laps),
    stdMs: stdDevLap(laps)
  };
}

export function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

export function formatDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function monthKey(iso) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function monthLabel(key) {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m - 1, 1);
  return d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
}
