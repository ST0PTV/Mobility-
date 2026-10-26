// Einzige gespeicherte Einstellung: die Reihenfolge der Übungen (Liste der Kennungen; nur lokal, Schlüssel mit Präfix mob_).
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

// Alte Einstellung „Pause“ (bis 1.3.3) wird nicht mehr gebraucht.
try { localStorage.removeItem('mob_rest'); } catch { /* ohne Speicher */ }
