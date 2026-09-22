/**
 * FLIP glide: run a DOM change, then animate each text unit from where it was
 * to where it landed, so a layout or type change reads as words moving rather
 * than as a cut.
 *
 * Positions are measured from the text itself (a Range over the contents), not
 * the element box — an arrangement that only changes text-align leaves the box
 * where it was while the words move across it.
 *
 * Layers on top of the block glide:
 *  - the name is split into letters for the move, each trailing the last, so
 *    the headline ripples into place instead of sliding as one slab
 *  - short prose that rewraps is split into words, so words cross to their
 *    new lines rather than the paragraph sliding with its breaks already jumped
 *  - a frozen copy of each unit in the old type fades out while travelling to
 *    the new spot as the new type fades in, so a change of face, size or
 *    weight dissolves in motion instead of popping
 */

const UNITS = [
  '.hero-tag', '.hero-name', '.hero-subtitle', '.hero-ctas > *',
  '.section-label', 'section h2', '.about-bio .paragraph-wrap',
  '.skills-wrap h3', '.skills-grid > *', '.stat-card',
  '.contact-desc', '.contact-links > *',
].join(', ');
const WAVE_LINES = '.hero-name [data-path]';
const PROSE = '.hero-subtitle, .about-bio p, .contact-desc';
// Words moving at once. A long bio paragraph's ~180 made frames of 30–100ms
// even on a desktop GPU; past this, prose slides as a block.
const WORD_BUDGET = 60;
const STAGGER_MS = 28;

const EASING = 'cubic-bezier(0.65, 0, 0.35, 1)';
// The old copy clears out early and the new type arrives a beat later, so
// they hand off mid-move. Overlapping them for the whole glide reads as two
// copies of the page rather than one dissolving into the other; the overlap
// is kept to the tail of the ghost's ease-in, when it's nearly gone.
const GHOST_SPAN = 0.35;
const ARRIVE_DELAY = 0.25;
const ARRIVE_SPAN = 0.55;

// Everything that makes the old copy look like the old design. Its CSS
// variables are the live ones, so without freezing these the ghost would
// morph along with the page and the crossfade would be between two copies of
// the new design.
const FROZEN = [
  'font-family', 'font-size', 'font-weight', 'font-stretch', 'font-style',
  'font-variation-settings', 'letter-spacing', 'line-height', 'text-transform',
  'text-align', 'color', 'background-color', 'border-color', 'border-radius',
];

function textBox(el) {
  const range = document.createRange();
  range.selectNodeContents(el);
  const r = range.getBoundingClientRect();
  return r.width || r.height ? r : null;
}

const center = r => [r.left + r.width / 2, r.top + r.height / 2];

// Left edge and vertical middle: a Range's box is the glyphs' content area,
// an inline-block's is the line box, and half-leading centres one in the other.
const anchor = r => [r.left, r.top + r.height / 2];

/** Boxes of the words (or letters) of el's text, kerned as currently laid out. */
function pieceBoxes(el, letters) {
  const node = el.firstChild;
  const range = document.createRange();
  const boxes = [];
  for (const m of el.textContent.matchAll(letters ? /\S/gu : /\S+/g)) {
    range.setStart(node, m.index);
    range.setEnd(node, m.index + m[0].length);
    boxes.push(range.getBoundingClientRect());
  }
  return boxes;
}

/**
 * Wrap each word in an inline-block so it can move on its own, and for
 * letters each character too. Words stay no-wrap: inline-block letters
 * alone would let the line break mid-word.
 */
function split(el, letters) {
  const text = el.textContent;
  el.textContent = '';
  const spans = [];
  text.split(/(\s+)/).forEach(part => {
    if (!part) return;
    if (/^\s+$/.test(part)) { el.append(part); return; }
    const word = document.createElement('span');
    word.className = 'glide-word';
    if (letters) {
      for (const ch of part) {
        const s = document.createElement('span');
        s.className = 'glide-ch';
        s.textContent = ch;
        word.append(s);
        spans.push(s);
      }
    } else {
      word.textContent = part;
      spans.push(word);
    }
    el.append(word);
  });
  return spans;
}

