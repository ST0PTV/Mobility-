# Mobilität

Kleine, eigenständige Web-App (PWA) mit einem täglichen Mobilitätsprogramm aus ruhigen Übungen ohne Gewicht.
Die Dauer lässt sich mit − und + ändern; die App rechnet die Wiederholungen und Zeiten anteilig um.
Alle Daten bleiben auf dem Gerät (einzige gespeicherte Einstellung: die Dauer, Schlüssel `mob_minutes`). Keine Konten, kein Tracking, kein Server.

- Abgeleitet aus dem Workout Tracker (`ST0PTV/Workout-Tracker`), aber als eigener, eingefrorener Stand mit eigenem Link.
- Kein Krafttraining, keine Statistik, kein Streak. Nur so weit bewegen, wie es angenehm ist.
- Dauerangaben sind eine Konvention (3 s pro Wiederholung, 10 s Wechselzeit pro Übung), keine Messwerte.

## Entwickeln und prüfen
```
npm run check    # Syntax
npm test         # Logik (Node)
PLAYWRIGHT_MODULE=<Ordner von playwright> node tests/browser-check.mjs [Screenshot-Ordner]
```
Bei jeder Änderung an Dateien `CACHE_VERSION` in `sw.js` hochzählen, sonst bleibt auf den Geräten der alte Stand im Cache.

Veröffentlichung über GitHub Pages (Branch `main`, Ordner `/`).
