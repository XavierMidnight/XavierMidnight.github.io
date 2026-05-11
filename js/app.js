/**
 * Entry point. Wires together all modules and sets up
 * a single event-delegation handler for every interactive
 * element rendered by the site.
 */
import { SaveIndicator } from './save-indicator.js';
import { ContentManager } from './content-manager.js';
import { Renderer } from './renderer.js';
import { DragPosition } from './drag-position.js';
import { EditMode } from './edit-mode.js';
import { Editors } from './editors.js';
import { Effects } from './effects.js';
import { ParticleSystem } from './particles.js';
import { DarkMode } from './dark-mode.js';

// ── create instances ────────────────────────────────────

const saveIndicator = new SaveIndicator();
const contentManager = new ContentManager((type, msg) => saveIndicator.show(type, msg));
const renderer = new Renderer();
const dragPosition = new DragPosition(contentManager, saveIndicator);
const editMode = new EditMode(contentManager, renderer, saveIndicator, dragPosition);
const editors = new Editors(contentManager, renderer, editMode, dragPosition);
const effects = new Effects();
const particles = new ParticleSystem();
const darkMode = new DarkMode();

// ── boot ────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  saveIndicator.init();
  darkMode.init();

  const content = contentManager.getContent();
  renderer.renderAll(content);

  particles.init();
  effects.initParallax();
  effects.initCounters();
  effects.typeSubtitle();

  editMode.init();
});

// ── event delegation ────────────────────────────────────
// Every button rendered with a data-action attribute is
// handled here, keeping modules free of inline onclick refs.

document.addEventListener('click', (e) => {
  const trigger = e.target.closest('[data-action]');
  if (!trigger) return;

  const { action, index, id } = trigger.dataset;

  switch (action) {
    // toolbar
    case 'toggle-edit':      editMode.toggle(); break;
    case 'export-json':      contentManager.exportJSON(); break;
    case 'import-json':      document.getElementById('json-import').click(); break;
    case 'reset-content':    editMode.resetContent(); break;
    case 'reset-layout':     dragPosition.resetLayout(); break;

    // skills
    case 'add-skill':          editors.addSkill(); break;
    case 'remove-skill':       editors.removeSkill(parseInt(index)); break;

    // stats
    case 'add-stat':           editors.addStat(); break;
    case 'remove-stat':        editors.removeStat(id); break;

    // paragraphs
    case 'add-paragraph':      editors.addParagraph(); break;
    case 'remove-paragraph':   editors.removeParagraph(parseInt(index)); break;
  }
});