/**
 * Back to plain text. Split letters lose kerning, so rejoining pulls pairs
 * closer and shifts a centred line by a pixel or two; the line eases from
 * where the letters were into its kerned spot instead.
 */
function join({ el, text, spans, letters }) {
  // A later glide re-splits the same line; only the newest split restores it.
  if (!spans[0]?.isConnected) return;
  const was = letters && spans.length > 1
    ? [spans[0].getBoundingClientRect(), spans.at(-1).getBoundingClientRect()]
    : null;
  el.textContent = text;
  if (!was) return;
  const now = pieceBoxes(el, true);
  const [a0, a1] = was, b0 = now[0], b1 = now.at(-1);
  // Wrapped onto two rows before or after: no single stretch maps one to the other.
  if (Math.abs(a0.top - a1.top) > 1 || Math.abs(b0.top - b1.top) > 1) return;
  const scale = (a1.right - a0.left) / (b1.right - b0.left);
  const box = el.getBoundingClientRect();
  const cx = box.left + box.width / 2;
  const dx = a0.left - cx - scale * (b0.left - cx);
  if (Math.abs(dx) < 0.25 && Math.abs(scale - 1) < 0.001) return;
  el.animate(
    [{ transform: `translateX(${dx}px) scaleX(${scale})` }, { transform: 'none' }],
    { duration: 300, easing: 'ease-out', composite: 'add' },
  );
}

function ghost(el) {
  const r = el.getBoundingClientRect();
  const g = el.cloneNode(true);
  const src = [el, ...el.querySelectorAll('*')];
  const dst = [g, ...g.querySelectorAll('*')];
  src.forEach((s, i) => {
    const cs = getComputedStyle(s);
    for (const p of FROZEN) dst[i].style.setProperty(p, cs.getPropertyValue(p));
    // Edit mode and the reveal observer find elements by these; a ghost must
    // not be mistaken for the real thing.
    dst[i].removeAttribute('id');
    dst[i].removeAttribute('data-path');
    dst[i].classList.remove('anim');
  });
  Object.assign(g.style, {
    position: 'absolute', margin: '0', boxSizing: 'border-box',
    left: `${r.left + scrollX}px`, top: `${r.top + scrollY}px`,
    width: `${r.width}px`, height: `${r.height}px`,
    transform: 'none', opacity: '1', pointerEvents: 'none', zIndex: '900',
  });
  g.setAttribute('aria-hidden', 'true');
  return g;
}

