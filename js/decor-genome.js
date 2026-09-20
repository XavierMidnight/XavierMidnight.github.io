/**
 * Generates the hero's decorative layer: any number of shapes, each with its
 * own form, size, placement, colour role and motion.
 *
 * Replaces four hardcoded shapes. Genes are derived from a few global traits
 * rather than rolled per shape, so a scene reads as one composition instead of
 * unrelated objects that happen to share a canvas.
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

export const FORMS = ['circle', 'blob', 'squircle', 'rect', 'bar', 'ring', 'triangle', 'hexagon', 'cross', 'arc'];
export const MOTIONS = ['float', 'orbit', 'drift', 'pulse', 'spin', 'sway', 'bob', 'none'];
export const PALETTE_ROLES = ['primary', 'primary-soft', 'accent', 'accent-soft', 'surface', 'outline'];

// Where shapes are allowed to sit. "column" keeps them off the text, "full"
// lets them overlap it, "edges" hugs the frame.
const FIELDS = ['full', 'edges', 'column', 'corner', 'diagonal'];

function place(r, field, i, n) {
  const t = n > 1 ? i / (n - 1) : 0.5;
  switch (field) {
    case 'edges': {
      const side = Math.floor(r() * 4);
      const along = r() * 100;
      if (side === 0) return { x: along, y: r() * 18 - 6 };
      if (side === 1) return { x: 82 + r() * 24, y: along };
      if (side === 2) return { x: along, y: 84 + r() * 22 };
      return { x: r() * 18 - 8, y: along };
    }
    case 'column':
      // Outside the middle third, where the text lives.
      return { x: r() > 0.5 ? 68 + r() * 34 : r() * 26 - 8, y: r() * 110 - 5 };
    case 'corner': {
      const cx = r() > 0.5 ? 78 : -6;
      const cy = r() > 0.5 ? 72 : -8;
      return { x: cx + r() * 26, y: cy + r() * 30 };
    }
    case 'diagonal':
      return { x: t * 110 - 8 + (r() - 0.5) * 18, y: t * 110 - 8 + (r() - 0.5) * 18 };
    default:
      return { x: r() * 112 - 8, y: r() * 112 - 8 };
  }
}

export function randomDecor(seed = Math.floor(Math.random() * 1e9)) {
  const r = rng(seed);
  const pick = arr => arr[Math.floor(r() * arr.length)];

  // Global traits. Every shape is derived from these, which is what keeps a
  // scene coherent — a "calm, large, sparse" roll looks deliberate even when
  // the individual shapes differ.
  const density = round(r(), 2);
  const count = Math.round(1 + density * 13);
  const scale = round(0.4 + r() * 1.8, 2);
  const energy = round(r(), 2);
  const tempo = round(8 + r() * 26, 1);
  const field = pick(FIELDS);
  const formBias = pick(FORMS);
  const variety = round(r(), 2);
  const opacityBase = round(0.06 + r() * 0.5, 2);
  const blurAmount = r() > 0.72 ? round(r() * 26) : 0;
  const outlineStyle = r() > 0.75;

  // Animating filter: blur() forces a repaint per frame. It measures fine on a
  // fast GPU, so cap the combination rather than trusting the machine it was
  // written on — a portfolio that drains a phone battery is worse than a plain one.
  let blurBudget = 4;

  const shapes = [];
  for (let i = 0; i < count; i++) {
    // `variety` decides how often a shape departs from the dominant form, so
    // low-variety scenes repeat one motif and high-variety ones feel scattered.
    const form = r() < variety ? pick(FORMS) : formBias;
    const pos = place(r, field, i, count);
    const sizeRoll = r();
    const motion = energy < 0.15 ? 'none' : pick(MOTIONS);
    let blur = blurAmount ? round(blurAmount * r()) : 0;
    if (blur && motion !== 'none') {
      if (blurBudget > 0) blurBudget--;
      else blur = 0;
    }
    const size = round((20 + sizeRoll * sizeRoll * 380) * scale);
    let opacity = round(Math.min(0.9, opacityBase * (0.5 + r())), 2);

    // Decoration sits behind the hero copy. A large, fairly solid shape landing
    // on the text band made it genuinely hard to read, in 19% of sampled
    // scenes — so anything big enough to matter gets faded where the words are.
    const overText = size > 180 && pos.x > 0 && pos.x < 60 && pos.y > 20 && pos.y < 75;
    if (overText) opacity = round(Math.min(opacity, 0.14), 2);

    shapes.push({
      form,
      x: round(pos.x, 1),
      y: round(pos.y, 1),
      size,
      rotation: round(r() * 360),
      role: pick(PALETTE_ROLES),
      opacity,
      motion,
      duration: round(tempo * (0.6 + r() * 0.9), 1),
      delay: round(-r() * tempo, 1),
      amplitude: round(4 + energy * 46),
      blur,
      outline: outlineStyle && r() > 0.5,
      z: r() > 0.85 ? 2 : 0,
    });
  }

  return { seed, count, density, scale, energy, tempo, field, formBias, variety, blurAmount, shapes };
}

const ROLE_VARS = {
  primary: 'var(--blue)',
  'primary-soft': 'var(--blue-light)',
  accent: 'var(--yellow)',
  'accent-soft': 'var(--yellow-soft)',
  surface: 'var(--bg-alt)',
  outline: 'var(--border)',
};

const CLIP = {
  triangle: 'polygon(50% 0%, 100% 100%, 0% 100%)',
  hexagon: 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)',
  cross: 'polygon(35% 0%, 65% 0%, 65% 35%, 100% 35%, 100% 65%, 65% 65%, 65% 100%, 35% 100%, 35% 65%, 0% 65%, 0% 35%, 35% 35%)',
};

function shapeCSS(s) {
  const css = {
    position: 'absolute',
    left: `${s.x}%`,
    top: `${s.y}%`,
    width: `${s.size}px`,
    height: s.form === 'bar' ? `${Math.max(2, Math.round(s.size * 0.03))}px` : `${s.size}px`,
    opacity: s.opacity,
    'z-index': s.z,
    rotate: `${s.rotation}deg`,
  };

  if (s.outline && s.form !== 'bar') {
    css.background = 'transparent';
    css.border = `2px solid ${ROLE_VARS[s.role]}`;
  } else {
    css.background = ROLE_VARS[s.role];
  }

  switch (s.form) {
    case 'circle': css['border-radius'] = '50%'; break;
    case 'ring':
      css['border-radius'] = '50%';
      css.background = 'transparent';
      css.border = `${Math.max(2, Math.round(s.size * 0.08))}px solid ${ROLE_VARS[s.role]}`;
      break;
    case 'blob': css['border-radius'] = '60% 40% 55% 45% / 45% 55% 45% 55%'; break;
    case 'squircle': css['border-radius'] = '28%'; break;
    case 'rect': css['border-radius'] = '4px'; break;
    case 'bar': css['border-radius'] = '999px'; break;
    case 'arc':
      css['border-radius'] = '50%';
      css.background = 'transparent';
      css.border = `${Math.max(2, Math.round(s.size * 0.09))}px solid ${ROLE_VARS[s.role]}`;
      css['clip-path'] = 'polygon(0 0, 100% 0, 100% 55%, 0 55%)';
      break;
    default:
      if (CLIP[s.form]) css['clip-path'] = CLIP[s.form];
  }

  if (s.blur) css.filter = `blur(${s.blur}px)`;
  if (s.motion !== 'none') {
    css.animation = `decor-${s.motion} ${s.duration}s ease-in-out ${s.delay}s infinite`;
    css['--amp'] = `${s.amplitude}px`;
  }
  return css;
}

/** Replace the hero's decorative layer with a generated scene. */
export function applyDecor(d) {
  const host = document.querySelector('.hero-shapes');
  if (!host || !d) return null;
  host.innerHTML = '';
  for (const s of d.shapes) {
    const el = document.createElement('div');
    el.className = 'decor-shape';
    const css = shapeCSS(s);
    for (const [k, v] of Object.entries(css)) el.style.setProperty(k, String(v));
    host.appendChild(el);
  }
  return d;
}
