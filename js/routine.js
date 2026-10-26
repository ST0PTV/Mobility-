// Ablauf-Logik ohne DOM (in Node testbar): Zeit, Reihenfolge, Schritte.
import { EXERCISES } from './data.js';

// Konvention für die Zeitangabe (kein Messwert): 3 s pro Wiederholung. Es gibt keine Pausen zwischen den Übungen.
export const REP_SECONDS = 3;

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

export function fmtClock(sec) {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function doseText(dose) {
  return dose.mode === 'time' ? fmtClock(dose.seconds) : `${dose.reps}×`;
}

/** Programm in der gespeicherten Reihenfolge: Referenzen aus `order` zuerst (unbekannte und doppelte werden ignoriert), nicht genannte danach in Grundreihenfolge. */
export function orderProgram(program, order) {
  const byRef = new Map(program.map((e) => [e.ref, e]));
  const out = [];
  for (const ref of Array.isArray(order) ? order : []) if (byRef.has(ref)) { out.push(byRef.get(ref)); byRef.delete(ref); }
  return [...out, ...byRef.values()];
}

/** Eine Übung um `delta` Plätze verschieben (−1 hoch, +1 runter); an den Enden bleibt die Reihenfolge gleich. Gibt neue Liste von Referenzen zurück. */
export function moveRef(refs, index, delta) {
  const to = index + delta;
  if (index < 0 || index >= refs.length || to < 0 || to >= refs.length) return [...refs];
  const next = [...refs];
  [next[index], next[to]] = [next[to], next[index]];
  return next;
}

/** Schritte: eine Übung je Schritt (Zeitübungen mit Sekunden, Wiederholungsübungen per Taste). */
export function steps(program) {
  const items = program.map(resolve).filter(Boolean);
  return items.map((item, i) => ({ kind: 'exercise', number: i + 1, total: items.length, item, seconds: item.dose.mode === 'time' ? item.dose.seconds : null }));
}

export function gearList(program) {
  return [...new Set(program.map(resolve).filter(Boolean).map((x) => x.gear).filter(Boolean))];
}
