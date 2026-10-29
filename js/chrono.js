import { formatLapTime } from './models.js';

/**
 * States: idle | running | paused
 * Start/resume does not record a lap. Split records current lap. Stop ends and may record last segment.
 */
export class Chronometer {
  constructor() {
    this.state = 'idle';
    this.startPerf = 0;
    this.elapsedBefore = 0;
    this.lapStartPerf = 0;
    this.lapElapsedBefore = 0;
    this.raf = null;
    this.onTick = null;
    this.wakeLock = null;
  }

  get running() {
    return this.state === 'running';
  }

  get paused() {
    return this.state === 'paused';
  }

  getElapsed() {
    if (this.state === 'running') {
      return this.elapsedBefore + (performance.now() - this.startPerf);
    }
    return this.elapsedBefore;
  }

  getLapElapsed() {
    if (this.state === 'running') {
      return this.lapElapsedBefore + (performance.now() - this.lapStartPerf);
    }
    return this.lapElapsedBefore;
  }

  /** Start from idle, or resume from paused. */
  start() {
    if (this.state === 'running') return;

    if (this.state === 'idle') {
      this.elapsedBefore = 0;
      this.lapElapsedBefore = 0;
    }

    const now = performance.now();
    this.startPerf = now;
    this.lapStartPerf = now;
    this.state = 'running';
    this._loop();
    this._requestWakeLock();
    this._emit();
  }

  pause() {
    if (this.state !== 'running') return;
    const now = performance.now();
    this.elapsedBefore += now - this.startPerf;
    this.lapElapsedBefore += now - this.lapStartPerf;
    this.state = 'paused';
    this._cancelLoop();
    this._releaseWakeLock();
    this._emit();
  }

  /** Toggle: start/resume when not running, pause when running. */
  togglePause() {
    if (this.state === 'running') this.pause();
    else this.start();
  }

  /** Record current lap time (ms) and start next lap. Returns timeMs or null. */
  split() {
    if (this.state !== 'running') return null;
    const now = performance.now();
    const timeMs = Math.round(this.lapElapsedBefore + (now - this.lapStartPerf));
    this.lapElapsedBefore = 0;
    this.lapStartPerf = now;
    this._emit();
    return timeMs;
  }

  /** Stop session. Returns last lap segment ms if meaningful, else null. Resets to idle after. */
  stop() {
    if (this.state === 'idle') return null;

    let lastLap = null;
    if (this.state === 'running') {
      const now = performance.now();
      lastLap = Math.round(this.lapElapsedBefore + (now - this.lapStartPerf));
      this.elapsedBefore += now - this.startPerf;
    } else if (this.state === 'paused') {
      lastLap = Math.round(this.lapElapsedBefore);
    }

    this.state = 'idle';
    this.elapsedBefore = 0;
    this.lapElapsedBefore = 0;
    this.startPerf = 0;
    this.lapStartPerf = 0;
    this._cancelLoop();
    this._releaseWakeLock();
    this._emit();
    return lastLap > 0 ? lastLap : null;
  }

  reset() {
    this.state = 'idle';
    this.elapsedBefore = 0;
    this.lapElapsedBefore = 0;
    this.startPerf = 0;
    this.lapStartPerf = 0;
    this._cancelLoop();
    this._releaseWakeLock();
    this._emit();
  }

  _emit() {
    if (!this.onTick) return;
    this.onTick({
      totalMs: this.getElapsed(),
      lapMs: this.getLapElapsed(),
      running: this.state === 'running',
      paused: this.state === 'paused',
      state: this.state
    });
  }

  _loop() {
    const tick = () => {
      if (this.state !== 'running') return;
      this._emit();
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  _cancelLoop() {
    if (this.raf) {
      cancelAnimationFrame(this.raf);
      this.raf = null;
    }
  }

  async _requestWakeLock() {
    try {
      if ('wakeLock' in navigator) {
        this.wakeLock = await navigator.wakeLock.request('screen');
        this.wakeLock.addEventListener('release', () => {
          this.wakeLock = null;
        });
      }
    } catch {
      // ignore
    }
  }

  async _releaseWakeLock() {
    try {
      await this.wakeLock?.release();
    } catch {
      // ignore
    }
    this.wakeLock = null;
  }
}

export { formatLapTime };
