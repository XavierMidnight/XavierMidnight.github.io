import { uid } from './utils.js';

/**
 * Structural editors for skills, stats, and paragraphs.
 * Each function mutates content, saves, re-renders, and re-applies
 * edit mode. They share the same dependency references injected at
 * construction.
 */
export class Editors {
  #cm;       // ContentManager
  #renderer;
  #editMode;

  constructor(contentManager, renderer, editMode) {
    this.#cm = contentManager;
    this.#renderer = renderer;
    this.#editMode = editMode;
  }

  // ── helpers ───────────────────────────────────────────

  #refreshAbout() {
    const c = this.#cm.getContent();
    this.#cm.saveContent();
    this.#renderer.renderAbout(c.about);
    this.#renderer.setupScrollAnimations();
    this.#editMode.reapply();
  }

  // ── skills ────────────────────────────────────────────

  addSkill() {
    const name = prompt('New skill name:');
    if (!name?.trim()) return;
    this.#cm.getContent().about.skills.push(name.trim());
    this.#refreshAbout();
  }

  removeSkill(index) {
    this.#cm.getContent().about.skills.splice(index, 1);
    this.#refreshAbout();
  }

  // ── stats ─────────────────────────────────────────────

  addStat() {
    this.#cm.getContent().about.stats.push({
      id: 'stat' + uid(),
      number: '0',
      label: 'New stat',
    });
    this.#refreshAbout();
  }

  removeStat(id) {
    const about = this.#cm.getContent().about;
    about.stats = about.stats.filter((s) => s.id !== id);
    this.#refreshAbout();
  }

  // ── paragraphs ────────────────────────────────────────

  addParagraph() {
    this.#cm.getContent().about.paragraphs.push('New paragraph \u2014 click to edit.');
    this.#refreshAbout();
  }

  removeParagraph(index) {
    const paras = this.#cm.getContent().about.paragraphs;
    if (paras.length <= 1) return; // keep at least one
    paras.splice(index, 1);
    this.#refreshAbout();
  }
}
