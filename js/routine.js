// Ablauf-Logik ohne DOM (in Node testbar): Zeit, Skalierung auf eine Wunschdauer, Schritte.
import { EXERCISES } from './data.js';

// Konventionen für die Zeitangabe (keine Messwerte): 3 s pro Wiederholung, 10 s Wechselzeit pro Übung.
export const REP_SECONDS = 3;
export const TRANSITION_SEC = 10;
export const LIMITS = { seconds: [5, 3600], reps: [1, 100] };
export const MINUTES = [1, 60];

export function resolve(entry) {
  const ex = EXERCISES[entry.ref];
  return ex ? { ref: entry.ref, name: ex.name, cue: ex.cue, gear: ex.gear || null, dose: { ...entry.dose } } : null;
}

export function itemSeconds(dose) {
  return dose.mode === 'time' ? dose.seconds : dose.reps * REP_SECONDS;
}

export function totalSeconds(program) {
  return program.map(resolve).filter(Boolean).reduce((n, x) => n + itemSeconds(x.dose) + TRANSITION_SEC, 0);
}

const clamp = (v, [lo, hi]) => Math.max(lo, Math.min(hi, v));

/** Programm auf eine Zielzeit skalieren: Wiederholungen ganzzahlig, Zeiten auf 5 s, Wechselzeiten bleiben. */
export function scale(program, targetSec) {
  const rows = program.map(resolve).filter(Boolean);
  const work = rows.reduce((n, x) => n + itemSeconds(x.dose), 0);
  if (!rows.length || work <= 0) return program;
  const f = Math.max(0.05, (targetSec - rows.length * TRANSITION_SEC) / work);
  return program.map((e) => (e.dose.mode === 'time'
    ? { ...e, dose: { mode: 'time', seconds: clamp(Math.round((e.dose.seconds * f) / 5) * 5, LIMITS.seconds) } }
    : { ...e, dose: { mode: 'reps', reps: clamp(Math.round(e.dose.reps * f), LIMITS.reps) } }));
}

/** Nächste Zielzeit in Minuten: unter 5 min in 1er-, darüber in 5er-Schritten. */
export function nextMinutes(cur, delta) {
  const [lo, hi] = MINUTES;
  if (delta > 0) return Math.min(hi, cur < 5 ? cur + 1 : Math.floor(cur / 5) * 5 + 5);
  return Math.max(lo, cur <= 5 ? cur - 1 : Math.ceil(cur / 5) * 5 - 5);
}

export function fmtClock(sec) {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function doseText(dose) {
  return dose.mode === 'time' ? fmtClock(dose.seconds) : `${dose.reps}×`;
}

/** Ein Schritt je Übung; Zeitübungen mit Sekunden, Wiederholungsübungen ohne (weiter per Taste). */
export function steps(program) {
  return program.map(resolve).filter(Boolean).map((item, i) => ({ index: i, item, seconds: item.dose.mode === 'time' ? item.dose.seconds : null }));
}

/** Restzeit ab Schritt i inkl. laufendem Schritt (verstrichene Zeit abgezogen), mit Wechselzeiten. */
export function remainingSeconds(stepList, index, elapsed = 0) {
  let sec = 0;
  for (let i = index; i < stepList.length; i++) {
    const w = itemSeconds(stepList[i].item.dose);
    sec += (i === index ? Math.max(0, w - elapsed) : w) + (i === stepList.length - 1 ? 0 : TRANSITION_SEC);
  }
  return sec;
}

export function gearList(program) {
  return [...new Set(program.map(resolve).filter(Boolean).map((x) => x.gear).filter(Boolean))];
}
