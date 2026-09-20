import { randomGenome, applyGenome } from './style-genome.js';

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
