import { DEFAULT_CONTENT } from './config.js';

const STORAGE_KEY = 'jjw_portfolio_content';

/**
 * Manages site content: reading, saving (debounced to localStorage),
 * exporting, importing, and resetting.
 *
 * @param {function} onStatus - callback(type, msg?) for save-status UI
 */
export class ContentManager {
  #content = null;
  #timer = null;
  #onStatus;

  constructor(onStatus) {
    this.#onStatus = onStatus;
  }

  /** Return current content (from localStorage or defaults). */
  getContent() {
    if (this.#content) return this.#content;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        this.#content = JSON.parse(raw);
        const h = this.#content.hero;
        if (h && !h.ctaPortfolio) {
          h.ctaPortfolio = structuredClone(DEFAULT_CONTENT.hero.ctaPortfolio);
        }
        this.#ensureNavPortfolioLink();
        return this.#content;
      }
    } catch { /* corrupt data — fall through to defaults */ }
    this.#content = structuredClone(DEFAULT_CONTENT);
    return this.#content;
  }

  /** Debounced save to localStorage (500 ms). */
  saveContent() {
    clearTimeout(this.#timer);
    this.#onStatus?.('saving');
    this.#timer = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.#content));
        this.#onStatus?.('saved');
      } catch {
        this.#onStatus?.('error', 'Storage full');
      }
    }, 500);
  }

  /** Download current content as a JSON file. */
  exportJSON() {
    const blob = new Blob(
      [JSON.stringify(this.#content, null, 2)],
      { type: 'application/json' },
    );
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), {
      href: url,
      download: 'content.json',
    });
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  /** Read a JSON file, validate it, and replace current content. */
  importJSON(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target.result);
          if (!data.hero || !data.about || !data.contact) {
            return reject('Missing required sections');
          }
          this.#content = data;
          const h = this.#content.hero;
          if (h && !h.ctaPortfolio) {
            h.ctaPortfolio = structuredClone(DEFAULT_CONTENT.hero.ctaPortfolio);
          }
          this.#ensureNavPortfolioLink();
          localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
          resolve(data);
        } catch {
          reject('Invalid JSON');
        }
      };
      reader.onerror = () => reject('Could not read file');
      reader.readAsText(file);
    });
  }

  /** Insert Portfolio after About when missing (older saved / imported JSON). */
  #ensureNavPortfolioLink() {
    const links = this.#content?.nav?.links;
    if (!Array.isArray(links)) return;
    const hasPortfolio = links.some(
      (l) => l && typeof l.href === 'string' && l.href.split('?')[0].endsWith('portfolio.html'),
    );
    if (hasPortfolio) return;
    const aboutIdx = links.findIndex((l) => l && l.href === '#about');
    const insertAt = aboutIdx >= 0 ? aboutIdx + 1 : 0;
    links.splice(insertAt, 0, { text: 'Portfolio', href: 'portfolio.html' });
  }

  /** Wipe localStorage and return a fresh copy of defaults. */
  resetToDefaults() {
    localStorage.removeItem(STORAGE_KEY);
    this.#content = structuredClone(DEFAULT_CONTENT);
    return this.#content;
  }
}
