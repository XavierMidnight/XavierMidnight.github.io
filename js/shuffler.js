/**
 * Auto-advancing design shuffler with a progress bar and prev/next previews.
 *
 * The generative layers only ran when someone typed ?style=random, which no
 * visitor ever will. This surfaces them: the page cycles designs on its own,
 * and the bar shows when the next one lands.
 *
 * Advancing under someone who is reading is hostile — type and layout shifting
 * mid-sentence loses their place — so the timer only runs while the page is
 * idle, and any interaction pauses it.
 */

const IDLE_BEFORE_RESUME_MS = 2500;

export class Shuffler {
  #history = [];
  #index = -1;
  #period;
  #elapsed = 0;
  #paused = false;
  #lastTick = 0;
  #raf = null;
  #idleTimer = null;
  #apply;
  #els = {};

  /**
   * @param {(seed:number)=>void} apply  renders a seed
   * @param {number} periodMs            time between automatic advances
   */
  constructor(apply, periodMs = 12000) {
    this.#apply = apply;
    this.#period = periodMs;
  }

  start(firstSeed = Math.floor(Math.random() * 1e9)) {
    this.#build();
    this.#go(firstSeed);
    this.#bindActivity();
    this.#lastTick = performance.now();
    this.#raf = requestAnimationFrame(this.#tick);
  }

  stop() {
    if (this.#raf) cancelAnimationFrame(this.#raf);
    this.#raf = null;
    this.#els.root?.remove();
  }

  // ── navigation ────────────────────────────────────────

  next() {
    // Stepping forward from mid-history replays what was already seen, so the
    // bar's "next" preview is truthful rather than a fresh roll each time.
    if (this.#index < this.#history.length - 1) {
      this.#index++;
      this.#apply(this.#history[this.#index]);
    } else {
      this.#go(Math.floor(Math.random() * 1e9));
    }
    this.#elapsed = 0;
    this.#render();
  }

  prev() {
    if (this.#index <= 0) return;
    this.#index--;
    this.#apply(this.#history[this.#index]);
    this.#elapsed = 0;
    this.#render();
  }

  #go(seed) {
    this.#history = this.#history.slice(0, this.#index + 1);
    this.#history.push(seed);
    if (this.#history.length > 40) this.#history.shift();
    this.#index = this.#history.length - 1;
    this.#apply(seed);
    this.#render();
  }

  // ── timing ────────────────────────────────────────────

  #tick = (now) => {
    const dt = now - this.#lastTick;
    this.#lastTick = now;
    if (!this.#paused && !document.hidden) {
      this.#elapsed += dt;
      if (this.#elapsed >= this.#period) this.next();
      else this.#setProgress(this.#elapsed / this.#period);
    }
    this.#raf = requestAnimationFrame(this.#tick);
  };

  #pause() {
    this.#paused = true;
    this.#els.root?.classList.add('paused');
    clearTimeout(this.#idleTimer);
    this.#idleTimer = setTimeout(() => {
      this.#paused = false;
      this.#els.root?.classList.remove('paused');
    }, IDLE_BEFORE_RESUME_MS);
  }

  #bindActivity() {
    // Reading counts as activity. Anything that suggests attention on the page
    // holds the current design in place.
    for (const ev of ['scroll', 'pointerdown', 'keydown', 'wheel', 'touchstart']) {
      window.addEventListener(ev, () => this.#pause(), { passive: true });
    }
    // A cursor resting on the page is not activity — listening to pointermove
    // directly meant a stationary mouse re-armed the pause forever and the
    // timer never resumed. Only real movement counts.
    let lastX = null, lastY = null;
    window.addEventListener('pointermove', (e) => {
      if (lastX !== null && Math.hypot(e.clientX - lastX, e.clientY - lastY) < 4) return;
      lastX = e.clientX; lastY = e.clientY;
      this.#pause();
    }, { passive: true });
    this.#els.root?.addEventListener('pointerenter', () => this.#pause());
  }

  // ── UI ────────────────────────────────────────────────

  #build() {
    const root = document.createElement('div');
    root.className = 'shuffler';
    root.innerHTML = `
      <div class="shuffler-bar"><span class="shuffler-fill"></span></div>
      <div class="shuffler-controls">
        <button class="shuffler-btn" data-shuffle="prev" title="Previous design" aria-label="Previous design">‹</button>
        <span class="shuffler-swatch" data-shuffle-prev aria-hidden="true"></span>
        <span class="shuffler-label">this page designs itself</span>
        <span class="shuffler-seed" title="Seed for this design"></span>
        <span class="shuffler-swatch" data-shuffle-next aria-hidden="true"></span>
        <button class="shuffler-btn" data-shuffle="next" title="Next design" aria-label="Next design">›</button>
      </div>`;
    document.body.appendChild(root);

    this.#els = {
      root,
      fill: root.querySelector('.shuffler-fill'),
      seed: root.querySelector('.shuffler-seed'),
      prevSwatch: root.querySelector('[data-shuffle-prev]'),
      nextSwatch: root.querySelector('[data-shuffle-next]'),
      prevBtn: root.querySelector('[data-shuffle="prev"]'),
    };

    root.addEventListener('click', (e) => {
      const act = e.target.closest('[data-shuffle]')?.dataset.shuffle;
      if (act === 'next') this.next();
      if (act === 'prev') this.prev();
    });
  }

  #setProgress(f) {
    if (this.#els.fill) this.#els.fill.style.transform = `scaleX(${Math.min(1, f)})`;
  }

  #render() {
    this.#setProgress(0);
    const seed = this.#history[this.#index];
    if (this.#els.seed) this.#els.seed.textContent = `#${seed}`;
    if (this.#els.prevBtn) this.#els.prevBtn.disabled = this.#index <= 0;
    // A live miniature of the page would cost a second render; a palette
    // swatch conveys the same "different from this one" at thumbnail size.
    this.#swatch(this.#els.prevSwatch, this.#history[this.#index - 1]);
    this.#swatch(this.#els.nextSwatch, this.#history[this.#index + 1]);
  }

  #swatch(el, seed) {
    if (!el) return;
    if (seed == null) { el.style.visibility = 'hidden'; return; }
    el.style.visibility = 'visible';
    el.style.background = swatchFor(seed);
  }
}

/** Palette preview for a seed, matching style-genome's derivation. */
export function swatchFor(seed) {
  let a = seed >>> 0;
  const r = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const hue = r() * 360;
  const offset = [180, 150, 210, 30, 330, 120][Math.floor(r() * 6)];
  const sat = 20 + r() * 65;
  const light = 30 + r() * 62;
  const dark = light < 50;
  const bg = dark ? Math.max(6, light * 0.28) : Math.min(98, light);
  const primary = dark ? 58 : 38;
  return `linear-gradient(135deg, hsl(${hue} ${sat * 0.12}% ${bg}%) 0 50%, hsl(${hue} ${sat}% ${primary}%) 50% 75%, hsl(${(hue + offset) % 360} ${sat}% 56%) 75% 100%)`;
}
