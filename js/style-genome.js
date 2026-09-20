/**
 * Derives a full CSS custom-property set from a handful of genes.
 *
 * Randomising 46 independent variables produces noise — clashing hues, type
 * that does not scale, shadows that do not match the palette. So the genome is
 * small and everything else is derived from it, which keeps every roll
 * internally consistent while still spanning a large space.
 */

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const round = (n, p = 0) => Number(n.toFixed(p));

/** Mulberry32 — deterministic PRNG so a seed always yields the same design. */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hsl(h, s, l, a = 1) {
  return a === 1 ? `hsl(${round(h)} ${round(s)}% ${round(l)}%)` : `hsl(${round(h)} ${round(s)}% ${round(l)}% / ${a})`;
}

export const FONT_STACKS = [
  "'Segoe UI', system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
  "Georgia, 'Iowan Old Style', 'Times New Roman', serif",
  "'Helvetica Neue', Helvetica, Arial, sans-serif",
  "'SF Mono', 'Cascadia Code', 'Fira Code', Consolas, monospace",
  "'Trebuchet MS', 'Segoe UI', Verdana, sans-serif",
  "'Palatino Linotype', Palatino, 'Book Antiqua', serif",
  "'Courier New', Courier, monospace",
  "Impact, 'Haettenschweiler', 'Arial Narrow Bold', sans-serif",
  "'Lucida Sans', 'Lucida Grande', 'Lucida Sans Unicode', sans-serif",
  "'Century Gothic', 'Apple Gothic', AppleGothic, sans-serif",
  "Baskerville, 'Baskerville Old Face', 'Times New Roman', serif",
  "Verdana, Geneva, sans-serif",
];

// Display faces can differ from body text. Pairing a heavy display with a
// readable body is the single biggest lever on how a page reads.
export const DISPLAY_STACKS = [
  ...FONT_STACKS,
  "'Arial Black', 'Arial Bold', Gadget, sans-serif",
  "'Bodoni MT', Didot, 'Didot LT STD', serif",
  "'Gill Sans', 'Gill Sans MT', Calibri, sans-serif",
];

/**
 * The default site's own palette, expressed as a genome instead of hardcoded
 * hex values. Light and dark mode are the same genome run through
 * genomeToCSS with `dark` flipped — one derivation for the stock site and
 * every generated variant, instead of a second hand-picked color set that
 * dark mode had to maintain in parallel.
 */
export const DEFAULT_GENOME = {
  seed: 0,
  hue: 208,
  accentOffset: 150,
  saturation: 70,
  lightness: 32,
  contrast: 0.9,
  radius: 20,
  density: 1,
  fontIndex: 0,
  displayIndex: 0,
  typeScale: 1.3,
  displayWeight: 700,
  displayTracking: 0,
  displayCase: 'none',
  bodyLeading: 1.6,
  shadowDepth: 0.15,
  borderWeight: 0.2,
};

/** A genome: the small set of genes everything else derives from. */
export function randomGenome(seed = Math.floor(Math.random() * 1e9)) {
  const r = rng(seed);
  const pick = arr => arr[Math.floor(r() * arr.length)];
  return {
    seed,
    hue: round(r() * 360),
    // Complement, triad or analogous — never an arbitrary second hue, which is
    // what makes random palettes look wrong.
    accentOffset: pick([180, 150, 210, 30, 330, 120]),
    saturation: round(20 + r() * 65),
    // Below ~30 or above ~92 the text-contrast maths stops working.
    lightness: round(30 + r() * 62),
    contrast: round(0.55 + r() * 0.45, 2),
    radius: round(r() * 26),
    density: round(0.6 + r() * 1.1, 2),
    fontIndex: Math.floor(r() * FONT_STACKS.length),
    displayIndex: Math.floor(r() * DISPLAY_STACKS.length),
    // Type scale ratio: 1.15 is a quiet page, 1.7 is a poster.
    typeScale: round(1.12 + r() * 0.62, 3),
    displayWeight: pick([300, 400, 600, 700, 800, 900]),
    displayTracking: round(-0.05 + r() * 0.22, 3),
    displayCase: pick(['none', 'none', 'uppercase']),
    bodyLeading: round(1.4 + r() * 0.6, 2),
    shadowDepth: round(r(), 2),
    borderWeight: round(r(), 2),
  };
}

/**
 * Expand a genome into the CSS custom properties main.css already consumes.
 *
 * The dark/light toggle is the visitor's explicit choice, so it wins over
 * whatever the lightness gene rolled — a variant should get a dark palette
 * derived from its own hue/saturation, not silently ignore body.dark and
 * make the toggle button appear broken.
 */
