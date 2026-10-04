'use strict';

// ---------- data, taken from the jira-webhook pipeline ----------

const LANES = [
  { id: 'triage', name: 'Triage', need: 1, speedBase: 8 },
  { id: 'coding', name: 'Coding', need: 5, speedBase: 5 },
  { id: 'tests', name: 'Tests', need: 2, speedBase: 10 },
  { id: 'review', name: 'Review', need: 2.5, speedBase: 12 },
  { id: 'merge', name: 'Merge', need: 1, speedBase: 15 },
];

const HOLD_RULES = {
  coding: ['stalled', 'zombie', 'crash', 'runner-error', 'orphaned-job'],
  tests: ['failed tests'],
  review: ['review BLOCKING', 'review never finished'],
  merge: ['merge conflict'],
};

const MODES = [
  { name: 'Debug', speed: 0.5, hold: 0, cost: 0, note: 'One job per lane at half speed. Nothing is ever held.' },
  { name: 'Human pace', speed: 1, hold: 0.05, cost: 15, note: 'Full speed, every slot in use. About 5% of tickets are held for you.' },
  { name: 'Burst', speed: 2, hold: 0.10, cost: 5000, note: 'Double speed, about 10% held. Five open holds step the dial down for 30 s.' },
  { name: 'Full AI', speed: 4, hold: 0.16, cost: 1e6, note: 'Four times speed, about 16% held, and the supervisor tick runs twice as often.' },
];

const SOURCES = [
  { id: 'discord', name: 'Discord /chat', rate: 0.2, base: 10, desc: 'Files a ticket every 5 s per level' },
  { id: 'think', name: 'Brain dump split', rate: 0.6, base: 900, desc: 'Files 0.6 tickets a second per level' },
  { id: 'monitor', name: 'Pipeline monitor', rate: 5, base: 60000, desc: 'Files 5 tickets a second per level' },
];

// name and mechanism are from epic-map.json
const REPOS = [
  { name: 'jira-webhook', mech: 'live-worktree', mult: 1 },
  { name: 'voicechat', mech: 'docker', mult: 2 },
  { name: 'central-hub', mech: 'latest-only', mult: 1.5 },
  { name: 'computer', mech: 'latest-only', mult: 1.5 },
  { name: 'robosen', mech: 'latest-only', mult: 1.5 },
  { name: 'futures', mech: 'latest-only', mult: 1.5 },
  { name: 'shader-gen', mech: 'latest-only', mult: 1.5 },
  { name: 'videowall', mech: 'latest-only', mult: 1.5 },
  { name: 'audio-story-maker', mech: 'latest-only', mult: 1.5 },
  { name: 'nextjs-chat', mech: 'latest-only', mult: 1.5 },
  { name: 'claudesurvivor', mech: 'latest-only', mult: 1.5 },
  { name: 'chaotic-storytime', mech: 'latest-only', mult: 1.5 },
  { name: 'goai', mech: 'latest-only', mult: 1.5 },
  { name: 'webui-forge', mech: 'latest-only', mult: 1.5 },
  { name: 'xaviermidnight-website', mech: 'latest-only', mult: 1.5 },
  { name: 'companion-dashboard', mech: 'latest-only', mult: 1.5 },
];

