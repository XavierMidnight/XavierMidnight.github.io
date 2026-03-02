import { getByPath, setByPath } from './utils.js';

/**
 * Controls the inline-editing experience: toolbar, contenteditable
 * management, and DOM → content synchronisation.
 */
export class EditMode {
  #active = false;
  #debounce = null;
  #toolbar = null;
  #gear = null;
  #cm;        // ContentManager
  #renderer;
  #indicator; // SaveIndicator

  constructor(contentManager, renderer, saveIndicator) {
    this.#cm = contentManager;
    this.#renderer = renderer;
    this.#indicator = saveIndicator;
  }

  get active() { return this.#active; }

  // ── bootstrap (call once) ─────────────────────────────

  init() {
    this.#createToolbar();
    this.#createGear();
    this.#bindKeyboardShortcut();
    this.#bindImportInput();
  }

  // ── toggle ────────────────────────────────────────────

  toggle() {
    this.#active ? this.deactivate() : this.activate();
  }

  activate() {
    this.#active = true;
    document.body.classList.add('edit-mode');
    this.#toolbar.style.display = 'flex';
    this.applyEditable();
  }

  deactivate() {
    this.syncAll();
    this.#active = false;
    document.body.classList.remove('edit-mode');
    this.#toolbar.style.display = 'none';
    this.#removeEditable();
  }

  /** Re-apply contenteditable after a section re-render. */
  reapply() {
    if (this.#active) this.applyEditable();
  }

  // ── make elements editable ────────────────────────────

  applyEditable() {
    const ce = 'plaintext-only';

    const selectors = [
      '[data-path]',
      '[data-stat-id][data-field]',
      '[data-skill-index]',
      '[data-nav-index]',
    ];

    for (const sel of selectors) {
      document.querySelectorAll(sel).forEach((el) => {
        el.setAttribute('contenteditable', ce);
        el.addEventListener('input', this.#onInput);
        el.addEventListener('paste', this.#onPaste);
        el.addEventListener('keydown', this.#onKey);
      });
    }
  }

  #removeEditable() {
    document.querySelectorAll('[contenteditable]').forEach((el) => {
      el.removeAttribute('contenteditable');
      el.removeEventListener('input', this.#onInput);
      el.removeEventListener('paste', this.#onPaste);
      el.removeEventListener('keydown', this.#onKey);
    });
  }

  // ── event handlers (arrow fns so `this` stays bound) ──

  #onInput = () => {
    clearTimeout(this.#debounce);
    this.#indicator.show('saving');
    this.#debounce = setTimeout(() => this.syncAll(), 500);
  };

  #onPaste = (e) => {
    e.preventDefault();
    const text = (e.clipboardData || window.clipboardData).getData('text/plain');
    document.execCommand('insertText', false, text);
  };

  #onKey = (e) => {
    if (e.key === 'Enter' && !e.target.hasAttribute('data-multiline')) {
      e.preventDefault();
      e.target.blur();
    }
    if (e.key === 'Escape') e.target.blur();
  };

  // ── sync DOM → content object ─────────────────────────

  syncAll() {
    const c = this.#cm.getContent();

    // simple paths
    document.querySelectorAll('[data-path]').forEach((el) => {
      const path = el.dataset.path;
      const idx = el.dataset.index;
      if (idx !== undefined) {
        const arr = getByPath(c, path);
        if (arr) arr[parseInt(idx)] = el.textContent;
      } else {
        setByPath(c, path, el.textContent);
      }
    });

    // stat fields
    document.querySelectorAll('[data-stat-id][data-field]').forEach((el) => {
      const stat = c.about.stats.find((s) => s.id === el.dataset.statId);
      if (stat) stat[el.dataset.field] = el.textContent;
    });

    // skills (text-only, ignoring the × delete span)
    document.querySelectorAll('[data-skill-index]').forEach((el) => {
      const idx = parseInt(el.dataset.skillIndex);
      const text = Array.from(el.childNodes)
        .filter((n) => n.nodeType === Node.TEXT_NODE)
        .map((n) => n.textContent)
        .join('')
        .trim();
      if (c.about.skills[idx] !== undefined) {
        c.about.skills[idx] = text || el.textContent.replace('\u00d7', '').trim();
      }
    });

    // nav link text
    document.querySelectorAll('[data-nav-index]').forEach((el) => {
      const idx = parseInt(el.dataset.navIndex);
      if (c.nav.links[idx]) c.nav.links[idx].text = el.textContent;
    });

    this.#cm.saveContent();
  }

  // ── reset ─────────────────────────────────────────────

  resetContent() {
    if (!confirm('Reset all content to defaults? This cannot be undone.')) return;
    const content = this.#cm.resetToDefaults();
    this.#renderer.renderAll(content);
    if (this.#active) this.applyEditable();
    this.#indicator.show('saved');
  }

  // ── JSON import handler ───────────────────────────────

  async handleImport(file) {
    try {
      const content = await this.#cm.importJSON(file);
      this.#renderer.renderAll(content);
      if (this.#active) this.applyEditable();
      this.#indicator.show('saved');
    } catch (err) {
      this.#indicator.show('error', String(err));
    }
  }

  // ── private: DOM creation ─────────────────────────────

  #createToolbar() {
    this.#toolbar = document.createElement('div');
    this.#toolbar.className = 'admin-toolbar';
    this.#toolbar.style.display = 'none';
    this.#toolbar.innerHTML = `
      <div class="toolbar-status">
        <span class="toolbar-dot"></span><span>Edit Mode</span>
      </div>
      <button class="toolbar-btn" data-action="export-json">Export JSON</button>
      <button class="toolbar-btn" data-action="import-json">Import JSON</button>
      <button class="toolbar-btn danger" data-action="reset-content">Reset</button>
      <button class="toolbar-btn exit" data-action="toggle-edit">Exit</button>`;
    document.body.prepend(this.#toolbar);
  }

  #createGear() {
    this.#gear = document.createElement('button');
    this.#gear.className = 'edit-gear';
    this.#gear.setAttribute('aria-label', 'Toggle edit mode');
    this.#gear.textContent = '\u2699';
    this.#gear.setAttribute('data-action', 'toggle-edit');
    document.body.appendChild(this.#gear);
  }

  #bindKeyboardShortcut() {
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'E') {
        e.preventDefault();
        this.toggle();
      }
    });
  }

  #bindImportInput() {
    document.getElementById('json-import').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) this.handleImport(file);
      e.target.value = '';
    });
  }
}
