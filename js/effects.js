/**
 * Visual effects: parallax hero shapes, typing animation, stat counters.
 */
export class Effects {
  #typed = false;

  // ── parallax hero shapes ─────────────────────────────

  initParallax() {
    const hero = document.getElementById('hero');
    if (!hero) return;

    const shapes = hero.querySelectorAll('.hero-shape');
    if (!shapes.length) return;

    let targetX = 0, targetY = 0;
    let currentX = 0, currentY = 0;

    const strengths = {
      'hero-shape-circle': 30,
      'hero-shape-rect': 20,
      'hero-shape-line': 12,
      'hero-shape-dot': 25,
    };

    hero.addEventListener('mousemove', (e) => {
      const rect = hero.getBoundingClientRect();
      targetX = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
      targetY = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
    });

    hero.addEventListener('mouseleave', () => {
      targetX = 0;
      targetY = 0;
    });

    const animate = () => {
      currentX += (targetX - currentX) * 0.06;
      currentY += (targetY - currentY) * 0.06;

      shapes.forEach((shape) => {
        const cls = [...shape.classList].find((c) => strengths[c]);
        const strength = (cls && strengths[cls]) || 15;
        shape.style.setProperty('--parallax-x', `${currentX * strength}px`);
        shape.style.setProperty('--parallax-y', `${currentY * strength}px`);
      });

      requestAnimationFrame(animate);
    };

    requestAnimationFrame(animate);
  }

  // ── typing animation ─────────────────────────────────

  typeSubtitle() {
    if (this.#typed) return;
    this.#typed = true;

    const el = document.querySelector('.hero-subtitle');
    if (!el) return;

    const text = el.textContent.trim();
    el.textContent = '';
    el.classList.add('typing');

    let i = 0;
    const speed = 28;

    const type = () => {
      if (i < text.length) {
        el.textContent += text[i];
        i++;
        setTimeout(type, speed);
      } else {
        setTimeout(() => el.classList.remove('typing'), 1500);
      }
    };

    // delay until after scroll-in animation
    setTimeout(type, 900);
  }

  // ── animated stat counters ───────────────────────────

  initCounters() {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            this.#animateCounter(entry.target);
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.5 },
    );
    document.querySelectorAll('.stat-number').forEach((el) => observer.observe(el));
  }

  #animateCounter(el) {
    const text = el.textContent.trim();
    const match = text.match(/^(\d+)(.*)$/);
    if (!match) return;

    const target = parseInt(match[1]);
    const suffix = match[2] || '';
    const duration = 1400;
    const start = performance.now();
    const easeOut = (t) => 1 - Math.pow(1 - t, 3);

    const step = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      const current = Math.round(easeOut(progress) * target);
      el.textContent = current + suffix;
      if (progress < 1) requestAnimationFrame(step);
    };

    el.textContent = '0' + suffix;
    requestAnimationFrame(step);
  }
}
