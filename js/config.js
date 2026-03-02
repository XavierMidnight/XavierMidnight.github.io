/**
 * Default site content. Every editable field on the portfolio
 * is driven from this object. localStorage overrides are merged
 * on top at runtime.
 */
export const DEFAULT_CONTENT = {
  meta: { siteTitle: 'Jeffrey James Wood \u2014 Developer' },

  nav: {
    logo: 'JJW',
    links: [
      { text: 'About', href: '#about' },
      { text: 'Contact', href: '#contact' },
      { text: 'GitHub', href: 'https://github.com/XavierMidnight', external: true },
    ],
  },

  hero: {
    tag: 'Senior Software Developer',
    nameLine1: 'Jeffrey',
    nameLine2: 'James Wood',
    subtitle:
      'Building interactive experiences, browser-based tools, and hardware integrations from scratch.',
    ctaPrimary: { text: 'About Me', href: '#about' },
    ctaSecondary: { text: 'Get in Touch', href: '#contact' },
  },

  about: {
    label: 'About',
    title: 'Curious by nature, creative by choice',
    paragraphs: [
      "I\u2019m a self-driven developer who builds things that live in browsers and beyond \u2014 gamified fitness apps, real-time audio visualizers, Twitch-powered LED controllers, and production business websites.",
      "When I\u2019m not writing code, I\u2019m exploring new web APIs, tinkering with hardware, or helping local businesses build a stronger online presence.",
    ],
    skills: [
      'HTML / CSS',
      'JavaScript (ES6+)',
      'Web Audio API',
      'Canvas / Animation',
      'Twitch API / Bots',
      'Responsive Design',
      'Git / GitHub Pages',
      'Hardware Integration',
    ],
    stats: [
      { id: 'stat_1', number: '4+', label: 'Projects shipped' },
      { id: 'stat_2', number: '3', label: 'Web APIs explored' },
      { id: 'stat_3', number: '1', label: 'Business site deployed' },
    ],
  },

  contact: {
    label: 'Contact',
    title: "Let\u2019s work together",
    description:
      "Have a project in mind, need a website built, or just want to talk about something you\u2019re building? Reach out.",
    links: [
      { text: 'GitHub', href: 'https://github.com/XavierMidnight', style: 'primary', external: true },
    ],
  },

  footer: { text: '\u00a9 2026 Jeffrey James Wood' },
};