const FEATS = [
  { id: 'ready', name: 'Readiness check', kan: 'KAN-485', cost: 60, lane: 'triage', desc: 'Triage runs twice as fast' },
  { id: 'budget', name: 'Soft budgets', kan: 'KAN-708', cost: 150, lane: 'coding', desc: 'Coding runs twice as fast' },
  { id: 'stall', name: 'Stall detection', kan: 'KAN-708', cost: 600, hold: 0.75, desc: 'A quarter fewer holds' },
  { id: 'throwaway', name: 'Throwaway test server', kan: 'KAN-631', cost: 1200, lane: 'tests', desc: 'Tests run twice as fast' },
  { id: 'verdicts', name: 'Structured verdicts', kan: 'KAN-991', cost: 2500, lane: 'review', desc: 'Review runs twice as fast' },
  { id: 'skill', name: 'Pipeline skill', kan: 'KAN-986', cost: 4000, nudge: 3, desc: 'Each nudge does three times the work' },
  { id: 'landed', name: 'Merge-landed check', kan: 'KAN-898', cost: 5000, lane: 'merge', desc: 'Merge runs twice as fast' },
  { id: 'watchdog', name: 'Watchdog', kan: 'KAN-513', cost: 8000, offline: 0.75, desc: 'Earn 75% of your rate while away, up from 25%' },
  { id: 'checkpoint', name: 'Stage checkpoints', kan: 'KAN-543', cost: 15000, hold: 0.75, desc: 'A quarter fewer holds' },
  { id: 'notify', name: 'Notification router', kan: 'KAN-585', cost: 25000, approve: 5, desc: 'Landing a held ticket yourself pays 5x, up from 2x' },
  { id: 'codemap', name: 'Code map', kan: 'KAN-800', cost: 40000, lane: 'coding', desc: 'Coding runs twice as fast' },
  { id: 'editcheck', name: 'Edit check hook', kan: 'KAN-769', cost: 80000, lane: 'tests', desc: 'Tests run twice as fast' },
  { id: 'effort', name: 'Adaptive effort', kan: 'KAN-834', cost: 250000, value: 2, desc: 'Every ticket pays double' },
  { id: 'limits', name: 'Limits registry', kan: 'KAN-711', cost: 600000, hold: 0.75, desc: 'A quarter fewer holds' },
  { id: 'sim', name: 'Simulator', kan: 'KAN-588', cost: 2e6, value: 2, desc: 'Every ticket pays double' },
  { id: 'mcp', name: 'Pipeline MCP server', kan: 'KAN-987', cost: 8e6, value: 2, desc: 'Every ticket pays double' },
  { id: 'accheck', name: 'Acceptance check', kan: 'KAN-647', cost: 3e7, lane: 'review', desc: 'Review runs twice as fast' },
];

const SAVE_KEY = 'pipelinegame-v1';
const MAX_SLOTS = 8;
const MAX_BACKLOG_LVL = 9;
const HOLD_CAP = 8;
const SPIKE_HOLDS = 5;
const SPIKE_MS = 30000;
const TAG_BONUS = 0.25;
const STABLE_AT = 1e6;

// ---------- state ----------

function fresh() {
  const lanes = {};
  for (const L of LANES) lanes[L.id] = { speed: 0, slots: 1, q: [], a: [] };
  const src = {}, acc = {};
  for (const s of SOURCES) { src[s.id] = 0; acc[s.id] = 0; }
  return {
    commits: 0, life: 0, run: 0, merged: 0, nextKey: 1000, tags: 0,
    mode: 0, modesOwned: 1, stepDownUntil: 0,
    lanes, backlog: 0, bundle: 0, src, acc, feats: {}, repos: 1,
    sup: 0, supAcc: 0, holds: [], last: Date.now(), rate: 0,
  };
}

let S = fresh();
let D = {};
let dirty = true;
const logLines = [];
let logDirty = true;
let secAcc = 0, secT = 0, lastMergeLog = 0;

function derive() {
  D = { lane: {}, hold: 1, value: 1 + TAG_BONUS * S.tags, nudge: 1, approve: 2, offline: 0.25 };
  for (const L of LANES) D.lane[L.id] = 1;
  for (const f of FEATS) {
    if (!S.feats[f.id]) continue;
    if (f.lane) D.lane[f.lane] *= 2;
    if (f.hold) D.hold *= f.hold;
    if (f.value) D.value *= f.value;
    if (f.nudge) D.nudge *= f.nudge;
    if (f.approve) D.approve = f.approve;
    if (f.offline) D.offline = f.offline;
  }
  for (let i = 0; i < S.repos; i++) D.value *= REPOS[i].mult;
}

function effMode(now) {
  return now < S.stepDownUntil ? Math.min(S.mode, 1) : S.mode;
}
function laneRate(L, m) {
  return Math.pow(1.35, S.lanes[L.id].speed) * D.lane[L.id] * MODES[m].speed;
}
function queueCap(i) {
  return i === 0 ? 5 + 5 * S.backlog : 3 + S.lanes[LANES[i].id].slots;
}
function ticketValue() {
  return Math.pow(2, S.bundle) * D.value;
}
function stableGain() {
  return Math.floor(Math.cbrt(S.run / STABLE_AT));
}
function supInterval(m) {
  return 12 / Math.pow(1.3, S.sup - 1) / (m === 3 ? 2 : 1);
}

