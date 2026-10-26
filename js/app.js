// Mobilitäts-App: Startseite (Übungen ansehen, Reihenfolge ändern) und Ablauf (eine Übung pro Bildschirm).
import { PROGRAM, HINTS } from './data.js';
import { steps, fmtClock, doseText, resolve, orderProgram, moveRef } from './routine.js';
import { getOrder, setOrder } from './store.js';
import { animationCard } from './anim-view.js';

const view = document.getElementById('view');
const toastEl = document.getElementById('toast');

function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) if (c !== null && c !== undefined && c !== false) el.append(c.nodeType ? c : document.createTextNode(String(c)));
  return el;
}

function toast(text) {
  toastEl.textContent = text;
  toastEl.classList.add('show');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => toastEl.classList.remove('show'), 2400);
}


// ---------- Wachhalten während des Ablaufs (optional, still bei Fehlern) ----------
let wake = null;
async function keepAwake(on) {
  try {
    if (on && 'wakeLock' in navigator && !wake) {
      wake = await navigator.wakeLock.request('screen');
      wake.addEventListener('release', () => { wake = null; });
    } else if (!on && wake) { await wake.release(); wake = null; }
  } catch { /* nicht unterstützt oder abgelehnt */ }
}
document.addEventListener('visibilitychange', () => { if (run && document.visibilityState === 'visible') keepAwake(true); });

// ---------- Startseite ----------
const currentProgram = () => orderProgram(PROGRAM, getOrder());
let editOrder = false;

function homeView() {
  const program = currentProgram();
  const refs = program.map((e) => e.ref);
  const move = (i, d) => () => { setOrder(moveRef(refs, i, d)); render(); };
  const arrow = (i, d, label) => h('button', { class: 'btn round sm', type: 'button', 'aria-label': `${label}: ${resolve(program[i]).name}`, disabled: d < 0 ? i === 0 : i === refs.length - 1, onclick: move(i, d) }, d < 0 ? '▲' : '▼');
  const rows = program.map(resolve).map((x, i) => editOrder
    ? h('div', { class: 'row' }, h('span', { class: 't' }, x.name), arrow(i, -1, 'Nach oben'), arrow(i, 1, 'Nach unten'))
    : h('button', { class: 'row', type: 'button', 'aria-label': `${x.name}, Technik ansehen`, onclick: () => { location.hash = `#/ex/${i}`; } }, h('span', { class: 't' }, x.name), h('b', {}, doseText(x.dose)), h('span', { class: 'chev', 'aria-hidden': 'true' }, '›')));
  return h('section', {},
    h('h1', {}, 'Mobilität'),
    h('div', { class: 'card' },
      h('h2', {}, 'Mobilitätsprogramm'),
      h('p', { class: 'muted' }, `${program.length} Übungen`),
      h('button', { class: 'btn primary block', type: 'button', onclick: () => startRun(program) }, 'Starten')),
    h('div', { class: 'sec-row' }, h('div', { class: 'sec' }, 'Übungen'),
      h('button', { class: 'btn small', type: 'button', onclick: () => { editOrder = !editOrder; render(); } }, editOrder ? 'Fertig' : 'Reihenfolge ändern')),
    h('div', { class: 'card list' }, rows),
    h('div', { class: 'sec' }, 'Hinweise'),
    h('div', { class: 'card hints' }, HINTS.map((t) => h('p', {}, t))));
}

// ---------- Technik einer Übung (aus der Liste der Startseite) ----------
function exerciseView(i) {
  const list = currentProgram().map(resolve).filter(Boolean);
  const x = list[i];
  if (!x) { setTimeout(() => { location.hash = '#/'; }, 0); return h('section', {}); }
  const go2 = (n) => () => { location.hash = `#/ex/${n}`; };
  return h('section', { class: 'runner' },
    h('div', { class: 'run-top' },
      h('button', { class: 'btn small', type: 'button', onclick: () => { location.hash = '#/'; } }, 'Zur Übersicht'),
      h('span', { class: 'muted' }, `Übung ${i + 1} von ${list.length}`)),
    h('div', { class: 'card run-card' },
      h('h2', {}, x.name),
      h('p', { class: 'muted' }, x.cue),
      h('p', { class: 'run-dose' }, doseText(x.dose)),
      animBlock(x)),
    h('div', { class: 'btn-row' },
      h('button', { class: 'btn', type: 'button', disabled: i === 0, onclick: go2(i - 1) }, 'Zurück'),
      h('button', { class: 'btn', type: 'button', disabled: i === list.length - 1, onclick: go2(i + 1) }, 'Nächste')));
}

// ---------- Ablauf ----------
let run = null;
let activeAnim = null;
const stopAnim = () => { if (activeAnim) { activeAnim.stop(); activeAnim = null; } };

function startRun(program) {
  run = { steps: steps(program), index: 0, stepStart: Date.now(), startedAt: Date.now(), pausedLeft: null, done: false };
  keepAwake(true);
  location.hash = '#/run';
}

