// Gespeicherte Einstellungen (nur lokal, Schlüssel mit Präfix mob_): Reihenfolge der Übungen (`mob_order`) und Dosen je Übung (`mob_doses`).
// Ohne Speicher (privates Fenster) gilt die Reihenfolge bis zum Schließen.
const KEY = 'mob_order';
let memory = null;

export function getOrder() {
  if (memory !== null) return memory;
  try {
    const v = JSON.parse(localStorage.getItem(KEY));
    if (Array.isArray(v) && v.every((x) => typeof x === 'string')) return v;
  } catch { /* ohne Speicher oder ungültig */ }
  return [];
}

export function setOrder(refs) {
  memory = [...refs];
  try { localStorage.setItem(KEY, JSON.stringify(memory)); } catch { /* ohne Speicher: gilt bis zum Schließen */ }
}

let dosesMemory = null;
export function getDoses() {
  if (dosesMemory !== null) return dosesMemory;
  try {
    const v = JSON.parse(localStorage.getItem('mob_doses'));
    if (v && typeof v === 'object' && !Array.isArray(v)) return v;
  } catch { /* ohne Speicher oder ungültig */ }
  return {};
}

export function setDose(ref, value) {
  dosesMemory = { ...getDoses(), [ref]: value };
  try { localStorage.setItem('mob_doses', JSON.stringify(dosesMemory)); } catch { /* ohne Speicher: gilt bis zum Schließen */ }
}

// Alte Einstellung „Pause“ (bis 1.3.3) wird nicht mehr gebraucht.
try { localStorage.removeItem('mob_rest'); } catch { /* ohne Speicher */ }