const cost = {
  speed: L => L.speedBase * Math.pow(1.5, S.lanes[L.id].speed),
  slot: L => S.lanes[L.id].slots >= MAX_SLOTS ? null : 40 * Math.pow(6, S.lanes[L.id].slots - 1),
  backlog: () => S.backlog >= MAX_BACKLOG_LVL ? null : 40 * Math.pow(3, S.backlog),
  source: s => s.base * Math.pow(1.45, S.src[s.id]),
  bundle: () => 120 * Math.pow(7, S.bundle),
  sup: () => 300 * Math.pow(2.2, S.sup),
  repo: () => S.repos >= REPOS.length ? null : 50 * Math.pow(5, S.repos - 1),
};

// ---------- simulation ----------

function log(msg, cls) {
  logLines.push({ msg, cls: cls || '' });
  if (logLines.length > 11) logLines.shift();
  logDirty = true;
}

function earn(v) {
  S.commits += v; S.life += v; S.run += v; secAcc += v;
}

function fileTicket() {
  const q = S.lanes.triage.q;
  if (q.length >= queueCap(0)) return false;
  q.push({ k: S.nextKey++, r: Math.floor(Math.random() * S.repos), p: 0 });
  return true;
}

function payOut(t, mult, how, now) {
  earn(ticketValue() * mult);
  S.merged += Math.pow(2, S.bundle);
  if (how !== 'merged' || now - lastMergeLog > 900) {
    if (how === 'merged') lastMergeLog = now;
    log(`KAN-${t.k} ${how} -> ${REPOS[t.r].name}`, 'l-good');
  }
}

function hold(t, L, now) {
  const rules = HOLD_RULES[L.id];
  const rule = rules[Math.floor(Math.random() * rules.length)];
  if (S.holds.length >= HOLD_CAP) {
    log(`KAN-${t.k} discarded: Needs You is full (${rule})`, 'l-hold');
    return;
  }
  S.holds.push({ k: t.k, r: t.r, rule, lane: L.name });
  dirty = true;
  log(`KAN-${t.k} held in ${L.name}: ${rule}`, 'l-hold');
  if (S.holds.length >= SPIKE_HOLDS && S.mode >= 2 && now >= S.stepDownUntil) {
    S.stepDownUntil = now + SPIKE_MS;
    log('hold-spike: dial stepped down to Human pace', 'l-info');
  }
}

function landHold(i, mult, how, now) {
  const h = S.holds.splice(i, 1)[0];
  if (!h) return;
  dirty = true;
  payOut({ k: h.k, r: h.r }, mult, how, now);
}

function step(dt, now) {
  for (const s of SOURCES) {
    const lvl = S.src[s.id];
    if (!lvl) continue;
    S.acc[s.id] += lvl * s.rate * dt;
    while (S.acc[s.id] >= 1) {
      if (!fileTicket()) { S.acc[s.id] = 1; break; }
      S.acc[s.id] -= 1;
    }
  }

  const m = effMode(now);
  const holdChance = MODES[m].hold * D.hold / 4;
  for (let i = LANES.length - 1; i >= 0; i--) {
    const L = LANES[i], st = S.lanes[L.id];
    const rate = laneRate(L, m);
    const slots = m === 0 ? 1 : st.slots;
    for (let j = st.a.length - 1; j >= 0; j--) {
      const t = st.a[j];
      if (t.p < L.need) {
        t.p += rate * dt;
        if (t.p >= L.need) {
          t.p = L.need;
          if (HOLD_RULES[L.id] && Math.random() < holdChance) {
            st.a.splice(j, 1);
            hold(t, L, now);
            continue;
          }
        }
      }
      if (t.p >= L.need) {
        if (i === LANES.length - 1) {
          st.a.splice(j, 1);
          payOut(t, 1, 'merged', now);
        } else {
          const nx = S.lanes[LANES[i + 1].id];
          if (nx.q.length < queueCap(i + 1)) {
            st.a.splice(j, 1);
            t.p = 0;
            nx.q.push(t);
          }
        }
      }
    }
    while (st.a.length < slots && st.q.length) st.a.push(st.q.shift());
  }

  if (S.sup > 0 && S.holds.length) {
    S.supAcc += dt;
    const every = supInterval(m);
    if (S.supAcc >= every) {
      S.supAcc = 0;
      landHold(0, 1, 'landed by supervisor-tick', now);
    }
  }

  secT += dt;
  if (secT >= 1) {
    S.rate = S.rate * 0.7 + (secAcc / secT) * 0.3;
    secAcc = 0; secT = 0;
  }
}

