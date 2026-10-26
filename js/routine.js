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

// Einstellbare Dosis in der Technik-Ansicht: Wiederholungen in 5er-Schritten (5–60), Zeitübungen in 15-s-Schritten (15–180 s).
export const DOSE_LIMITS = { reps: { min: 5, max: 60, step: 5 }, time: { min: 15, max: 180, step: 15 } };

/** Dosis um einen Schritt ändern (delta −1/+1), an den Grenzen bleibt sie gleich. Gibt die neue Zahl (Wiederholungen bzw. Sekunden) zurück. */
export function stepDose(dose, delta) {
  const l = DOSE_LIMITS[dose.mode === 'time' ? 'time' : 'reps'];
  const cur = dose.mode === 'time' ? dose.seconds : dose.reps;
  return Math.max(l.min, Math.min(l.max, cur + delta * l.step));
}

/** Gespeicherte Dosen (Kennung → Zahl) auf das Programm anwenden; ungültige Werte werden ignoriert. */
export function applyDoses(program, doses) {
  return program.map((e) => {
    const v = doses && doses[e.ref];
    const l = DOSE_LIMITS[e.dose.mode === 'time' ? 'time' : 'reps'];
    if (!Number.isInteger(v) || v < l.min || v > l.max || v % l.step !== 0) return e;
    return { ...e, dose: e.dose.mode === 'time' ? { ...e.dose, seconds: v } : { ...e.dose, reps: v } };
  });
}

/** Schritte: eine Übung je Schritt (Zeitübungen mit Sekunden, Wiederholungsübungen per Taste). */
export function steps(program) {
  const items = program.map(resolve).filter(Boolean);
  return items.map((item, i) => ({ kind: 'exercise', number: i + 1, total: items.length, item, seconds: item.dose.mode === 'time' ? item.dose.seconds : null }));
}

export function gearList(program) {
  return [...new Set(program.map(resolve).filter(Boolean).map((x) => x.gear).filter(Boolean))];
}
