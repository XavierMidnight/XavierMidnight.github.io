/**
 * Free-form drag positioning for edit mode.
 * Uses CSS custom properties (--drag-x, --drag-y) with the independent
 * `translate` CSS property so offsets compose with existing transforms.
 */
export class DragPosition {
  #cm;          // ContentManager
  #indicator;   // SaveIndicator
  #active = false;
  #handles = [];
  #dragging = null; // { el, posKey, startX, startY, origX, origY }

  constructor(contentManager, saveIndicator) {
    this.#cm = contentManager;
    this.#indicator = saveIndicator;
  }

  // ── lifecycle ─────────────────────────────────────────

  activate() {
    if (this.#active) return;
    this.#active = true;
    this.#injectHandles();
    this.applyStoredPositions();
    document.addEventListener('mousemove', this.#onMouseMove);
    document.addEventListener('mouseup', this.#onMouseUp);
  }

  deactivate() {
    if (this.#dragging) this.#cancelDrag();
    this.#active = false;
    this.#removeHandles();
    document.removeEventListener('mousemove', this.#onMouseMove);
    document.removeEventListener('mouseup', this.#onMouseUp);
  }

  /** Re-inject handles after a section re-render. */
  reapply() {
    if (!this.#active) return;
    this.#removeHandles();
    this.#injectHandles();
    this.applyStoredPositions();
  }

  // ── position application ──────────────────────────────

  applyStoredPositions() {
    const layout = this.#cm.getContent().layout || {};
    document.querySelectorAll('[data-pos-key]').forEach((el) => {
      const pos = layout[el.dataset.posKey];
      if (pos) {
        el.style.setProperty('--drag-x', `${pos.x}px`);
        el.style.setProperty('--drag-y', `${pos.y}px`);
      } else {
        el.style.removeProperty('--drag-x');
        el.style.removeProperty('--drag-y');
      }
    });
  }

  // ── reset ─────────────────────────────────────────────

  resetLayout() {
    if (!confirm('Reset all element positions to defaults?')) return;
    const content = this.#cm.getContent();
    content.layout = {};
    this.#cm.saveContent();
    document.querySelectorAll('[data-pos-key]').forEach((el) => {
      el.style.removeProperty('--drag-x');
      el.style.removeProperty('--drag-y');
    });
    this.#indicator.show('saved');
  }

  // ── array position cleanup ────────────────────────────

  /** Shift position keys when an indexed array item is removed. */
  cleanupArrayPositions(prefix, removedIndex) {
    const content = this.#cm.getContent();
    if (!content.layout) return;
    const updated = {};
    for (const [key, val] of Object.entries(content.layout)) {
      if (!key.startsWith(prefix + '.')) {
        updated[key] = val;
        continue;
      }
      const idx = parseInt(key.split('.').pop());
      if (isNaN(idx)) { updated[key] = val; continue; }
      if (idx === removedIndex) continue;
      if (idx > removedIndex) {
        updated[`${prefix}.${idx - 1}`] = val;
      } else {
        updated[key] = val;
      }
    }
    content.layout = updated;
  }

  /** Remove a single position entry by exact key. */
  removePosition(key) {
    const content = this.#cm.getContent();
    if (content.layout) delete content.layout[key];
  }

  // ── private: handle injection ─────────────────────────

  #injectHandles() {
    document.querySelectorAll('[data-pos-key]').forEach((el) => {
      if (el.querySelector('.drag-handle')) return;
      const handle = document.createElement('button');
      handle.className = 'drag-handle edit-only';
      handle.setAttribute('aria-label', 'Drag to reposition');
      handle.textContent = '\u2807'; // vertical ellipsis
      handle.addEventListener('mousedown', this.#onHandleMouseDown);
      el.prepend(handle);
      this.#handles.push(handle);
    });
  }

  #removeHandles() {
    this.#handles.forEach((h) => {
      h.removeEventListener('mousedown', this.#onHandleMouseDown);
      h.remove();
    });
    this.#handles = [];
  }

  // ── private: drag handlers ────────────────────────────

  #onHandleMouseDown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const el = e.currentTarget.closest('[data-pos-key]');
    if (!el) return;

    const posKey = el.dataset.posKey;
    const layout = this.#cm.getContent().layout || {};
    const current = layout[posKey] || { x: 0, y: 0 };

    this.#dragging = {
      el,
      posKey,
      startX: e.clientX,
      startY: e.clientY,
      origX: current.x,
      origY: current.y,
    };

    el.classList.add('is-dragging');
    document.body.classList.add('dragging');
  };

  #onMouseMove = (e) => {
    if (!this.#dragging) return;
    const { el, startX, startY, origX, origY } = this.#dragging;
    const newX = origX + (e.clientX - startX);
    const newY = origY + (e.clientY - startY);
    el.style.setProperty('--drag-x', `${newX}px`);
    el.style.setProperty('--drag-y', `${newY}px`);
  };

  #onMouseUp = (e) => {
    if (!this.#dragging) return;
    const { el, posKey, startX, startY, origX, origY } = this.#dragging;
    const newX = origX + (e.clientX - startX);
    const newY = origY + (e.clientY - startY);

    const content = this.#cm.getContent();
    if (!content.layout) content.layout = {};

    if (Math.abs(newX) < 1 && Math.abs(newY) < 1) {
      delete content.layout[posKey];
      el.style.removeProperty('--drag-x');
      el.style.removeProperty('--drag-y');
    } else {
      content.layout[posKey] = { x: Math.round(newX), y: Math.round(newY) };
    }

    this.#cm.saveContent();
    this.#indicator.show('saved');

    el.classList.remove('is-dragging');
    document.body.classList.remove('dragging');
    this.#dragging = null;
  };

  #cancelDrag() {
    if (!this.#dragging) return;
    const { el, posKey, origX, origY } = this.#dragging;
    if (Math.abs(origX) < 1 && Math.abs(origY) < 1) {
      el.style.removeProperty('--drag-x');
      el.style.removeProperty('--drag-y');
    } else {
      el.style.setProperty('--drag-x', `${origX}px`);
      el.style.setProperty('--drag-y', `${origY}px`);
    }
    el.classList.remove('is-dragging');
    document.body.classList.remove('dragging');
    this.#dragging = null;
  }
}
