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
import { Variants } from './variants.js';
import { Shuffler } from './shuffler.js';
import { applyGenome, DEFAULT_GENOME } from './style-genome.js';

// ── create instances ────────────────────────────────────

const saveIndicator = new SaveIndicator();
const contentManager = new ContentManager((type, msg) => saveIndicator.show(type, msg));
const renderer = new Renderer();
const dragPosition = new DragPosition(contentManager, saveIndicator);
const editMode = new EditMode(contentManager, renderer, saveIndicator, dragPosition);
const editors = new Editors(contentManager, renderer, editMode, dragPosition);
const effects = new Effects();
const particles = new ParticleSystem();
const variants = new Variants();
// Generated palettes bake dark-vs-light into inline :root styles, so flipping
// body.dark has no visible effect until the active genome is re-derived
// against the new mode.
const darkMode = new DarkMode(() => {
  applyGenome(variants.genome ?? DEFAULT_GENOME);
});

// ── boot ────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  saveIndicator.init();
  darkMode.init();

  // No ?style= param still needs a genome applied — otherwise the site runs
  // on main.css's static :root fallback, which ignores body.dark entirely.
  const styleGenome = variants.applyStyle();
  if (!styleGenome) applyGenome(DEFAULT_GENOME);
  const variantContent = await variants.resolve();
  renderer.renderAll(variantContent ?? contentManager.getContent());
  // After renderAll: the renderers replace each section's innerHTML, and
  // reordering the shells has to happen against the populated DOM. Moving a
  // section invalidates the IntersectionObserver set up during render — the
  // entries it already delivered were for the old positions — so reveal
  // animations have to be re-armed or the moved sections never become visible.
  if (variants.applyLayoutGenome(styleGenome?.seed ?? null)) {
    renderer.setupScrollAnimations();
  }
  variants.applyDecorGenome(styleGenome?.seed ?? null);

  // The generated canvas draws to the same element as the stock particles, so
  // only one may own it — two requestAnimationFrame loops on one context
  // fight over clearRect and neither renders correctly.
  if (!variants.applyCanvasGenome(styleGenome?.seed ?? null)) {
    particles.init();
  }
  effects.initParallax();
  effects.initCounters();
  effects.typeSubtitle();

  // Editing writes to the same localStorage key the owner's real content lives
  // in, so a variant must not be editable — saving one would overwrite the
  // real site with a throwaway.
  if (!variants.active) editMode.init();

  // The generative layers only ran for visitors who knew to type ?style=random,
  // which is nobody. Unless a specific seed was asked for, cycle designs with a
  // visible timer so the page demonstrates itself.
  const pinned = ['style', 'layout', 'decor', 'canvas'].some(k => new URLSearchParams(location.search).has(k));
  if (!pinned && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
    new Shuffler(variants, () => renderer.setupScrollAnimations()).start();
  }
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
