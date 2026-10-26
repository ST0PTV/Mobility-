// Einzige gespeicherte Einstellung: die Wunschdauer in Minuten (nur lokal, Schlüssel mit Präfix mob_).
// Ohne Speicher (privates Fenster) läuft die App mit dem Standardwert weiter.
import { BASE_MINUTES, PROGRAM } from './data.js';
import { minuteRange } from './routine.js';

const KEY = 'mob_minutes';
let memory = null;

export function getMinutes() {
  if (memory !== null) return memory;
  try {
    const v = Number.parseInt(localStorage.getItem(KEY), 10);
    const [lo, hi] = minuteRange(PROGRAM);
    if (Number.isInteger(v) && v >= lo && v <= hi && v % 5 === 0) return v;
  } catch { /* ohne Speicher */ }
  return BASE_MINUTES;
}

export function setMinutes(v) {
  memory = v;
  try { localStorage.setItem(KEY, String(v)); } catch { /* ohne Speicher: gilt bis zum Schließen */ }
}
