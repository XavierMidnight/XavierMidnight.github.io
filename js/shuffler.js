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

import { mixGenome, PAINT_GENES } from './style-genome.js';
import { glide, crossfadeBackdrop, smoothReflow, resetReflow } from './glide.js';

const IDLE_BEFORE_RESUME_MS = 2500;
// A full design change eases in over this long; periods shorter than it blend
// continuously instead, one segment running straight into the next.
const FULL_BLEND_MS = 1200;
// Big changes run in sequence: fade the page out, blend and swap underneath,
// then fade back in — so nothing visibly jumps.
const VEIL_IN_MS = 350;
const VEILED_BLEND_MS = 700;
const VEIL_OUT_MS = 450;
// Layout and typeface changes glide the words to their new spots over this long.
const GLIDE_MS = 900;
// Stopping mid-blend decelerates over at least this long rather than freezing.
const SETTLE_MS = 900;
// Periods at or above this make full jumps; shorter ones step proportionally
// less of the way, so fast shuffling is a drift and slow shuffling a reshuffle.
const FULL_STEP_PERIOD_MS = 6000;

const easeInOut = t => t * t * (3 - 2 * t);
const easeOut = t => 1 - (1 - t) ** 3;
const linear = t => t;
const PERIOD_KEY = 'shuffler-period-ms';
// Below ~10 swaps a second the page is a strobe rather than a design.
const MIN_PERIOD_MS = 100;

export class Shuffler {
  #history = [];
  #index = -1;
  #period;
  #elapsed = 0;
  #paused = false;
  #lastTick = 0;
  #raf = null;
  #idleTimer = null;
  #blend = null;
  // A change asked for while a glide is still moving waits for it to land.
  #queued = null;
  // The design the timer's partial steps are heading for, and how much of
  // the way there they've covered (0–1).
  #journey = null;
  // Peak fade of the last veiled change, and how far in the veil is now.
  #veil = { fade: 0, level: 0 };
  #variants;
  #onMoved;
  #els = {};

  /**
   * @param {import('./variants.js').Variants} variants  renders seeds and blends
   * @param {()=>void} onMoved   called when sections were reordered
   * @param {number} periodMs    time between automatic advances
   */
  constructor(variants, onMoved, periodMs = 12000) {
    this.#variants = variants;
    this.#onMoved = onMoved;
    let saved = null;
    try { saved = Number(localStorage.getItem(PERIOD_KEY)); } catch {}
    this.#period = saved >= MIN_PERIOD_MS ? saved : periodMs;
  }