function nudge() {
  const m = effMode(Date.now());
  for (const L of LANES) {
    const work = Math.max(0.5, laneRate(L, m) * 0.5) * D.nudge;
    for (const t of S.lanes[L.id].a) {
      if (t.p < L.need) t.p = Math.min(L.need, t.p + work);
    }
  }
}

function cutStable() {
  const gain = stableGain();
  if (gain < 1) return;
  const keep = { tags: S.tags + gain, life: S.life, nextKey: S.nextKey, merged: S.merged };
  S = Object.assign(fresh(), keep);
  derive();
  dirty = true;
  log(`stable build cut: ${keep.tags} tag${keep.tags === 1 ? '' : 's'}, pipeline reset`, 'l-info');
}

// ---------- save ----------

function save() {
  S.last = Date.now();
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { /* storage unavailable */ }
}

function load() {
  let raw = null;
  try { raw = localStorage.getItem(SAVE_KEY); } catch (e) { /* storage unavailable */ }
  if (!raw) return;
  let o;
  try { o = JSON.parse(raw); } catch (e) { return; }
  const f = fresh();
  S = Object.assign(f, o);
  for (const L of LANES) S.lanes[L.id] = Object.assign({ speed: 0, slots: 1, q: [], a: [] }, o.lanes && o.lanes[L.id]);
  for (const s of SOURCES) { S.src[s.id] = S.src[s.id] || 0; S.acc[s.id] = S.acc[s.id] || 0; }
  derive();
  const away = Math.min((Date.now() - S.last) / 1000, 8 * 3600);
  if (away > 30 && S.rate > 0) {
    const got = S.rate * away * D.offline;
    earn(got);
    secAcc = 0;
    log(`away ${fmtTime(away)}: +${fmt(got)} commits at ${Math.round(D.offline * 100)}% rate`, 'l-info');
  }
}

// ---------- formatting ----------

const SUFFIX = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi'];
function fmt(n) {
  if (n < 1000) return n < 10 && n % 1 ? n.toFixed(1) : String(Math.floor(n));
  const e = Math.floor(Math.log10(n) / 3);
  if (e >= SUFFIX.length) return n.toExponential(2).replace('+', '');
  const v = n / Math.pow(1000, e);
  return (v < 10 ? v.toFixed(2) : v < 100 ? v.toFixed(1) : Math.floor(v)) + SUFFIX[e];
}
function fmtTime(s) {
  if (s < 90) return Math.round(s) + ' s';
  if (s < 5400) return Math.round(s / 60) + ' min';
  return (s / 3600).toFixed(1) + ' h';
}

// ---------- UI ----------

const $ = id => document.getElementById(id);
const items = [];

function setText(el, s) {
  if (el.textContent !== s) el.textContent = s;
}

function addItem(parent, o) {
  const b = document.createElement('button');
  b.className = 'buy' + (o.cls ? ' ' + o.cls : '');
  b.innerHTML = '<span class="buy-t"></span><span class="buy-c"></span><span class="buy-d"></span>';
  parent.appendChild(b);
  b.addEventListener('click', () => {
    const c = o.cost();
    if (c == null || S.commits < c) return;
    S.commits -= c;
    o.buy();
    derive();
    dirty = true;
    render();
  });
  items.push({ o, b, t: b.children[0], c: b.children[1], d: b.children[2] });
}