export function genomeToCSS(g, forceDark = document.body.classList.contains('dark')) {
  const dark = forceDark != null ? forceDark : g.lightness < 50;
  const accent = (g.hue + g.accentOffset) % 360;
  const sat = g.saturation;

  // Text lightness is pinned to the opposite end of the background so contrast
  // survives whatever the background gene rolled.
  const textL = dark ? 92 : 10;
  const text2L = dark ? 72 : 34;
  const text3L = dark ? 52 : 58;

  const bgL = dark ? clamp(g.lightness * 0.28, 6, 18) : clamp(g.lightness, 88, 98);
  const bgAltL = dark ? bgL + 5 : bgL - 4;
  const bgCardL = dark ? bgL + 8 : 100;

  const primaryL = dark ? clamp(46 + g.contrast * 22, 46, 72) : clamp(52 - g.contrast * 22, 24, 52);
  const sd = g.shadowDepth;
  const bw = round(0.5 + g.borderWeight * 2, 1);

  return {
    '--bg': hsl(g.hue, sat * 0.12, bgL),
    '--bg-alt': hsl(g.hue, sat * 0.16, bgAltL),
    '--bg-card': hsl(g.hue, sat * 0.08, bgCardL),

    '--blue': hsl(g.hue, sat, primaryL),
    '--blue-dark': hsl(g.hue, sat, clamp(primaryL - 14, 8, 90)),
    '--blue-light': hsl(g.hue, sat * 0.5, dark ? clamp(primaryL - 26, 10, 40) : clamp(primaryL + 40, 60, 96)),
    '--blue-soft': hsl(g.hue, sat, primaryL, 0.08),

    '--yellow': hsl(accent, clamp(sat * 1.1, 30, 95), dark ? 62 : 56),
    '--yellow-soft': hsl(accent, sat, 56, 0.18),

    '--text': hsl(g.hue, sat * 0.1, textL),
    '--text-2': hsl(g.hue, sat * 0.08, text2L),
    '--text-3': hsl(g.hue, sat * 0.06, text3L),

    '--border': hsl(g.hue, sat * 0.14, dark ? bgL + 12 : bgL - 8),
    '--border-light': hsl(g.hue, sat * 0.1, dark ? bgL + 8 : bgL - 4),

    '--radius-sm': `${round(g.radius * 0.35)}px`,
    '--radius-md': `${round(g.radius)}px`,
    '--radius-lg': `${round(g.radius * 1.6)}px`,

    '--font': FONT_STACKS[g.fontIndex],
    '--font-display': DISPLAY_STACKS[g.displayIndex],

    // One ratio drives every heading size, so the hierarchy stays proportional
    // whatever the roll.
    '--h1-size': `clamp(${round(1.9 * g.typeScale, 2)}rem, ${round(4.4 * g.typeScale, 1)}vw, ${round(2.6 * g.typeScale ** 3, 2)}rem)`,
    '--h2-size': `clamp(${round(1.3 * g.typeScale, 2)}rem, ${round(2.6 * g.typeScale, 1)}vw, ${round(1.5 * g.typeScale ** 2, 2)}rem)`,
    '--h3-size': `${round(0.95 * g.typeScale, 2)}rem`,
    '--display-weight': String(g.displayWeight),
    '--display-tracking': `${g.displayTracking}em`,
    '--display-case': g.displayCase,
    '--body-leading': String(g.bodyLeading),

    '--section-gap': `clamp(${round(3 * g.density, 1)}rem, ${round(9 * g.density)}vw, ${round(7 * g.density, 1)}rem)`,
    '--container': `${round(880 + g.density * 320)}px`,
    '--pad': `clamp(${round(0.9 * g.density, 2)}rem, ${round(3 * g.density, 1)}vw, ${round(1.6 * g.density, 2)}rem)`,
    '--nav-h': `${round(52 + g.density * 22)}px`,

    '--shadow-sm': `0 1px ${round(2 + sd * 3)}px rgba(0,0,0,${round(0.03 + sd * 0.05, 3)})`,
    '--shadow-md': `0 ${round(3 + sd * 6)}px ${round(10 + sd * 18)}px rgba(0,0,0,${round(0.03 + sd * 0.07, 3)})`,
    '--shadow-lg': `0 ${round(8 + sd * 18)}px ${round(24 + sd * 40)}px rgba(0,0,0,${round(0.04 + sd * 0.09, 3)})`,
    '--shadow-offset': `${round(2 + sd * 8)}px ${round(2 + sd * 8)}px 0 ${hsl(g.hue, sat, primaryL, 0.1)}`,
    '--shadow-offset-lg': `${round(4 + sd * 12)}px ${round(4 + sd * 12)}px 0 ${hsl(g.hue, sat, primaryL, 0.1)}`,

    '--border-weight': `${bw}px`,
  };
}

/** Write a genome's properties onto :root. */
export function applyGenome(g) {
  const css = genomeToCSS(g);
  const root = document.documentElement;
  for (const [prop, value] of Object.entries(css)) root.style.setProperty(prop, value);
  return css;
}
