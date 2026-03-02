/**
 * Entry point. Wires together all modules and sets up
 * a single event-delegation handler for every interactive
 * element rendered by the site.
 */
import { SaveIndicator } from './save-indicator.js';
import { ContentManager } from './content-manager.js';
import { Renderer } from './renderer.js';
import { EditMode } from './edit-mode.js';
import { Editors } from './editors.js';

// ── create instances ────────────────────────────────────

const saveIndicator = new SaveIndicator();
const contentManager = new ContentManager((type, msg) => saveIndicator.show(type, msg));
const renderer = new Renderer();
const editMode = new EditMode(contentManager, renderer, saveIndicator);
const editors = new Editors(contentManager, renderer, editMode);

// ── boot ────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  saveIndicator.init();

  const content = contentManager.getContent();
  renderer.renderAll(content);
  editMode.init();
  editMode.activate();
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