function buildUI() {
  const board = $('board');

  const todo = document.createElement('div');
  todo.className = 'lane';
  todo.dataset.lane = 'todo';
  todo.innerHTML = '<div class="lane-head"><h2>To Do</h2><div class="lane-meta" id="meta-todo"></div></div>' +
    '<div class="lane-body" id="body-todo"></div><div class="lane-foot" id="foot-todo"></div>';
  board.appendChild(todo);
  addItem($('foot-todo'), {
    cls: 'act',
    title: () => 'File a ticket', cost: () => 0, desc: () => '',
    buy: () => { if (!fileTicket()) log('backlog is full', 'l-hold'); },
    costText: () => '',
  });
  addItem($('foot-todo'), {
    cls: 'act',
    title: () => 'Nudge the runners', cost: () => 0, desc: () => '',
    buy: nudge,
    costText: () => '',
  });
  addItem($('foot-todo'), {
    title: () => 'Bigger backlog', cost: cost.backlog, desc: () => '',
    buy: () => { S.backlog++; },
  });

  for (const L of LANES) {
    const el = document.createElement('div');
    el.className = 'lane';
    el.dataset.lane = L.id;
    el.innerHTML = `<div class="lane-head"><h2>${L.name}</h2><div class="lane-meta" id="meta-${L.id}"></div></div>` +
      `<div class="lane-body" id="body-${L.id}"></div><div class="lane-foot" id="foot-${L.id}"></div>`;
    board.appendChild(el);
    addItem($('foot-' + L.id), {
      title: () => 'Faster', cost: () => cost.speed(L), desc: () => '',
      buy: () => { S.lanes[L.id].speed++; },
    });
    addItem($('foot-' + L.id), {
      title: () => 'Add a slot', cost: () => cost.slot(L), desc: () => '',
      buy: () => { S.lanes[L.id].slots++; },
    });
  }

  for (const s of SOURCES) {
    addItem($('shopSources'), {
      title: () => `${s.name}, level ${S.src[s.id]}`, cost: () => cost.source(s), desc: () => s.desc,
      buy: () => { S.src[s.id]++; },
    });
  }

  addItem($('shopAuto'), {
    title: () => `Bundles, level ${S.bundle}`, cost: cost.bundle,
    desc: () => `Each card carries ${fmt(Math.pow(2, S.bundle + 1))} tickets instead of ${fmt(Math.pow(2, S.bundle))}`,
    buy: () => { S.bundle++; },
  });
  addItem($('shopAuto'), {
    title: () => `Supervisor tick, level ${S.sup}`, cost: cost.sup,
    desc: () => S.sup
      ? `Lands one held ticket every ${supInterval(effMode(Date.now())).toFixed(1)} s`
      : 'Lands one held ticket every 12 s without you',
    buy: () => { S.sup++; },
  });

  for (const f of FEATS) {
    addItem($('shopFeats'), {
      feat: f,
      title: () => f.name, cost: () => f.cost, desc: () => `${f.desc} (${f.kan})`,
      buy: () => { S.feats[f.id] = 1; log(`${f.kan}: ${f.name} merged`, 'l-info'); },
    });
  }

  addItem($('shopRepos'), {
    title: () => S.repos < REPOS.length ? `Connect ${REPOS[S.repos].name}` : 'Every repo is connected',
    cost: cost.repo,
    desc: () => S.repos < REPOS.length
      ? `${REPOS[S.repos].mech}. Tickets pay ${REPOS[S.repos].mult}x`
      : '',
    buy: () => { log(`epic-map.json: ${REPOS[S.repos].name} registered`, 'l-info'); S.repos++; },
  });

  const dial = $('dial');
  MODES.forEach((m, i) => {
    const b = document.createElement('button');
    b.innerHTML = `${m.name}<small></small>`;
    b.addEventListener('click', () => {
      if (i < S.modesOwned) {
        S.mode = i;
      } else if (i === S.modesOwned && S.commits >= m.cost) {
        S.commits -= m.cost;
        S.modesOwned++;
        S.mode = i;
        log(`dial unlocked: ${m.name}`, 'l-info');
      }
      S.stepDownUntil = 0;
      render();
    });
    dial.appendChild(b);
  });

  $('holds').addEventListener('click', e => {
    const b = e.target.closest('button[data-k]');
    if (!b) return;
    const i = S.holds.findIndex(h => String(h.k) === b.dataset.k);
    if (i >= 0) { landHold(i, D.approve, 'landed by human', Date.now()); render(); }
  });

  twoClick($('stableBtn'), 'Cut a stable build', 'Click again to reset the pipeline', cutStable);
  twoClick($('wipeBtn'), 'Wipe save', 'Click again to wipe everything', () => {
    S = fresh();
    logLines.length = 0;
    derive();
    dirty = true;
    save();
  });
}

