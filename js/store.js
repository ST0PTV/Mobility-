// Einzige gespeicherte Einstellung: die Pause zwischen den Übungen in Sekunden (nur lokal, Schlüssel mit Präfix mob_).
// Ohne Speicher (privates Fenster) läuft die App mit dem Standardwert weiter.
import { BASE_REST } from './data.js';
import { MAX_REST } from './routine.js';

const KEY = 'mob_rest';
let memory = null;

export function getRest() {
  if (memory !== null) return memory;
  try {
    const v = Number.parseInt(localStorage.getItem(KEY), 10);
    if (Number.isInteger(v) && v >= 0 && v <= MAX_REST && v % 5 === 0) return v;
  } catch { /* ohne Speicher */ }
  return BASE_REST;
}

export function setRest(v) {
  memory = v;
  try { localStorage.setItem(KEY, String(v)); } catch { /* ohne Speicher: gilt bis zum Schließen */ }
}
