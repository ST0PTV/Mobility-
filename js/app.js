// Mobilitäts-App: Startseite (Dauer einstellen, Übungen ansehen) und Ablauf (eine Übung pro Bildschirm).
import { PROGRAM, BASE_REST, HINTS } from './data.js';
import { nextRest, fmtRest, totalSeconds, steps, remainingSeconds, fmtClock, doseText, gearList, resolve, MAX_REST, REST_ADJUST } from './routine.js';
import { getRest, setRest } from './store.js';
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
  const rest = getRest();
  const program = PROGRAM;
  const gear = gearList(program);
  const stepBtn = (delta, label) => h('button', { class: 'btn round', type: 'button', 'aria-label': label,
    disabled: delta < 0 ? rest <= 0 : rest >= MAX_REST,
    onclick: () => { setRest(nextRest(rest, delta)); render(); } }, delta < 0 ? '−' : '+');
  return h('section', {},
    h('h1', {}, 'Mobilität'),
    h('div', { class: 'card' },
      h('h2', {}, 'Mobilitätsprogramm'),
      h('p', { class: 'muted' }, `${program.length} Übungen · ohne Gewicht · Gesamt rund ${Math.round(totalSeconds(program, rest) / 60)} min`),
      h('div', { class: 'dur', role: 'group', 'aria-label': 'Pause zwischen den Übungen' },
        h('span', { class: 'dur-label' }, 'Pause'),
        stepBtn(-1, 'Pause kürzer'),
        h('b', { class: 'dur-value', 'aria-live': 'polite' }, fmtRest(rest)),
        stepBtn(1, 'Pause länger')),
      rest !== BASE_REST ? h('button', { class: 'link', type: 'button', onclick: () => { setRest(BASE_REST); render(); } }, `Zurück auf ${fmtRest(BASE_REST)}`) : null,
      h('button', { class: 'btn primary block', type: 'button', onclick: () => startRun(program, rest) }, 'Starten')),
    h('p', { class: 'muted gear' }, 'Die Wiederholungen bleiben gleich. Du wählst, wie lang die Pause zwischen den Übungen ist; die Gesamtzeit ergibt sich daraus.'),
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

function startRun(program, rest) {
  run = { steps: steps(program, rest), index: 0, stepStart: Date.now(), pausedLeft: null, rest: null, done: false };
  keepAwake(true);
  location.hash = '#/run';
}

function endRun() {
  stopAnim();
  run = null;
  keepAwake(false);
  location.hash = '#/';
}

// Laufende Pause (läuft neben der nächsten Übung, wie die Pausen-Leiste der Haupt-App): Sekunden bis zum Ende, negativ = darüber hinaus.
const restLeft = () => (run.rest ? run.rest.seconds - (Date.now() - run.rest.start) / 1000 : null);
const restActive = () => run.rest !== null && restLeft() > 0;

function elapsed() {
  const st = run.steps[run.index];
  if (st.seconds === null) return 0;
  if (run.rest && !run.rest.over) {
    if (restLeft() > 0) return 0;              // Zeitübung wartet, bis die Pause vorbei ist
    run.rest.over = true;
    run.stepStart = run.rest.start + run.rest.seconds * 1000;
  }
  if (run.pausedLeft !== null) return st.seconds - run.pausedLeft;
  return Math.max(0, Math.min(st.seconds, (Date.now() - run.stepStart) / 1000));
}

function closeRest() {
  if (!run.rest) return;
  if (!run.rest.over) run.stepStart = Math.min(Date.now(), run.rest.start + run.rest.seconds * 1000);
  run.rest = null;
}

function go(delta) {
  const next = run.index + delta;
  if (next >= run.steps.length) { run.done = true; keepAwake(false); render(); return; }
  run.index = Math.max(0, next);
  run.stepStart = Date.now();
  run.pausedLeft = null;
  const before = run.steps[run.index].restBefore;
  run.rest = delta > 0 && before > 0 ? { start: Date.now(), seconds: before, over: false } : null;
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

// Pausen-Leiste wie in der Haupt-App: Ring, Restzeit, −15/+15, Schließen, „Als Nächstes“; nach der Pause leuchtet sie einmal sanft auf.
const RING_LEN = 2 * Math.PI * 23;
function restBar(st, onClose) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 54 54');
  svg.setAttribute('class', 'rt-ring');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = `<circle cx="27" cy="27" r="23" class="rt-ring-bg"/><circle cx="27" cy="27" r="23" class="rt-ring-fg" stroke-dasharray="${RING_LEN}" stroke-dashoffset="${RING_LEN}" transform="rotate(-90 27 27)"/>`;
  const adjust = (sign) => () => {
    run.rest.seconds = Math.max(0, run.rest.seconds + sign * REST_ADJUST);
    draw();
  };
  const time = h('b', { class: 'rt-time' });
  const sub = h('small', { class: 'rt-sub' });
  const adjBtns = [
    h('button', { class: 'rt-btn rt-adj', type: 'button', 'aria-label': 'Pause 15 Sekunden kürzer', onclick: adjust(-1) }, '−15'),
    h('button', { class: 'rt-btn rt-adj', type: 'button', 'aria-label': 'Pause 15 Sekunden länger', onclick: adjust(1) }, '+15')];
  const bar = h('div', { class: 'restbar', role: 'timer', 'aria-live': 'off' },
    svg, h('div', { class: 'rt-text' }, time, sub), adjBtns,
    h('button', { class: 'rt-btn', type: 'button', 'aria-label': 'Pause beenden', onclick: onClose }, '✕'),
    h('div', { class: 'rt-next' }, `Als Nächstes: ${st.item.name} · ${doseText(st.item.dose)}`));
  let wasDone = false;
  function draw() {
    const left = restLeft();
    const done = left <= 0;
    bar.classList.toggle('done', done);
    time.textContent = done ? 'Pause vorbei' : fmtClock(Math.ceil(left));
    sub.textContent = done ? `+${fmtClock(-left)} über die Zeit` : 'Pause';
    svg.querySelector('.rt-ring-fg').setAttribute('stroke-dashoffset', String(RING_LEN * (1 - Math.min(1, Math.max(0, 1 - left / Math.max(1, run.rest.seconds))))));
    adjBtns.forEach((b) => { b.hidden = done; });
    if (done && !wasDone) { bar.classList.remove('pulse'); void bar.offsetWidth; bar.classList.add('pulse'); }
    wasDone = done;
  }
  bar.draw = draw;
  draw();
  return bar;
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
  const pause = st.seconds !== null ? h('button', { class: 'btn', type: 'button', hidden: restActive(), onclick: () => {
    if (run.pausedLeft === null) run.pausedLeft = Math.max(0, st.seconds - elapsed());
    else { run.stepStart = Date.now() - (st.seconds - run.pausedLeft) * 1000; run.pausedLeft = null; }
    render();
  } }, run.pausedLeft === null ? 'Pause' : 'Weiter zählen') : null;

  let bar = null;
  const dock = h('div', { class: 'dock' });
  const root = h('section', { class: `runner${run.rest ? ' has-rest' : ''}` });
  if (run.rest) {
    bar = restBar(st, () => { closeRest(); bar.remove(); bar = null; root.classList.remove('has-rest'); if (pause) pause.hidden = false; tick(); });
    dock.append(bar);
  }
  const tick = () => {
    const el = elapsed();
    const left = run.rest && !run.rest.over ? restLeft() : 0;
    remain.textContent = `noch ${fmtClock(remainingSeconds(run.steps, run.index, el, left))}`;
    if (bar) { bar.draw(); if (pause && !restActive()) pause.hidden = false; }
    if (ring && st.seconds !== null) {
      const sLeft = Math.max(0, st.seconds - el);
      ring.style.setProperty('--p', `${Math.min(100, (el / st.seconds) * 100)}%`);
      ring.classList.toggle('done', sLeft <= 0 && el > 0);
      ringText.textContent = restActive() ? fmtClock(st.seconds) : sLeft <= 0 ? 'Weiter' : fmtClock(Math.ceil(sLeft));
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
