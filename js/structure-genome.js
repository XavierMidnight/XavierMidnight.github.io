/**
 * Structural variation: section order and per-section arrangement.
 *
 * Arrangements are CSS classes on the section element rather than alternate
 * markup, so the renderers keep emitting the same DOM. That matters because
 * edit mode binds to [data-path] inside those templates — rewriting the markup
 * per variant would mean re-deriving those bindings for every arrangement.
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

export const HERO_ARRANGEMENTS = ['left', 'centered', 'split', 'minimal'];
export const ABOUT_ARRANGEMENTS = ['two-col', 'stacked', 'skills-first', 'wide-bio'];
export const CONTACT_ARRANGEMENTS = ['centered', 'left', 'banner'];

// hero stays first: it carries the name, and a page that opens on a stats row
// reads as broken rather than as a variation.
const MOVABLE = ['about', 'contact'];

export function randomStructure(seed = Math.floor(Math.random() * 1e9)) {
  const r = rng(seed);
  const pick = arr => arr[Math.floor(r() * arr.length)];
  const order = [...MOVABLE];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return {
    seed,
    order: ['hero', ...order],
    hero: pick(HERO_ARRANGEMENTS),
    about: pick(ABOUT_ARRANGEMENTS),
    contact: pick(CONTACT_ARRANGEMENTS),
    navPosition: pick(['top', 'top', 'hidden']),
    heroShapes: r() > 0.25,
  };
}

/**
 * Apply a structure to the live DOM. Reorders the section shells and tags each
 * with its arrangement class; CSS in main.css does the rest.
 */
export function applyStructure(s) {
  if (!s) return;
  const body = document.body;

  for (const [id, arrangement] of [['hero', s.hero], ['about', s.about], ['contact', s.contact]]) {
    const el = document.getElementById(id);
    if (!el) continue;
    el.className = el.className.replace(/\barr-\S+/g, '').trim();
    el.classList.add(`arr-${arrangement}`);
  }

  // Reordering moves the shells themselves, so it survives a re-render: the
  // renderers write innerHTML into whatever position the shell now occupies.
  const footer = document.getElementById('footer');
  let reordered = false;
  const before = [...body.children].map(e => e.id).join(',');
  for (const id of s.order) {
    const el = document.getElementById(id);
    if (el) body.insertBefore(el, footer);
  }
  reordered = [...body.children].map(e => e.id).join(',') !== before;

  body.classList.toggle('nav-hidden', s.navPosition === 'hidden');
  body.classList.toggle('no-hero-shapes', !s.heroShapes);

  return reordered;
}
