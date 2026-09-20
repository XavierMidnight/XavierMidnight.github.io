/**
 * Dark mode toggle with localStorage persistence.
 * Adds `body.dark` class and swaps the button icon.
 */
export class DarkMode {
  #key = 'jjw_dark_mode';
  #btn = null;
  #onChange;

  /** @param {() => void} onChange  called after the body.dark class flips */
  constructor(onChange = () => {}) {
    this.#onChange = onChange;
  }

  init() {
    this.#createToggle();
    if (localStorage.getItem(this.#key) === 'true') {
      document.body.classList.add('dark');
      this.#updateIcon();
    }
  }

  toggle() {
    document.body.classList.toggle('dark');
    localStorage.setItem(this.#key, document.body.classList.contains('dark'));
    this.#updateIcon();
    this.#onChange();
  }

  #createToggle() {
    this.#btn = document.createElement('button');
    this.#btn.className = 'dark-toggle';
    this.#btn.setAttribute('aria-label', 'Toggle dark mode');
    this.#btn.textContent = '\u263E'; // last quarter moon
    this.#btn.addEventListener('click', () => this.toggle());
    document.body.appendChild(this.#btn);
  }

  #updateIcon() {
    if (!this.#btn) return;
    const isDark = document.body.classList.contains('dark');
    this.#btn.textContent = isDark ? '\u2600' : '\u263E'; // sun : moon
  }
}
