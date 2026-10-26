// Mobilitäts-App: Startseite (Dauer einstellen, Übungen ansehen) und Ablauf (eine Übung pro Bildschirm).
import { PROGRAM, BASE_MINUTES, HINTS } from './data.js';
import { nextMinutes, minuteRange, restSeconds, steps, remainingSeconds, fmtClock, doseText, gearList, resolve } from './routine.js';
import { getMinutes, setMinutes } from './store.js';
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
function homeView() {
  const minutes = getMinutes();
  const program = PROGRAM;
  const [lo, hi] = minuteRange(program);
  const gear = gearList(program);
  const stepBtn = (delta, label) => h('button', { class: 'btn round', type: 'button', 'aria-label': label,
    disabled: delta < 0 ? minutes <= lo : minutes >= hi,
    onclick: () => {
      const next = nextMinutes(program, minutes, delta);
      if (next === minutes) { toast(delta < 0 ? 'Kürzer geht nicht: die Übungen brauchen ihre Zeit.' : 'Länger geht nicht.'); return; }
      setMinutes(next); render();
    } }, delta < 0 ? '−' : '+');
  return h('section', {},
    h('h1', {}, 'Mobilität'),
    h('div', { class: 'card' },
      h('h2', {}, 'Mobilitätsprogramm'),
      h('p', { class: 'muted' }, `${program.length} Übungen · ohne Gewicht · Pause dazwischen ${restSeconds(program, minutes)} s`),
      h('div', { class: 'dur', role: 'group', 'aria-label': 'Dauer' },
        h('span', { class: 'dur-label' }, 'Dauer'),
        stepBtn(-1, 'Kürzer'),
        h('b', { class: 'dur-value', 'aria-live': 'polite' }, `${minutes} min`),
        stepBtn(1, 'Länger')),
      minutes !== BASE_MINUTES ? h('button', { class: 'link', type: 'button', onclick: () => { setMinutes(BASE_MINUTES); render(); } }, `Zurück auf ${BASE_MINUTES} min`) : null,
      h('button', { class: 'btn primary block', type: 'button', onclick: () => startRun(program, minutes) }, 'Starten')),
    h('p', { class: 'muted gear' }, 'Die Wiederholungen bleiben gleich. Eine längere Dauer macht die Pausen zwischen den Übungen länger.'),
    gear.length ? h('p', { class: 'muted gear' }, `Du brauchst: ${gear.join(', ')}. Was fehlt, lässt du einfach aus – mit „Weiter“.`) : null,
    h('div', { class: 'sec' }, 'Übungen'),
    h('div', { class: 'card list' }, program.map(resolve).map((x) => h('div', { class: 'row' }, h('span', { class: 't' }, x.name), h('b', {}, doseText(x.dose))))),
    h('div', { class: 'sec' }, 'Hinweise'),
    h('div', { class: 'card hints' }, HINTS.map((t) => h('p', {}, t))));
}

// ---------- Ablauf ----------
let run = null;
let activeAnim = null;
const stopAnim = () => { if (activeAnim) { activeAnim.stop(); activeAnim = null; } };

function startRun(program, minutes) {
  run = { steps: steps(program, minutes), index: 0, stepStart: Date.now(), pausedLeft: null, done: false };
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
  return Math.min(st.seconds, (Date.now() - run.stepStart) / 1000);
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
  const rest = st.kind === 'rest';
  const last = run.index === run.steps.length - 1;
  const remain = h('span', {});
  const ringText = h('b', { class: 'ring-time' });
  const ring = st.seconds !== null ? h('div', { class: 'ring', role: 'timer', 'aria-label': 'Restzeit' }, h('div', { class: 'ring-in' }, ringText, h('small', { class: 'muted' }, `von ${fmtClock(st.seconds)}`))) : null;
  const pause = st.seconds !== null && !rest ? h('button', { class: 'btn', type: 'button', onclick: () => {
    if (run.pausedLeft === null) run.pausedLeft = Math.max(0, st.seconds - elapsed());
    else { run.stepStart = Date.now() - (st.seconds - run.pausedLeft) * 1000; run.pausedLeft = null; }
    render();
  } }, run.pausedLeft === null ? 'Pause' : 'Weiter zählen') : null;

  const tick = () => {
    const el = elapsed();
    remain.textContent = `noch ${fmtClock(remainingSeconds(run.steps, run.index, el))}`;
    if (ring) {
      const left = Math.max(0, st.seconds - el);
      ring.style.setProperty('--p', `${Math.min(100, (el / st.seconds) * 100)}%`);
      ring.classList.toggle('done', left <= 0);
      ringText.textContent = left <= 0 ? 'Weiter' : fmtClock(Math.ceil(left));
    }
  };
  tick();
  const next = run.steps[run.index + 1];
  const root = h('section', { class: 'runner' },
    h('div', { class: 'run-top' },
      h('button', { class: 'btn small', type: 'button', onclick: () => { if (run.index === 0 || confirm('Beenden?')) endRun(); } }, 'Beenden'),
      h('span', { class: 'muted' }, rest ? `Pause nach ${st.number} von ${st.total}` : `Übung ${st.number} von ${st.total}`)),
    h('div', { class: 'bar' }, h('div', { class: 'bar-in', style: `width:${Math.round((run.index / run.steps.length) * 100)}%` })),
    h('div', { class: 'muted small run-meta' }, remain),
    rest
      ? h('div', { class: 'card run-card' },
        h('h2', {}, 'Kurz ausruhen'),
        h('p', { class: 'muted' }, `Als Nächstes: ${st.item.name} · ${doseText(st.item.dose)}`),
        ring,
        h('p', { class: 'muted small' }, 'Kein Ton – nur Anzeige. Mit „Weiter“ geht es sofort los.'))
      : h('div', { class: 'card run-card' },
        h('h2', {}, st.item.name),
        h('p', { class: 'muted' }, st.item.cue),
        st.seconds === null ? h('p', { class: 'run-dose' }, doseText(st.item.dose)) : null,
        ring, pause,
        animBlock(st.item),
        st.seconds !== null ? h('p', { class: 'muted small' }, 'Kein Ton – nur Anzeige.') : null),
    h('div', { class: 'btn-row' },
      h('button', { class: 'btn', type: 'button', disabled: run.index === 0, onclick: () => go(-1) }, 'Zurück'),
      h('button', { class: 'btn primary', type: 'button', onclick: () => go(1) }, last ? 'Fertig' : 'Weiter')),
    next && !rest ? h('p', { class: 'muted next' }, `Danach: Pause ${next.seconds} s`) : null);
  const timer = setInterval(() => { if (!document.body.contains(root) || !run) { clearInterval(timer); return; } tick(); }, 250);
  return root;
}

// ---------- Router ----------
function render() {
  if (location.hash !== '#/run') stopAnim();
  const node = location.hash === '#/run' ? runView() : homeView();
  view.replaceChildren(node);
  if (!(location.hash === '#/run')) view.scrollTop = 0;
}
window.addEventListener('hashchange', render);
render();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => { /* Offline-Betrieb ist optional */ }); });
}
