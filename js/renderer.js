import { esc } from './utils.js';

/**
 * Builds all DOM sections from a content object.
 * Every editable text node is annotated with data-* attributes
 * so the edit-mode module can make them contenteditable and
 * sync changes back.
 */
export class Renderer {
  // ── public ────────────────────────────────────────────

  renderAll(content) {
    document.title = content.meta.siteTitle;
    this.renderNav(content.nav);
    this.renderHero(content.hero);
    this.renderAbout(content.about);
    this.renderContact(content.contact);
    this.renderFooter(content.footer);
    this.setupScrollAnimations();
    this.#setupNavScroll();
    this.#setupSmoothScroll();
  }

  // ── section renderers ─────────────────────────────────

  renderNav(nav) {
    const inner = document.querySelector('.nav-inner');
    const extAttrs = (l) =>
      l.external ? ' target="_blank" rel="noopener noreferrer"' : '';

    inner.innerHTML = `
      <a href="#" class="nav-logo" data-path="nav.logo">${esc(nav.logo)}</a>
      <button class="nav-toggle" aria-label="Menu">
        <span></span><span></span><span></span>
      </button>
      <div class="nav-links">
        ${nav.links
          .map(
            (l, i) =>
              `<a href="${esc(l.href)}" data-nav-index="${i}"${extAttrs(l)}>${esc(l.text)}</a>`,
          )
          .join('')}
      </div>`;

    // mobile hamburger
    inner
      .querySelector('.nav-toggle')
      .addEventListener('click', () =>
        document.getElementById('nav').classList.toggle('open'),
      );
    // close menu on link tap
    inner.querySelectorAll('.nav-links a').forEach((a) =>
      a.addEventListener('click', () =>
        document.getElementById('nav').classList.remove('open'),
      ),
    );
  }

  renderHero(hero) {
    document.getElementById('hero').innerHTML = `
      <div class="hero-shapes">
        <div class="hero-shape hero-shape-circle"></div>
        <div class="hero-shape hero-shape-rect"></div>
        <div class="hero-shape hero-shape-line"></div>
        <div class="hero-shape hero-shape-dot"></div>
      </div>
      <div class="container hero-inner">
        <span class="hero-tag anim" data-path="hero.tag">${esc(hero.tag)}</span>
        <h1 class="hero-name anim anim-delay-1">
          <span data-path="hero.nameLine1">${esc(hero.nameLine1)}</span>
          <span data-path="hero.nameLine2">${esc(hero.nameLine2)}</span>
        </h1>
        <p class="hero-subtitle anim anim-delay-2" data-path="hero.subtitle">
          ${esc(hero.subtitle)}
        </p>
        <div class="hero-ctas anim anim-delay-3">
          <a href="${esc(hero.ctaPrimary.href)}" class="btn btn-primary">
            <span data-path="hero.ctaPrimary.text">${esc(hero.ctaPrimary.text)}</span>
          </a>
          <a href="${esc(hero.ctaSecondary.href)}" class="btn btn-outline">
            <span data-path="hero.ctaSecondary.text">${esc(hero.ctaSecondary.text)}</span>
          </a>
        </div>
      </div>`;
  }

  renderAbout(about) {
    const paragraphs = about.paragraphs
      .map(
        (p, i) => `
      <div class="paragraph-wrap">
        <p class="anim anim-delay-${i + 1}" data-path="about.paragraphs" data-index="${i}" data-multiline>
          ${esc(p)}
        </p>
        <button class="edit-only card-delete para-delete"
                data-action="remove-paragraph" data-index="${i}"
                title="Remove paragraph">&times;</button>
      </div>`,
      )
      .join('');

    const skills = about.skills
      .map(
        (s, i) => `
      <span class="skill-chip" data-skill-index="${i}">
        ${esc(s)}<span class="edit-only chip-delete" data-action="remove-skill" data-index="${i}">&times;</span>
      </span>`,
      )
      .join('');

    const stats = about.stats
      .map(
        (s, i) => `
      <div class="stat-card anim anim-delay-${i + 1}" data-stat-card="${s.id}">
        <button class="edit-only card-delete" data-action="remove-stat" data-id="${s.id}">&times;</button>
        <div class="stat-number" data-stat-id="${s.id}" data-field="number">${esc(s.number)}</div>
        <div class="stat-label"  data-stat-id="${s.id}" data-field="label">${esc(s.label)}</div>
      </div>`,
      )
      .join('');

    document.getElementById('about').innerHTML = `
      <div class="container">
        <div class="section-label anim" data-path="about.label">${esc(about.label)}</div>
        <h2 class="anim anim-delay-1" data-path="about.title">${esc(about.title)}</h2>
        <div class="about-grid">
          <div class="about-bio">
            ${paragraphs}
            <button class="edit-only add-btn" data-action="add-paragraph">+ Paragraph</button>
          </div>
          <div class="skills-wrap anim anim-delay-2">
            <h3>Skills &amp; tools</h3>
            <div class="skills-grid" id="skills-grid">
              ${skills}
              <button class="edit-only add-btn" data-action="add-skill">+ Skill</button>
            </div>
          </div>
        </div>
        <div class="stats-row" id="stats-row">${stats}</div>
        <button class="edit-only add-btn" data-action="add-stat" style="margin-top:.75rem">+ Stat</button>
      </div>`;
  }

  renderContact(contact) {
    const links = contact.links
      .map((l) => {
        const cls =
          l.style === 'primary' ? 'btn btn-primary' : 'btn btn-outline';
        const ext = l.external
          ? ' target="_blank" rel="noopener noreferrer"'
          : '';
        return `<a href="${esc(l.href)}" class="${cls}"${ext}>${esc(l.text)}</a>`;
      })
      .join('');

    document.getElementById('contact').innerHTML = `
      <div class="container">
        <div class="section-label anim" data-path="contact.label">${esc(contact.label)}</div>
        <h2 class="anim anim-delay-1" data-path="contact.title">${esc(contact.title)}</h2>
        <p class="contact-desc anim anim-delay-2" data-path="contact.description">
          ${esc(contact.description)}
        </p>
        <div class="contact-links anim anim-delay-3">${links}</div>
      </div>`;
  }

  renderFooter(footer) {
    document.getElementById('footer').innerHTML = `
      <div class="container">
        <span data-path="footer.text">${esc(footer.text)}</span>
      </div>`;
  }

  // ── scroll / nav helpers ──────────────────────────────

  setupScrollAnimations() {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add('visible');
            observer.unobserve(e.target);
          }
        }
      },
      { threshold: 0.08, rootMargin: '0px 0px -40px 0px' },
    );
    document.querySelectorAll('.anim').forEach((el) => observer.observe(el));
  }

  #setupNavScroll() {
    const nav = document.getElementById('nav');
    const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 60);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  #setupSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach((a) => {
      a.addEventListener('click', (e) => {
        const target = document.querySelector(a.getAttribute('href'));
        if (target) {
          e.preventDefault();
          target.scrollIntoView({ behavior: 'smooth' });
        }
      });
    });
  }
}
