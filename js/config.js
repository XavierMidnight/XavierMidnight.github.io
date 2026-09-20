/**
 * Default site content. Every editable field on the portfolio
 * is driven from this object. localStorage overrides are merged
 * on top at runtime.
 */
export const DEFAULT_CONTENT = {
  meta: { siteTitle: 'Jeffrey James Wood — Software Engineer' },

  layout: {},

  nav: {
    logo: 'JJW',
    links: [
      { text: 'About', href: '#about' },
      { text: 'Portfolio', href: 'portfolio.html' },
      { text: 'Timeline', href: 'timeline.html' },
      { text: 'Contact', href: '#contact' },
      { text: 'GitHub', href: 'https://github.com/XavierMidnight', external: true },
    ],
  },

  hero: {
    tag: 'Senior Software Engineer',
    nameLine1: 'Jeffrey',
    nameLine2: 'James Wood',
    subtitle:
      'Twenty years building software, four of them leading the teams that build it. Right now: real-time AI systems that run on my own hardware.',
    ctaPrimary: { text: 'See the Work', href: 'portfolio.html' },
    ctaPortfolio: { text: 'What I Build', href: '#about' },
    ctaSecondary: { text: 'Get in Touch', href: '#contact' },
  },

  about: {
    label: 'About',
    title: 'I build systems that run in the real world.',
    paragraphs: [
      'Twenty years of shipping software — healthcare, federal contracting, cloud migrations, accessibility-compliant applications with real consequences. At Employers Health Network I shipped an external-facing health-plan platform that onboarded 200+ clients in its first month. At MUSC I built patient-tracking software that flagged medication misuse.',
      'Four of those years as Technical Team Lead at Amyx and Credence — establishing an agile engineering team from scratch, hiring into it, and setting practices that held across multiple teams. Earlier: Booz Allen, Red Ventures, SPARC, Blackbaud. Started with apprenticeships at IBM and NASA Langley.',
      'This year I have been building local AI infrastructure and the hardware around it. A voice pipeline that streams sentence-by-sentence so playback starts before the model finishes thinking, serving four custom ESP32 devices over a hand-rolled binary protocol. An autonomous agent that works my own Jira board — branches, commits, reviews, and reports back. A GPU scheduler that arbitrates between them.',
      'The page you are looking at designs itself. Palette, typography, layout, and the shapes behind this text are generated from a seed in the URL — refresh and you get a different one.',
    ],
    skills: [
      'JavaScript / TypeScript',
      'Python / FastAPI',
      'Node / Express',
      'React / Next.js',
      'C# / .NET',
      'Java / Spring',
      'C++ / ESP32 firmware',
      'AWS / Azure',
      'Docker',
      'WebSockets / real-time',
      'Local LLM + TTS pipelines',
      'Team leadership',
    ],
    stats: [
      { id: 'stat_1', number: '20', label: 'Years shipping software' },
      { id: 'stat_2', number: '4', label: 'Years leading teams' },
      { id: 'stat_3', number: '200+', label: 'Clients onboarded in month one' },
    ],
  },

  timeline: {
    label: 'Journey',
    title: 'Twenty years, one thread.',
    entries: [
      { year: '2006', title: 'HVAC Computer Programmer', org: 'Roth Bros.', description: 'Controls programming on Andover Continuum boards — plain-English logic monitoring Building Energy Management Systems.' },
      { year: '2006–07', title: 'Solutions Developer', org: 'Blackbaud', description: 'Database scripting and plug-ins for non-profit clients; first real software job.' },
      { year: '2007–13', title: 'Systems Engineer II', org: 'MUSC', description: 'Patient-tracking software that flagged medication misuse; hospital data integration with the National Health Information Network.' },
      { year: '2013–16', title: 'Senior Engineer', org: 'SPARC, LLC', description: 'Native iOS apps and the first AngularJS pages, built in an agile, multi-team environment.' },
      { year: '2016–19', title: 'Lead Engineer Associate', org: 'Booz Allen Hamilton', description: 'Large-scale, 508-compliant enterprise systems; mentored junior engineers on federal contracts.' },
      { year: '2019', title: 'Senior Software Engineer', org: 'Employers Health Network', description: 'First external-facing health-plan platform, built solo from day one — 200+ clients onboarded in month one.' },
      { year: '2020', title: 'Senior Software Engineer', org: 'Red Ventures', description: 'Migrated a legacy phone sales system into AWS — Lambda, ECS, and a new build pipeline.' },
      { year: '2021–22', title: 'Senior UI/UX Software Engineer', org: 'Credence', description: 'Reusable UI architecture across cross-pollinated projects; consistent AWS data flow between teams.' },
      { year: '2022–24', title: 'Technical Team Lead', org: 'Amyx, Inc.', description: 'Built an agile engineering team from scratch — hiring, practices, and pipeline work that held across teams.' },
      { year: '2025–now', title: 'Independent', org: 'Local AI + hardware', description: 'A voice pipeline streaming to custom ESP32 devices, an autonomous agent working my own Jira board, and a GPU scheduler tying it together.' },
    ],
  },

  contact: {
    label: 'Contact',
    title: 'Open to what is next.',
    description:
      'I am looking for my next role — ideally somewhere that builds real-time systems, AI infrastructure, or hardware that talks to software. Happy to walk through any of this in detail.',
    links: [
      { text: 'Email', href: 'mailto:jeffreyjameswood@gmail.com', style: 'primary', external: true },
      { text: 'LinkedIn', href: 'https://www.linkedin.com/in/j-j-wood-26a66b5/', external: true },
      { text: 'GitHub', href: 'https://github.com/XavierMidnight', external: true },
    ],
  },

  footer: { text: '© 2026 Jeffrey James Wood' },
};