export function glide(change, { duration = 900, redecorate = false } = {}) {
  const vh = innerHeight;
  const onscreen = r => r && r.bottom > 0 && r.top < vh;
  // Ghosts keep their classes so they look right, which means they match
  // UNITS too — and a ghost must never be measured or ghosted itself.
  const live = el => !el.closest('[aria-hidden]');
  const splittable = el => live(el) && onscreen(textBox(el))
    && el.childNodes.length === 1 && el.firstChild.nodeType === Node.TEXT_NODE
    && !el.isContentEditable && !el.classList.contains('typing');

  // Every read comes before any write — the text is measured and ghosted
  // unsplit, so both start kerned — because a read after a DOM change forces
  // a fresh layout, and this frame already lays out the whole new design.
  let budget = WORD_BUDGET;
  let pieces = [
    ...[...document.querySelectorAll(WAVE_LINES)].filter(splittable).map(el => ({ el, letters: true })),
    ...[...document.querySelectorAll(PROSE)].filter(splittable)
      .filter(el => {
        const words = el.textContent.match(/\S+/g)?.length ?? 0;
        if (words > budget) return false;
        budget -= words;
        return true;
      })
      .map(el => ({ el, letters: false })),
  ];
  for (const p of pieces) {
    p.text = p.el.textContent;
    p.first = pieceBoxes(p.el, p.letters);
    p.host = p.el.closest(UNITS);
  }
  const units = [...document.querySelectorAll(UNITS)].filter(live);
  const first = new Map(units.map(el => [el, textBox(el)]));
  const ghosts = units.filter(el => onscreen(first.get(el))).map(el => [el, ghost(el)]);

  document.body.append(...ghosts.map(([, g]) => g));
  for (const p of pieces) p.spans = split(p.el, p.letters);

  if (redecorate) crossfadeBackdrop(change, duration);
  else change();

  for (const p of pieces) {
    p.moves = p.spans.map((s, i) => {
      const [ax, ay] = anchor(p.first[i]);
      const [bx, by] = anchor(s.getBoundingClientRect());
      return [ax - bx, ay - by];
    });
  }
  // A paragraph that kept its line breaks and letter widths glides as one
  // block like any other unit: per-word animations would each cost a
  // compositor layer for nothing.
  const inStep = p => p.moves.every(([x, y]) => Math.abs(x - p.moves[0][0]) < 1 && Math.abs(y - p.moves[0][1]) < 1);
  const rigid = pieces.filter(p => !p.letters && inStep(p));
  pieces = pieces.filter(p => !rigid.includes(p));
  const waveHosts = new Set(pieces.filter(p => p.letters).map(p => p.host));
  const proseHosts = new Set(pieces.filter(p => !p.letters).map(p => p.host));

  const fadeIn = (el, delay = 0) => el.animate(
    [{ opacity: 0 }, { opacity: 1 }],
    { duration: duration * ARRIVE_SPAN, delay: delay + duration * ARRIVE_DELAY, easing: 'ease-out', fill: 'backwards' },
  );

  for (const [el, g] of ghosts) {
    const a = first.get(el);
    const b = textBox(el);
    const [dx, dy] = b && Math.abs(a.top - b.top) <= vh * 0.4
      ? [center(b)[0] - center(a)[0], center(b)[1] - center(a)[1]]
      : [0, 0];
    // It only covers part of the path before it's gone, so it travels that
    // part — keeping pace with the real text rather than racing ahead of it.
    g.animate(
      [{ transform: 'translate(0, 0)', opacity: 1 }, { transform: `translate(${dx * GHOST_SPAN}px, ${dy * GHOST_SPAN}px)`, opacity: 0 }],
      { duration: duration * GHOST_SPAN, easing: 'ease-in', fill: 'forwards' },
    ).finished.then(() => g.remove(), () => g.remove());
  }

  const far = new Set();
  for (const el of [...document.querySelectorAll(UNITS)].filter(live)) {
    if (waveHosts.has(el)) continue;
    const a = first.get(el);
    const b = textBox(el);
    if (!b || (!onscreen(a) && !onscreen(b))) continue;
    fadeIn(el);
    // Something that appeared, or came from well across the screen (a
    // section reorder), has no sensible path — a long slide is noise.
    if (!a || Math.abs(a.top - b.top) > vh * 0.4) { far.add(el); continue; }
    // Prose travels word by word below, so a paragraph that rewraps sends
    // words across to their new lines instead of sliding as a block whose
    // line breaks have already jumped.
    if (proseHosts.has(el)) continue;
    const [ax, ay] = center(a);
    const [bx, by] = center(b);
    if (Math.hypot(ax - bx, ay - by) < 1) continue;
    // composite: 'add' stacks on the element's own transform (drag offsets,
    // reveal transitions) instead of replacing it for the duration.
    el.animate(
      [{ transform: `translate(${ax - bx}px, ${ay - by}px)` }, { transform: 'translate(0, 0)' }],
      { duration, easing: EASING, composite: 'add' },
    );
  }
  rigid.forEach(join);

  const moves = pieces.flatMap(p => {
    if (far.has(p.host)) return [];
    return p.spans.map((s, i) => {
      const [dx, dy] = p.moves[i];
      // Letters trail one another and fade in on their own; words set off
      // together under their paragraph's fade.
      const delay = p.letters ? i * STAGGER_MS : 0;
      if (p.letters) fadeIn(s, delay);
      else if (Math.hypot(dx, dy) < 1) return null;
      return s.animate(
        [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0, 0)' }],
        { duration: p.letters ? duration * 0.8 : duration, delay, easing: EASING, fill: 'backwards' },
      ).finished;
    }).filter(Boolean);
  });
  Promise.allSettled(moves).then(() => pieces.forEach(join));
}