function twoClick(btn, label, confirmLabel, fn) {
  let armed = 0;
  btn.textContent = label;
  btn.addEventListener('click', () => {
    if (Date.now() - armed < 4000) {
      armed = 0;
      btn.textContent = label;
      fn();
      render();
      return;
    }
    armed = Date.now();
    btn.textContent = confirmLabel;
    setTimeout(() => { if (armed && Date.now() - armed >= 4000) { armed = 0; btn.textContent = label; } }, 4100);
  });
}

function chip(t, L) {
  const pct = Math.min(100, (t.p / L.need) * 100);
  const wait = t.p >= L.need;
  return `<div class="chip${wait ? ' wait' : ''}" style="--p:${pct.toFixed(0)}%" title="${REPOS[t.r].name}">KAN-${t.k}</div>`;
}

function pips(on, cap) {
  let h = '<div class="pips">';
  for (let i = 0; i < cap; i++) h += `<i class="pip${i < on ? ' on' : ''}"></i>`;
  return h + '</div>';
}

let lastHtml = {};
function setHtml(id, h) {
  if (lastHtml[id] !== h) { lastHtml[id] = h; $(id).innerHTML = h; }
}

function render() {
  const now = Date.now();
  const m = effMode(now);

  setText($('commits'), fmt(S.commits));
  setText($('rate'), fmt(S.rate));
  setText($('merged'), fmt(S.merged));
  setText($('value'), fmt(ticketValue()) + (S.tags ? ` (${S.tags} tag${S.tags === 1 ? '' : 's'})` : ''));

  // To Do
  const tq = S.lanes.triage.q, tcap = queueCap(0);
  let h = '';
  for (let i = 0; i < Math.min(tq.length, 7); i++) h += `<div class="chip todo" title="${REPOS[tq[i].r].name}">KAN-${tq[i].k}</div>`;
  if (tq.length > 7) h += `<div class="more">and ${tq.length - 7} more</div>`;
  if (!tq.length) h = '<div class="more">Empty. File a ticket to start the pipeline.</div>';
  setHtml('body-todo', h);
  const todoMeta = $('meta-todo');
  setText(todoMeta, tq.length >= tcap ? `Backlog full, ${tcap} of ${tcap}` : `${tq.length} of ${tcap} queued`);
  todoMeta.classList.toggle('full', tq.length >= tcap);

  // lanes
  LANES.forEach((L, i) => {
    const st = S.lanes[L.id];
    const slots = m === 0 ? 1 : st.slots;
    let b = '';
    for (const t of st.a) b += chip(t, L);
    for (let k = st.a.length; k < slots; k++) b += '<div class="chip empty"></div>';
    if (i > 0) {
      const cap = queueCap(i);
      b += `<div class="pips-label">Waiting</div>` + pips(st.q.length, cap);
    }
    setHtml('body-' + L.id, b);
    const meta = $('meta-' + L.id);
    const full = i > 0 && st.q.length >= queueCap(i);
    const per = L.need / laneRate(L, m);
    const nextFull = i < LANES.length - 1 && S.lanes[LANES[i + 1].id].q.length >= queueCap(i + 1);
    setText(meta, full
      ? (nextFull ? 'Queue full, backed up behind the next lane' : 'Queue full, this lane is the bottleneck')
      : `${per < 10 ? per.toFixed(1) : Math.round(per)} s a ticket, ${slots} slot${slots === 1 ? '' : 's'}`);
    meta.classList.toggle('full', full);
  });

  // buy buttons
  const openFeats = FEATS.filter(f => !S.feats[f.id]).slice(0, 4);
  for (const it of items) {
    const o = it.o;
    if (o.feat) {
      const show = openFeats.includes(o.feat);
      it.b.hidden = !show;
      if (!show) continue;
    }
    const c = o.cost();
    setText(it.t, o.title());
    setText(it.c, o.costText ? o.costText() : c == null ? 'Max' : fmt(c));
    setText(it.d, o.desc());
    it.b.disabled = c == null || S.commits < c;
  }
  const doneFeats = FEATS.length - FEATS.filter(f => !S.feats[f.id]).length;
  setText($('featCount'), `${doneFeats} of ${FEATS.length}`);
  $('featsDone').hidden = doneFeats < FEATS.length;

  // dial
  const dial = $('dial').children;
  MODES.forEach((mode, i) => {
    const b = dial[i];
    const owned = i < S.modesOwned;
    b.setAttribute('aria-pressed', String(i === m));
    b.disabled = !owned && (i > S.modesOwned || S.commits < mode.cost);
    setText(b.lastChild, owned ? `${mode.speed}x speed` : `Unlock for ${fmt(mode.cost)}`);
  });
  const note = $('dialNote');
  if (now < S.stepDownUntil && S.mode > 1) {
    setText(note, `Stepped down from ${MODES[S.mode].name}: hold spike. Back in ${Math.ceil((S.stepDownUntil - now) / 1000)} s.`);
    note.classList.add('alert');
  } else {
    setText(note, MODES[m].note);
    note.classList.remove('alert');
  }

  // repos, stable build
  setText($('repoCount'), `${S.repos} of ${REPOS.length}`);
  setText($('repoList'), 'Connected: ' + REPOS.slice(0, S.repos).map(r => r.name).join(', '));
  const gain = stableGain();
  setText($('stableNote'), gain >= 1
    ? `Resets commits, upgrades and repos for ${gain} tag${gain === 1 ? '' : 's'}. Each tag adds 25% to what a ticket pays, for good.`
    : `Resets the pipeline for tags that add 25% each to what a ticket pays. The first tag needs ${fmt(STABLE_AT)} commits earned this run; you have ${fmt(S.run)}.`);
  $('stableBtn').disabled = gain < 1;

  // holds
  if (dirty) {
    dirty = false;
    setText($('holdCount'), S.holds.length ? `${S.holds.length} of ${HOLD_CAP}` : '');
    $('holds').innerHTML = S.holds.length
      ? S.holds.map(x => `<div class="hold-card"><b>KAN-${x.k}</b><span>Held in ${x.lane}: ${x.rule}</span><button data-k="${x.k}">Land it</button></div>`).join('')
      : `<p class="empty">${S.modesOwned > 1 ? 'Nothing is held.' : 'Nothing is held. Holds start once the dial leaves Debug.'}</p>`;
  }
  if (logDirty) {
    logDirty = false;
    $('log').innerHTML = logLines.map(l => `<div class="${l.cls}">${l.msg}</div>`).join('');
  }
}

function advance(dt, now) {
  const sim = Math.min(dt, 10);
  const n = Math.max(1, Math.ceil(sim / 0.05));
  for (let k = 0; k < n; k++) step(sim / n, now);
  if (dt > 10) earn(S.rate * (dt - 10) * D.offline);
}

if (typeof document !== 'undefined') {
  derive();
  load();
  derive();
  buildUI();
  if (!logLines.length) log('server listening on :3456', 'l-info');
  let lastT = performance.now();
  setInterval(() => {
    const t = performance.now();
    advance((t - lastT) / 1000, Date.now());
    lastT = t;
    render();
  }, 100);
  setInterval(save, 10000);
  window.addEventListener('beforeunload', save);
  render();
} else {
  module.exports = {
    LANES, SOURCES, FEATS, REPOS, MODES, cost, advance, derive, fileTicket, nudge, landHold, cutStable, stableGain, ticketValue,
    get S() { return S; }, get D() { return D; },
  };
}