  setPeriod(ms) {
    if (!Number.isFinite(ms)) return;
    this.#period = Math.max(MIN_PERIOD_MS, ms);
    try { localStorage.setItem(PERIOD_KEY, String(this.#period)); } catch {}
    this.#els.root?.classList.toggle('fast', this.#period < 1000);
    this.#syncSpeed();
  }

  start(firstSeed = Math.floor(Math.random() * 1e9)) {
    this.#build();
    this.#history = [firstSeed];
    this.#index = 0;
    if (this.#variants.applyAll(firstSeed)) this.#onMoved();
    this.#render();
    this.#bindActivity();
    this.#lastTick = performance.now();
    this.#raf = requestAnimationFrame(this.#tick);
  }

  stop() {
    if (this.#raf) cancelAnimationFrame(this.#raf);
    this.#raf = null;
    this.#els.root?.remove();
    this.#els.veil?.remove();
  }

  // ── navigation ────────────────────────────────────────

  /** A button press always goes all the way; only the timer takes partial steps. */
  next(amount = 1) {
    // Partial steps all head for one design until they reach it. A fresh
    // target every step averaged the page into the middle of every range —
    // muted colour, middling sizes — and faster steps averaged it harder.
    const j = this.#journey;
    if (amount < 1 && j && j.done < 1 && j.seed === this.#history[this.#index]) {
      const t = Math.min(1, amount / (1 - j.done));
      j.done = t === 1 ? 1 : j.done + amount;
      this.#toward(j.seed, t, amount);
      return;
    }
    // Stepping forward from mid-history replays what was already seen, so the
    // bar's "next" preview is truthful rather than a fresh roll each time.
    if (this.#index < this.#history.length - 1) {
      this.#index++;
    } else {
      this.#history = this.#history.slice(0, this.#index + 1);
      this.#history.push(Math.floor(Math.random() * 1e9));
      if (this.#history.length > 40) this.#history.shift();
      this.#index = this.#history.length - 1;
    }
    const seed = this.#history[this.#index];
    this.#journey = amount < 1 ? { seed, done: amount } : null;
    this.#toward(seed, amount);
  }

  prev() {
    if (this.#index <= 0) return;
    this.#index--;
    this.#toward(this.#history[this.#index], 1);
  }

  /**
   * Blend `t` of the remaining way to a seed's design. `size` is how big a
   * step this is on the journey there — the last step of a journey covers
   * all that's left, but it's still a small step and must not reshuffle.
   */
  #toward(seed, t, size = t) {
    // Starting a glide over a running one re-measures text mid-flight and
    // ghosts the ghosts; clicking through quickly lands on the design the
    // label now shows once the current one settles.
    if (this.#blend?.kind === 'glide') {
      this.#queued = { seed, t, size };
      this.#elapsed = 0;
      this.#render();
      return;
    }
    // A blend cut off before its midpoint still owes its layout swap, or the
    // page would keep the old structure under the new palette.
    this.#commit();
    const { from, to, fade, kind, redecorate, commit } = this.#variants.retarget(seed, t, size);
    const continuous = size < 1 && this.#period < FULL_BLEND_MS;
    if (kind !== 'drift') this.#veil = { fade, level: this.#veil.level };
    this.#blend = {
      from, to, commit, kind, redecorate,
      veil0: this.#veil.level,
      t0: performance.now(),
      dur: kind === 'veil' ? VEILED_BLEND_MS : kind === 'glide' ? GLIDE_MS
        : continuous ? this.#period : FULL_BLEND_MS,
      ease: continuous && kind === 'drift' ? linear : easeInOut,
    };
    this.#elapsed = 0;
    this.#render();
  }

  // ── timing ────────────────────────────────────────────

  #tick = (now) => {
    const dt = now - this.#lastTick;
    this.#lastTick = now;
    if (this.#blend) this.#stepBlend(now);
    if (!this.#paused && !document.hidden) {
      this.#elapsed += dt;
      if (this.#elapsed >= this.#period) this.next(Math.min(1, this.#period / FULL_STEP_PERIOD_MS));
      else this.#setProgress(this.#elapsed / this.#period);
    }
    this.#raf = requestAnimationFrame(this.#tick);
  };

  #stepBlend(now) {
    const b = this.#blend;
    const el = now - b.t0;
    if (b.kind === 'glide') {
      if (b.commit) {
        // Everything that moves or reshapes text lands at once, inside the
        // glide's before/after measurement, so the glide animates it and the
        // crossfade covers the new letterforms. Blending those genes per frame
        // instead re-laid out the page every frame (~25ms) and moved text out
        // from under the glide after it had measured.
        const kept = Object.fromEntries(PAINT_GENES.map(k => [k, b.from[k]]));
        b.from = { ...b.to, ...kept };
        resetReflow();
        glide(() => {
          this.#variants.paint(b.from);
          this.#commit();
        }, { duration: b.dur, redecorate: b.redecorate });
      }
      const e = b.ease(Math.min(1, el / b.dur));
      this.#variants.paint(mixGenome(b.from, b.to, e, true));
      this.#setVeil(Math.max(b.veil0 * (1 - e), Math.sin(Math.PI * e)));
      if (e === 1) {
        this.#blend = null;
        const q = this.#queued;
        this.#queued = null;
        if (q) this.#toward(q.seed, q.t, q.size);
      }
      return;
    }
    if (b.kind !== 'veil') {
      const t = Math.min(1, el / b.dur);
      const e = b.ease(t);
      this.#variants.paint(mixGenome(b.from, b.to, e));
      smoothReflow();
      if (e >= 0.5) this.#commit();
      // A veil left up by an interrupted change lifts alongside this blend.
      this.#setVeil(b.veil0 * (1 - e));
      if (t === 1) this.#blend = null;
      return;
    }
    const inT = Math.min(1, el / VEIL_IN_MS);
    const midT = Math.min(1, Math.max(0, (el - VEIL_IN_MS) / b.dur));
    const outT = Math.min(1, Math.max(0, (el - VEIL_IN_MS - b.dur) / VEIL_OUT_MS));
    if (inT < 1) {
      this.#setVeil(b.veil0 + (1 - b.veil0) * easeInOut(inT));
      return;
    }
    if (b.commit && b.redecorate) crossfadeBackdrop(() => this.#commit(), b.dur);
    else this.#commit();
    this.#variants.paint(mixGenome(b.from, b.to, easeInOut(midT)));
    smoothReflow();
    this.#setVeil(1 - easeInOut(outT));
    if (outT === 1) this.#blend = null;
  }

  #commit() {
    const b = this.#blend;
    if (!b?.commit) return;
    const commit = b.commit;
    b.commit = null;
    if (commit()) this.#onMoved();
  }

  /** Wash the page toward its own background. */
  #setVeil(level) {
    this.#veil.level = level;
    const veil = this.#els.veil;
    if (!veil) return;
    veil.style.background = `color-mix(in srgb, var(--bg) ${Math.round(this.#veil.fade * level * 100)}%, transparent)`;
    veil.hidden = level < 0.01;
  }

  /**
   * Coast to a stop: finish the blend in flight from wherever it is now,
   * decelerating, instead of freezing on a half-mixed frame.
   */
  #settle() {
    const b = this.#blend;
    // Veils and glides are already short eased moves; cutting one short would
    // leave the page hazed or strand a click queued behind the glide.
    if (!b || b.kind !== 'drift') return;
    const now = performance.now();
    const remaining = Math.max(0, b.dur - (now - b.t0));
    this.#blend = {
      from: this.#variants.genome,
      to: b.to,
      commit: b.commit,
      kind: 'drift',
      veil0: this.#veil.level,
      t0: now,
      dur: Math.max(SETTLE_MS, remaining * 2),
      ease: easeOut,
    };
  }

  #resume() {
    clearTimeout(this.#idleTimer);
    this.#paused = false;
    this.#els.root?.classList.remove('paused');
  }

  #pause(e) {
    // Tuning the speed is how you watch the speed — it must not freeze it.
    if (e?.target?.closest?.('.shuffler-speed')) return;
    if (!this.#paused) this.#settle();
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
      window.addEventListener(ev, (e) => this.#pause(e), { passive: true });
    }
    // A cursor resting on the page is not activity — listening to pointermove
    // directly meant a stationary mouse re-armed the pause forever and the
    // timer never resumed. Only real movement counts.
    let lastX = null, lastY = null;
    window.addEventListener('pointermove', (e) => {
      if (lastX !== null && Math.hypot(e.clientX - lastX, e.clientY - lastY) < 4) return;
      lastX = e.clientX; lastY = e.clientY;
      this.#pause(e);
    }, { passive: true });
    this.#els.root?.addEventListener('pointerenter', () => this.#pause());
  }

  // ── UI ────────────────────────────────────────────────

  #build() {
    const root = document.createElement('div');
    root.className = 'shuffler';
    root.innerHTML = `
      <div class="shuffler-controls">
        <button class="shuffler-btn" data-shuffle="prev" title="Previous design" aria-label="Previous design">‹</button>
        <span class="shuffler-swatch" data-shuffle-prev aria-hidden="true"></span>
        <span class="shuffler-label">this page designs itself</span>
        <span class="shuffler-seed" title="Seed for this design"></span>
        <span class="shuffler-swatch" data-shuffle-next aria-hidden="true"></span>
        <button class="shuffler-btn" data-shuffle="next" title="Next design" aria-label="Next design">›</button>
        <label class="shuffler-speed" title="Seconds between designs">
          <input type="range" min="0" max="10" step="0.1" aria-label="Seconds between designs">
          <input type="number" min="0.1" step="0.1" aria-label="Seconds between designs">s
        </label>
        <div class="shuffler-bar"><span class="shuffler-fill"></span></div>
      </div>`;
    document.body.appendChild(root);
    // One overlay under the pill fades everything beneath it, canvas and
    // decor included, without touching each section's own opacity.
    const veil = document.createElement('div');
    veil.className = 'shuffler-veil';
    veil.hidden = true;
    document.body.appendChild(veil);

    this.#els = {
      root,
      fill: root.querySelector('.shuffler-fill'),
      seed: root.querySelector('.shuffler-seed'),
      prevSwatch: root.querySelector('[data-shuffle-prev]'),
      nextSwatch: root.querySelector('[data-shuffle-next]'),
      prevBtn: root.querySelector('[data-shuffle="prev"]'),
      veil,
      range: root.querySelector('.shuffler-speed [type=range]'),
      secs: root.querySelector('.shuffler-speed [type=number]'),
    };

    const onSpeed = (e) => {
      const s = parseFloat(e.target.value);
      if (!Number.isFinite(s)) return;
      this.setPeriod(s * 1000);
      this.#resume();
    };
    this.#els.range.addEventListener('input', onSpeed);
    this.#els.secs.addEventListener('change', onSpeed);
    root.classList.toggle('fast', this.#period < 1000);
    this.#syncSpeed();

    root.addEventListener('click', (e) => {
      const act = e.target.closest('[data-shuffle]')?.dataset.shuffle;
      if (act === 'next') this.next();
      if (act === 'prev') this.prev();
    });
  }

  #syncSpeed() {
    const secs = +(this.#period / 1000).toFixed(2);
    if (this.#els.range) this.#els.range.value = Math.min(10, secs);
    if (this.#els.secs && document.activeElement !== this.#els.secs) this.#els.secs.value = secs;
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
