/**
 * Tiny toast that shows save-status feedback.
 * Call .init() once to inject the DOM element.
 */
export class SaveIndicator {
  #el = null;
  #timer = null;

  init() {
    this.#el = document.createElement('div');
    this.#el.className = 'save-toast';
    document.body.appendChild(this.#el);
  }

  show(type, msg) {
    if (!this.#el) return;
    clearTimeout(this.#timer);
    this.#el.className = 'save-toast show ' + type;

    if (type === 'saving') {
      this.#el.textContent = 'Saving\u2026';
    } else if (type === 'saved') {
      this.#el.textContent = '\u2713 Saved';
      this.#timer = setTimeout(() => this.#el.classList.remove('show'), 1800);
    } else if (type === 'error') {
      this.#el.textContent = msg || 'Error';
      this.#timer = setTimeout(() => this.#el.classList.remove('show'), 4000);
    }
  }
}
