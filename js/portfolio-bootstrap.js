/**
 * Portfolio static page: dark mode + nav scroll + mobile menu
 * (mirrors index behavior from renderer.js + app.js)
 */
import { DarkMode } from './dark-mode.js';
import { applyGenome, DEFAULT_GENOME } from './style-genome.js';

// Dark-mode colors come from re-deriving the default genome with `dark`
// flipped, same mechanism as the main page — main.css no longer hardcodes them.
applyGenome(DEFAULT_GENOME);
const darkMode = new DarkMode(() => applyGenome(DEFAULT_GENOME));
darkMode.init();

const nav = document.getElementById('nav');
if (nav) {
  const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 60);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

document.querySelector('.nav-toggle')?.addEventListener('click', () => {
  nav?.classList.toggle('open');
});
document.querySelectorAll('.nav-links a').forEach((a) => {
  a.addEventListener('click', () => nav?.classList.remove('open'));
});
