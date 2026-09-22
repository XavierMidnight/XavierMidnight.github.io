import { randomGenome, applyGenome, mixGenome, DEFAULT_GENOME } from './style-genome.js';
import { randomStructure, applyStructure } from './structure-genome.js';
import { randomDecor, applyDecor } from './decor-genome.js';
import { randomCanvas, GenerativeCanvas } from './canvas-genome.js';

const MANIFEST = 'variants/index.json';

/**
 * Loads an alternate copy of the site content for a single pageview.
 *
 * Variants are never written to localStorage. The same key holds the owner's
 * real edits, so persisting a variant would either strand a visitor in one
 * forever or overwrite content the owner actually wrote.
 */
export class Variants {
  #active = null;
  #genome = null;
  #structure = null;
  #decor = null;
  #canvas = null;
  #canvasRunner = null;

  /** Variant name from ?variant=, or null. */
  static requested() {
    return new URLSearchParams(location.search).get('variant');
  }

  /** The variant currently being displayed, or null for default content. */
  get active() {
    return this.#active;
  }

  /** The style genome applied this pageview, or null. */
  get genome() {
    return this.#genome;
  }

  /** The structure genome applied this pageview, or null. */
  get structure() {
    return this.#structure;
  }

  /** The decor genome applied this pageview, or null. */
  get decor() {
    return this.#decor;
  }

  /** The canvas genome applied this pageview, or null. */
  get canvas() {
    return this.#canvas;
  }

  /**
   * Swap the hero's canvas behaviour.
   *
   * ?canvas=random rerolls, ?canvas=<seed> reproduces, ?canvas=off disables.
   * Returns true when it took over, so the caller can skip the stock particles
   * rather than run two animation loops on one canvas.
   */
  applyCanvasGenome(fallbackSeed = null) {
    const param = new URLSearchParams(location.search).get('canvas');
    if (param === 'off') {
      this.#canvas = { behaviour: 'none' };
      return true;
    }
    if (!param && fallbackSeed == null) return false;
    let seed;
    if (param && param !== 'random' && param !== '') {
      seed = Number(param);
      if (!Number.isFinite(seed)) {
        console.warn(`[variants] canvas seed "${param}" is not a number — ignoring`);
        return false;
      }
    } else if (param === 'random' || param === '') {
      seed = undefined;
    } else {
      seed = fallbackSeed;
    }
    this.#canvas = randomCanvas(seed);
    this.#canvasRunner = new GenerativeCanvas();
    this.#canvasRunner.start(this.#canvas);
    return true;
  }

