// Ablauf-Logik ohne DOM (in Node testbar): Zeit, Skalierung auf eine Wunschdauer, Schritte.
import { EXERCISES } from './data.js';

// Konventionen für die Zeitangabe (keine Messwerte): 3 s pro Wiederholung. Die Wiederholungen bleiben fest;
// die Wunschdauer ändert nur die Pause zwischen den Übungen.
export const REP_SECONDS = 3;
export const MIN_REST = 5;      // kürzeste Pause zwischen zwei Übungen
export const MAX_REST = 180;    // längste Pause
export const STEP_MINUTES = 5;

export function resolve(entry) {
  const ex = EXERCISES[entry.ref];
  return ex ? { ref: entry.ref, name: ex.name, cue: ex.cue, gear: ex.gear || null, dose: { ...entry.dose } } : null;
}

export function itemSeconds(dose) {
  return dose.mode === 'time' ? dose.seconds : dose.reps * REP_SECONDS;
}

export function workSeconds(program) {
  return program.map(resolve).filter(Boolean).reduce((n, x) => n + itemSeconds(x.dose), 0);
}

const gaps = (program) => Math.max(1, program.map(resolve).filter(Boolean).length - 1);

/** Kürzeste und längste wählbare Dauer in Minuten (auf 5 min gerundet): Arbeit plus kürzeste/längste Pause. */
export function minuteRange(program) {
  const w = workSeconds(program);
  const lo = Math.ceil((w + gaps(program) * MIN_REST) / 60 / STEP_MINUTES) * STEP_MINUTES;
  const hi = Math.floor((w + gaps(program) * MAX_REST) / 60 / STEP_MINUTES) * STEP_MINUTES;
  return [lo, hi];
}

/** Pause zwischen zwei Übungen (auf 5 s gerundet) für die Wunschdauer. */
export function restSeconds(program, minutes) {
  const raw = (minutes * 60 - workSeconds(program)) / gaps(program);
  return Math.max(MIN_REST, Math.min(MAX_REST, Math.round(raw / 5) * 5));
}

export function totalSeconds(program, minutes) {
  return workSeconds(program) + restSeconds(program, minutes) * (program.map(resolve).filter(Boolean).length - 1);
}

/** Nächste Wunschdauer in 5-Minuten-Schritten innerhalb des Bereichs; gleich bleiben, wenn die Grenze erreicht ist. */
export function nextMinutes(program, cur, delta) {
  const [lo, hi] = minuteRange(program);
  const next = delta > 0 ? Math.floor(cur / STEP_MINUTES) * STEP_MINUTES + STEP_MINUTES : Math.ceil(cur / STEP_MINUTES) * STEP_MINUTES - STEP_MINUTES;
  return Math.max(lo, Math.min(hi, next));
}

export function fmtClock(sec) {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function doseText(dose) {
  return dose.mode === 'time' ? fmtClock(dose.seconds) : `${dose.reps}×`;
}

/** Schritte: je Übung einer (Zeitübungen mit Sekunden, Wiederholungsübungen per Taste), dazwischen eine Pause mit Zeitring. */
export function steps(program, minutes) {
  const items = program.map(resolve).filter(Boolean);
  const rest = restSeconds(program, minutes);
  const out = [];
  items.forEach((item, i) => {
    out.push({ kind: 'exercise', number: i + 1, total: items.length, item, seconds: item.dose.mode === 'time' ? item.dose.seconds : null });
    if (i < items.length - 1) out.push({ kind: 'rest', number: i + 1, total: items.length, item: items[i + 1], seconds: rest });
  });
  return out;
}

const stepSeconds = (st) => (st.kind === 'rest' ? st.seconds : itemSeconds(st.item.dose));

/** Restzeit ab Schritt i inkl. laufendem Schritt (verstrichene Zeit abgezogen). */
export function remainingSeconds(stepList, index, elapsed = 0) {
  let sec = 0;
  for (let i = index; i < stepList.length; i++) sec += i === index ? Math.max(0, stepSeconds(stepList[i]) - elapsed) : stepSeconds(stepList[i]);
  return sec;
}

export function gearList(program) {
  return [...new Set(program.map(resolve).filter(Boolean).map((x) => x.gear).filter(Boolean))];
}
