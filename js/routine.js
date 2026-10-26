// Ablauf-Logik ohne DOM (in Node testbar): Zeit, Skalierung auf eine Wunschdauer, Schritte.
import { EXERCISES } from './data.js';

// Konventionen für die Zeitangabe (keine Messwerte): 3 s pro Wiederholung. Die Wiederholungen bleiben fest;
// die Pause zwischen den Übungen wählt der Nutzer frei (0 bis 180 s), die Gesamtzeit ergibt sich daraus.
export const REP_SECONDS = 3;
export const MAX_REST = 180;    // längste Pause
export const REST_ADJUST = 15;  // Schritt der Tasten −/+ während der Pause (wie in der Haupt-App)

export function resolve(entry) {
  const ex = EXERCISES[entry.ref];
  return ex ? { ref: entry.ref, name: ex.name, cue: ex.cue, gear: ex.gear || null, anim: ex.anim || null, dose: { ...entry.dose } } : null;
}

export function itemSeconds(dose) {
  return dose.mode === 'time' ? dose.seconds : dose.reps * REP_SECONDS;
}

export function workSeconds(program) {
  return program.map(resolve).filter(Boolean).reduce((n, x) => n + itemSeconds(x.dose), 0);
}

const count = (program) => program.map(resolve).filter(Boolean).length;

/** Gesamtzeit in Sekunden: Übungszeit plus Pause zwischen allen Übungen. */
export function totalSeconds(program, rest) {
  return workSeconds(program) + rest * Math.max(0, count(program) - 1);
}

/** Nächste Pausenlänge: 5-s-Schritte bis 60 s, darüber 15-s-Schritte; an den Grenzen (0 und 180 s) gleich bleiben. */
export function nextRest(cur, delta) {
  const step = (delta > 0 ? cur >= 60 : cur > 60) ? 15 : 5;
  const next = delta > 0 ? Math.floor(cur / step) * step + step : Math.ceil(cur / step) * step - step;
  return Math.max(0, Math.min(MAX_REST, next));
}

/** Pausenlänge als Text: „keine“, „40 s“, „1 min 15 s“. */
export function fmtRest(sec) {
  if (sec <= 0) return 'keine';
  if (sec < 60) return `${sec} s`;
  return sec % 60 === 0 ? `${sec / 60} min` : `${Math.floor(sec / 60)} min ${sec % 60} s`;
}

export function fmtClock(sec) {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function doseText(dose) {
  return dose.mode === 'time' ? fmtClock(dose.seconds) : `${dose.reps}×`;
}

/** Schritte: eine Übung je Schritt (Zeitübungen mit Sekunden, Wiederholungsübungen per Taste); `restBefore` = Pause, die vor der Übung läuft. */
export function steps(program, rest) {
  const items = program.map(resolve).filter(Boolean);
  return items.map((item, i) => ({ kind: 'exercise', number: i + 1, total: items.length, item, seconds: item.dose.mode === 'time' ? item.dose.seconds : null, restBefore: i > 0 ? rest : 0 }));
}

/** Restzeit ab Schritt i inkl. laufendem Schritt: verstrichene Zeit abgezogen, laufende Pause (restLeft) mitgezählt. */
export function remainingSeconds(stepList, index, elapsed = 0, restLeft = 0) {
  let sec = Math.max(0, restLeft);
  for (let i = index; i < stepList.length; i++) {
    sec += i === index ? Math.max(0, itemSeconds(stepList[i].item.dose) - elapsed) : itemSeconds(stepList[i].item.dose) + stepList[i].restBefore;
  }
  return sec;
}

export function gearList(program) {
  return [...new Set(program.map(resolve).filter(Boolean).map((x) => x.gear).filter(Boolean))];
}
