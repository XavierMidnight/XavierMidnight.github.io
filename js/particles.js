/**
 * Canvas-based particle system for the hero background.
 * Floating dots with subtle connecting lines. Adapts colors
 * to dark/light mode and particle count to canvas size.
 */
export class ParticleSystem {
  #canvas = null;
  #ctx = null;
  #particles = [];
  #animId = null;
  #maxDist = 120;

  init() {
    this.#canvas = document.getElementById('hero-particles');
    if (!this.#canvas) return;
    this.#ctx = this.#canvas.getContext('2d');
    this.#resize();
    this.#createParticles();
    this.#animate();
    window.addEventListener('resize', () => {
      this.#resize();
      this.#createParticles();
    });
  }

  #resize() {
    const hero = document.getElementById('hero');
    if (!hero || !this.#canvas) return;
    this.#canvas.width = hero.offsetWidth;
    this.#canvas.height = hero.offsetHeight;
  }

  #createParticles() {
    const area = this.#canvas.width * this.#canvas.height;
    const count = Math.min(Math.floor(area / 16000), 55);
    this.#particles = [];
    for (let i = 0; i < count; i++) {
      this.#particles.push({
        x: Math.random() * this.#canvas.width,
        y: Math.random() * this.#canvas.height,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        r: Math.random() * 1.5 + 0.5,
      });
    }
  }

  #animate = () => {
    const w = this.#canvas.width;
    const h = this.#canvas.height;
    this.#ctx.clearRect(0, 0, w, h);

    const isDark = document.body.classList.contains('dark');
    const rgb = isDark ? '255,218,26' : '0,88,163';
    const dotAlpha = isDark ? 0.2 : 0.12;
    const lineAlphaMax = isDark ? 0.1 : 0.06;

    for (const p of this.#particles) {
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < 0 || p.x > w) p.vx *= -1;
      if (p.y < 0 || p.y > h) p.vy *= -1;

      this.#ctx.beginPath();
      this.#ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      this.#ctx.fillStyle = `rgba(${rgb},${dotAlpha})`;
      this.#ctx.fill();
    }

    for (let i = 0; i < this.#particles.length; i++) {
      for (let j = i + 1; j < this.#particles.length; j++) {
        const a = this.#particles[i];
        const b = this.#particles[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < this.#maxDist) {
          const alpha = (1 - dist / this.#maxDist) * lineAlphaMax;
          this.#ctx.beginPath();
          this.#ctx.moveTo(a.x, a.y);
          this.#ctx.lineTo(b.x, b.y);
          this.#ctx.strokeStyle = `rgba(${rgb},${alpha})`;
          this.#ctx.lineWidth = 0.5;
          this.#ctx.stroke();
        }
      }
    }

    this.#animId = requestAnimationFrame(this.#animate);
  };

  destroy() {
    if (this.#animId) cancelAnimationFrame(this.#animId);
  }
}
