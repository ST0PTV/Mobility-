# Mobilität

Kleine, eigenständige Web-App (PWA) mit einem täglichen Mobilitätsprogramm aus ruhigen Übungen ohne Gewicht.
Die Dauer (15 bis 45 min, in 5er-Schritten) lässt sich mit − und + ändern. Die Wiederholungen bleiben fest (20 je Übung, Hüftkreisen 1 min); eine längere Dauer macht die Pausen zwischen den Übungen länger.
Alle Daten bleiben auf dem Gerät (einzige gespeicherte Einstellung: die Dauer, Schlüssel `mob_minutes`). Keine Konten, kein Tracking, kein Server.

- Abgeleitet aus dem Workout Tracker (`ST0PTV/Workout-Tracker`), aber als eigener, eingefrorener Stand mit eigenem Link.
- Kein Krafttraining, keine Statistik, kein Streak. Nur so weit bewegen, wie es angenehm ist.
- Dauerangaben sind eine Konvention (3 s pro Wiederholung; Pause zwischen den Übungen = Wunschdauer minus Übungszeit, 5 bis 180 s), keine Messwerte.

## Entwickeln und prüfen
```
npm run check    # Syntax
npm test         # Logik (Node)
PLAYWRIGHT_MODULE=<Ordner von playwright> node tests/browser-check.mjs [Screenshot-Ordner]
```
Bei jeder Änderung an Dateien `CACHE_VERSION` in `sw.js` hochzählen, sonst bleibt auf den Geräten der alte Stand im Cache.

Veröffentlichung über GitHub Pages (Branch `main`, Ordner `/`).
