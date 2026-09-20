/**
 * Generative canvas behind the hero.
 *
 * The original particle system was one behaviour — drifting dots joined by
 * proximity lines. This picks a behaviour from a genome, so the background can
 * be a flow field, an orbital system, rain, a lattice or nothing at all.
 */

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const round = (n, p = 0) => Number(n.toFixed(p));

export const BEHAVIOURS = ['constellation', 'flow', 'orbit', 'rain', 'lattice', 'drift', 'none'];

export function randomCanvas(seed = Math.floor(Math.random() * 1e9)) {
  const r = rng(seed);
  const pick = arr => arr[Math.floor(r() * arr.length)];
  const behaviour = pick(BEHAVIOURS);
  return {
    seed,
    behaviour,
    // Density is capped per behaviour below; constellation is O(n^2) in its
    // connection pass, so it cannot take the same particle count as the rest.
    density: round(0.15 + r() * 0.85, 2),
    speed: round(0.15 + r() * 1.5, 2),
    dotSize: round(0.5 + r() * 2.6, 2),
    linkDistance: round(60 + r() * 130),
    trail: r() > 0.6 ? round(0.04 + r() * 0.16, 3) : 0,
    useAccent: r() > 0.5,
    alpha: round(0.06 + r() * 0.26, 3),
  };
}

function cssColor(varName, fallback) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  return v || fallback;
}

export class GenerativeCanvas {
  #canvas = null;
  #ctx = null;
  #items = [];
  #animId = null;
  #g = null;
  #t = 0;
  #onResize = null;

  start(genome) {
    this.stop();
    this.#g = genome;
    if (!genome || genome.behaviour === 'none') return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

    this.#canvas = document.getElementById('hero-particles');
    if (!this.#canvas) return;
    this.#ctx = this.#canvas.getContext('2d');
    this.#resize();
    this.#seedItems();
    this.#onResize = () => { this.#resize(); this.#seedItems(); };
    window.addEventListener('resize', this.#onResize);
    this.#loop();
  }

  stop() {
    if (this.#animId) cancelAnimationFrame(this.#animId);
    this.#animId = null;
    if (this.#onResize) window.removeEventListener('resize', this.#onResize);
    this.#onResize = null;
    if (this.#ctx && this.#canvas) this.#ctx.clearRect(0, 0, this.#canvas.width, this.#canvas.height);
  }

  #resize() {
    const hero = document.getElementById('hero');
    if (!hero || !this.#canvas) return;
    this.#canvas.width = hero.offsetWidth;
    this.#canvas.height = hero.offsetHeight;
  }

  #count() {
    const area = this.#canvas.width * this.#canvas.height;
    const base = Math.floor((area / 16000) * this.#g.density);
    // constellation draws every pair, so its cost grows with the square.
    const cap = this.#g.behaviour === 'constellation' ? 55 : 220;
    return Math.max(6, Math.min(base, cap));
  }

  #seedItems() {
    const w = this.#canvas.width, h = this.#canvas.height;
    const n = this.#count();
    const r = rng(this.#g.seed ^ 0x9e37);
    this.#items = [];
    for (let i = 0; i < n; i++) {
      this.#items.push({
        x: r() * w,
        y: r() * h,
        vx: (r() - 0.5) * this.#g.speed,
        vy: (r() - 0.5) * this.#g.speed,
        r: r() * this.#g.dotSize + 0.4,
        a: r() * Math.PI * 2,
        orbit: 30 + r() * Math.min(w, h) * 0.4,
        phase: r() * Math.PI * 2,
      });
    }
  }

  #loop = () => {
    const c = this.#ctx, w = this.#canvas.width, h = this.#canvas.height, g = this.#g;
    this.#t += 0.006 * g.speed;

    // A trail gene fades the previous frame instead of clearing it, which turns
    // any behaviour into streaks without tracking history per particle.
    if (g.trail) {
      c.globalCompositeOperation = 'destination-out';
      c.fillStyle = `rgba(0,0,0,${g.trail})`;
      c.fillRect(0, 0, w, h);
      c.globalCompositeOperation = 'source-over';
    } else {
      c.clearRect(0, 0, w, h);
    }

    const col = cssColor(g.useAccent ? '--yellow' : '--blue', '#0058a3');
    c.fillStyle = col;
    c.strokeStyle = col;

    for (const p of this.#items) {
      switch (g.behaviour) {
        case 'flow': {
          // Cheap curl-ish field: sin/cos of position gives smooth swirls.
          const ang = Math.sin(p.x * 0.004 + this.#t) * Math.cos(p.y * 0.004 - this.#t) * Math.PI * 2;
          p.x += Math.cos(ang) * g.speed;
          p.y += Math.sin(ang) * g.speed;
          break;
        }
        case 'orbit': {
          p.a += 0.004 * g.speed;
          p.x = w / 2 + Math.cos(p.a + p.phase) * p.orbit;
          p.y = h / 2 + Math.sin(p.a + p.phase) * p.orbit * 0.6;
          break;
        }
        case 'rain':
          p.y += g.speed * 2.2;
          if (p.y > h) { p.y = -10; p.x = Math.random() * w; }
          break;
        case 'lattice':
          p.x += Math.sin(this.#t + p.phase) * g.speed * 0.6;
          p.y += Math.cos(this.#t * 0.8 + p.phase) * g.speed * 0.6;
          break;
        default:
          p.x += p.vx;
          p.y += p.vy;
      }
      if (g.behaviour !== 'rain' && g.behaviour !== 'orbit') {
        if (p.x < 0) p.x += w; else if (p.x > w) p.x -= w;
        if (p.y < 0) p.y += h; else if (p.y > h) p.y -= h;
      }

      c.globalAlpha = g.alpha;
      if (g.behaviour === 'rain') {
        c.lineWidth = p.r * 0.8;
        c.beginPath();
        c.moveTo(p.x, p.y);
        c.lineTo(p.x, p.y + 6 + p.r * 4);
        c.stroke();
      } else {
        c.beginPath();
        c.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        c.fill();
      }
    }

    if (g.behaviour === 'constellation' || g.behaviour === 'lattice') {
      const max = g.linkDistance;
      c.lineWidth = 0.5;
      for (let i = 0; i < this.#items.length; i++) {
        for (let j = i + 1; j < this.#items.length; j++) {
          const a = this.#items[i], b = this.#items[j];
          const dx = a.x - b.x, dy = a.y - b.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < max * max) {
            c.globalAlpha = (1 - Math.sqrt(d2) / max) * g.alpha * 0.6;
            c.beginPath();
            c.moveTo(a.x, a.y);
            c.lineTo(b.x, b.y);
            c.stroke();
          }
        }
      }
    }

    c.globalAlpha = 1;
    this.#animId = requestAnimationFrame(this.#loop);
  };
}