function endRun() {
  stopAnim();
  run = null;
  keepAwake(false);
  location.hash = '#/';
}

function elapsed() {
  const st = run.steps[run.index];
  if (st.seconds === null) return 0;
  if (run.pausedLeft !== null) return st.seconds - run.pausedLeft;
  return Math.max(0, Math.min(st.seconds, (Date.now() - run.stepStart) / 1000));
}

function go(delta) {
  const next = run.index + delta;
  if (next >= run.steps.length) { run.done = true; keepAwake(false); render(); return; }
  run.index = Math.max(0, next);
  run.stepStart = Date.now();
  run.pausedLeft = null;
  render();
}

// Technik-Animation der Haupt-App (Figur, Kernpunkte); ohne Animation für diese Übung bleibt nur der Hinweistext.
function animBlock(item) {
  if (!item.anim) return null;
  try {
    const card = animationCard(item.anim);
    if (!card) return null;
    activeAnim = card;
    return h('div', { class: 'run-anim' }, card.el);
  } catch (e) { console.error(e); return null; }
}

function runView() {
  stopAnim();
  if (!run) { setTimeout(() => { location.hash = '#/'; }, 0); return h('section', {}, h('p', { class: 'muted' }, 'Kein Ablauf aktiv.')); }
  if (run.done) {
    return h('section', { class: 'done' },
      h('h1', {}, 'Geschafft.'),
      h('p', { class: 'muted' }, 'Gut gemacht. Morgen wieder, wenn du magst.'),
      h('button', { class: 'btn primary block', type: 'button', onclick: endRun }, 'Fertig'));
  }
  const st = run.steps[run.index];
  const last = run.index === run.steps.length - 1;
  const remain = h('span', {});
  const ringText = h('b', { class: 'ring-time' });
  const ring = st.seconds !== null ? h('div', { class: 'ring', role: 'timer', 'aria-label': 'Restzeit' }, h('div', { class: 'ring-in' }, ringText, h('small', { class: 'muted' }, `von ${fmtClock(st.seconds)}`))) : null;
  const pause = st.seconds !== null ? h('button', { class: 'btn', type: 'button', onclick: () => {
    if (run.pausedLeft === null) run.pausedLeft = Math.max(0, st.seconds - elapsed());
    else { run.stepStart = Date.now() - (st.seconds - run.pausedLeft) * 1000; run.pausedLeft = null; }
    render();
  } }, run.pausedLeft === null ? 'Pause' : 'Weiter zählen') : null;

  const dock = h('div', { class: 'dock' });
  const root = h('section', { class: 'runner' });
  const tick = () => {
    const el = elapsed();
    remain.textContent = `Zeit ${fmtClock((Date.now() - run.startedAt) / 1000)}`;   // zählt hoch: so lange läuft das Programm schon
    if (ring && st.seconds !== null) {
      const sLeft = Math.max(0, st.seconds - el);
      ring.style.setProperty('--p', `${Math.min(100, (el / st.seconds) * 100)}%`);
      ring.classList.toggle('done', sLeft <= 0 && el > 0);
      ringText.textContent = sLeft <= 0 ? 'Weiter' : fmtClock(Math.ceil(sLeft));
    }
  };
  tick();
  dock.append(h('div', { class: 'btn-row' },
    h('button', { class: 'btn', type: 'button', disabled: run.index === 0, onclick: () => go(-1) }, 'Zurück'),
    h('button', { class: 'btn primary', type: 'button', onclick: () => go(1) }, last ? 'Fertig' : 'Weiter')));
  root.append(
    h('div', { class: 'run-top' },
      h('button', { class: 'btn small', type: 'button', onclick: () => { if (run.index === 0 || confirm('Beenden?')) endRun(); } }, 'Beenden'),
      h('span', { class: 'muted' }, `Übung ${st.number} von ${st.total}`)),
    h('div', { class: 'bar' }, h('div', { class: 'bar-in', style: `width:${Math.round((run.index / run.steps.length) * 100)}%` })),
    h('div', { class: 'muted small run-meta' }, remain),
    h('div', { class: 'card run-card' },
      h('h2', {}, st.item.name),
      h('p', { class: 'muted' }, st.item.cue),
      st.seconds === null ? h('p', { class: 'run-dose' }, doseText(st.item.dose)) : null,
      ring, pause,
      animBlock(st.item),
      st.seconds !== null ? h('p', { class: 'muted small' }, 'Kein Ton – nur Anzeige.') : null),
    dock);
  const timer = setInterval(() => { if (!document.body.contains(root) || !run) { clearInterval(timer); return; } tick(); }, 250);
  return root;
}

// ---------- Router ----------
function render() {
  stopAnim();
  const m = /^#\/ex\/(\d+)$/.exec(location.hash);
  const onRun = location.hash === '#/run';
  const node = onRun ? runView() : m ? exerciseView(Number(m[1])) : homeView();
  view.replaceChildren(node);
  if (!onRun) view.scrollTop = 0;
}
window.addEventListener('hashchange', render);
render();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => { /* Offline-Betrieb ist optional */ }); });
}