  /**
   * Regenerate the hero's decorative layer.
   *
   * ?decor=random rerolls, ?decor=<seed> reproduces one, ?decor=off clears it.
   * Falls back to the style seed so one number drives the whole design.
   */
  applyDecorGenome(fallbackSeed = null) {
    const param = new URLSearchParams(location.search).get('decor');
    if (param === 'off') {
      const host = document.querySelector('.hero-shapes');
      if (host) host.innerHTML = '';
      return null;
    }
    if (!param && fallbackSeed == null) return null;
    let seed;
    if (param && param !== 'random' && param !== '') {
      seed = Number(param);
      if (!Number.isFinite(seed)) {
        console.warn(`[variants] decor seed "${param}" is not a number — ignoring`);
        return null;
      }
    } else if (param === 'random' || param === '') {
      seed = undefined;
    } else {
      seed = fallbackSeed;
    }
    this.#decor = randomDecor(seed);
    applyDecor(this.#decor);
    return this.#decor;
  }

  /**
   * Reorder sections and switch per-section arrangements.
   *
   * ?layout=random rerolls, ?layout=<seed> reproduces one. ?style= seeds this
   * too when ?layout= is absent, so a single seed describes a whole design.
   */
  applyLayoutGenome(styleSeed = null) {
    const param = new URLSearchParams(location.search).get('layout');
    if (!param && styleSeed == null) return null;
    let seed;
    if (param && param !== 'random' && param !== '') {
      seed = Number(param);
      if (!Number.isFinite(seed)) {
        console.warn(`[variants] layout seed "${param}" is not a number — ignoring`);
        return null;
      }
    } else if (param === 'random' || param === '') {
      seed = undefined;
    } else {
      seed = styleSeed;
    }
    this.#structure = randomStructure(seed);
    return applyStructure(this.#structure);
  }

  /**
   * Apply every generative layer for one seed.
   *
   * The shuffler needs to swap designs after boot, and doing that by calling
   * the four appliers in the right order from two places invites them drifting
   * apart. Returns whether sections moved, so the caller can re-arm the reveal
   * observer.
   */
  applyAll(seed) {
    this.#genome = randomGenome(seed);
    applyGenome(this.#genome);
    const moved = applyStructure(randomStructure(seed));
    applyDecor(randomDecor(seed));
    this.#canvasRunner?.stop();
    this.#canvas = randomCanvas(seed);
    this.#canvasRunner = new GenerativeCanvas();
    this.#canvasRunner.start(this.#canvas);
    return moved;
  }

  /**
   * Begin a partial step toward a seed's design and return the genome blend
   * the caller should animate across.
   *
   * `amount` is how far toward the seed to go (0–1). The discrete layers only
   * change past a threshold, so small steps drift colour and proportion while
   * the words stay where they are, and only big steps rearrange the page.
   *
   * The discrete swaps are deferred to `commit`, which the caller runs once
   * the page has faded out, so a layout jump lands unseen rather than as a
   * hard cut. `fade` (0–1 wash
   * toward the background) is the peak, scaled by how jarring the biggest
   * swap in this step is.
   */
  retarget(seed, amount) {
    const from = this.#genome ?? DEFAULT_GENOME;
    const to = mixGenome(from, randomGenome(seed), amount, amount >= 0.4);
    const restructure = amount >= 0.75;
    const redecorate = amount >= 0.25;
    // Weight and case flips rewrap the headline as much as a new face does.
    const refont = ['fontIndex', 'displayIndex', 'displayWeight', 'displayCase'].some(k => to[k] !== from[k]);
    // Changes that move the words fade nearly out, so the swap isn't seen.
    const fade = restructure || refont ? 0.85 : redecorate ? 0.2 : 0;
    const commit = () => {
      let moved = false;
      if (restructure) moved = applyStructure(randomStructure(seed));
      if (redecorate) {
        applyDecor(randomDecor(seed));
        this.#canvasRunner?.stop();
        this.#canvas = randomCanvas(seed);
        this.#canvasRunner = new GenerativeCanvas();
        this.#canvasRunner.start(this.#canvas);
      }
      return moved;
    };
    return { from, to, fade, commit };
  }

  /** Paint one frame of a blend. */
  paint(genome) {
    this.#genome = genome;
    applyGenome(genome);
  }

  /**
   * Restyle the page from a generated genome.
   *
   * Style is a separate axis from content: ?style=random rerolls the palette,
   * type and spacing on every refresh while leaving the words alone, and
   * ?style=<seed> reproduces a specific one. Text is never generated — that
   * needs an explicit opt-in, since the words are the owner's, not the
   * system's.
   */
  applyStyle() {
    const param = new URLSearchParams(location.search).get('style');
    if (!param) return null;
    const seed = param === 'random' || param === '' ? undefined : Number(param);
    if (param !== 'random' && param !== '' && !Number.isFinite(seed)) {
      console.warn(`[variants] style seed "${param}" is not a number — ignoring`);
      return null;
    }
    this.#genome = randomGenome(seed);
    applyGenome(this.#genome);
    return this.#genome;
  }

  /**
   * Resolve a variant for this pageview: the one named in ?variant=, else a
   * random entry from the manifest. Returns content, or null to use defaults.
   */
  async resolve() {
    const manifest = await this.#loadManifest();
    if (!manifest.length) return null;

    const requested = Variants.requested();
    const pick = requested
      ? manifest.find(v => v.name === requested)
      : manifest[Math.floor(Math.random() * manifest.length)];

    if (!pick) {
      console.warn(`[variants] no variant named "${requested}"`);
      return null;
    }

    try {
      const res = await fetch(pick.file);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const content = await res.json();
      if (!content.hero || !content.about || !content.contact) {
        throw new Error('missing required sections');
      }
      this.#active = pick;
      return content;
    } catch (e) {
      console.warn(`[variants] could not load ${pick.file}: ${e.message}`);
      return null;
    }
  }

  async #loadManifest() {
    try {
      const res = await fetch(MANIFEST);
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data.variants) ? data.variants : [];
    } catch {
      return [];
    }
  }
}
