/**
 * Portfolio static page: dark mode + nav scroll + mobile menu
 * (mirrors index behavior from renderer.js + app.js)
 */
import { DarkMode } from './dark-mode.js';

const darkMode = new DarkMode();
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