/**
 * Swap the hero's shapes and canvas art as a crossfade between the two
 * designs' backdrops.
 *
 * The outgoing shapes are the live layer itself, not a copy: a clone restarts
 * every shape's float/spin from frame zero, so they jumped the moment the fade
 * began. A fresh empty host goes in ahead of it for applyDecor to fill (it
 * takes the first .hero-shapes in the DOM).
 *
 * The outgoing layer's visibility is pinned to what it was. Layout rules hide
 * the shapes in some arrangements, and they'd otherwise apply to the old layer
 * under the new structure — shapes the old design never showed appeared for
 * the fade, and shapes it did show vanished instantly.
 */
export function crossfadeBackdrop(change, duration = 900) {
  const out = { duration: duration * GHOST_SPAN, easing: 'ease-in', fill: 'forwards' };
  const arrive = { duration: duration * ARRIVE_SPAN, delay: duration * ARRIVE_DELAY, easing: 'ease-out', fill: 'backwards' };

  const oldShapes = document.querySelector('.hero-shapes:not([aria-hidden])');
  const shapesShown = oldShapes && getComputedStyle(oldShapes).display !== 'none';
  let fresh = null;
  if (oldShapes) {
    fresh = oldShapes.cloneNode(false);
    fresh.replaceChildren();
    oldShapes.before(fresh);
    oldShapes.setAttribute('aria-hidden', 'true');
    if (shapesShown) oldShapes.style.display = getComputedStyle(oldShapes).display;
  }

  // The canvas clears itself on restart, so its last frame is kept as a
  // still that fades out over the new animation.
  const canvas = document.getElementById('hero-particles');
  let still = null;
  if (canvas?.width && canvas.height) {
    still = document.createElement('canvas');
    still.width = canvas.width;
    still.height = canvas.height;
    still.getContext('2d').drawImage(canvas, 0, 0);
    still.setAttribute('aria-hidden', 'true');
    Object.assign(still.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', pointerEvents: 'none', zIndex: '0' });
    canvas.after(still);
  }

  change();

  if (oldShapes && shapesShown) {
    oldShapes.animate([{ opacity: 1 }, { opacity: 0 }], out)
      .finished.then(() => oldShapes.remove(), () => oldShapes.remove());
  } else {
    oldShapes?.remove();
  }
  if (fresh) fresh.animate([{ opacity: 0 }, { opacity: 1 }], arrive);
  if (still) {
    still.animate([{ opacity: 1 }, { opacity: 0 }], out)
      .finished.then(() => still.remove(), () => still.remove());
    canvas.animate([{ opacity: 0 }, { opacity: 1 }], arrive);
  }
}

/**
 * Smooth reflow during a plain blend. Type size and width blend continuously,
 * but line breaks don't: the moment a heading rewraps, everything below it
 * snaps by a line height. Watching each unit's layout position frame to frame
 * and gliding any sudden move turns that snap into a slide.
 *
 * Positions come from offsetTop/offsetLeft, which ignore transforms, so the
 * slides this starts (and any glide still running) never read as new moves.
 */
const REFLOW_JUMP_PX = 8;
const REFLOW_MS = 350;
let settled = new Map();

function pagePos(el) {
  let x = 0, y = 0;
  for (let n = el; n; n = n.offsetParent) { x += n.offsetLeft; y += n.offsetTop; }
  return [x, y];
}

export function smoothReflow() {
  const next = new Map();
  for (const el of document.querySelectorAll(UNITS)) {
    if (el.closest('[aria-hidden]')) continue;
    const [x, y] = pagePos(el);
    next.set(el, [x, y]);
    const was = settled.get(el);
    if (!was) continue;
    const dx = was[0] - x, dy = was[1] - y;
    if (Math.hypot(dx, dy) < REFLOW_JUMP_PX) continue;
    el.animate(
      [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0, 0)' }],
      { duration: REFLOW_MS, easing: 'cubic-bezier(0.16, 1, 0.3, 1)', composite: 'add' },
    );
  }
  settled = next;
}

/** A glide moves everything on purpose; start watching afresh after it. */
export function resetReflow() {
  settled = new Map();
}
