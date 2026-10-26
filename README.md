# Mobilität

Kleine, eigenständige Web-App (PWA) mit einem täglichen Mobilitätsprogramm aus ruhigen Übungen ohne Gewicht.
Es gibt keine Pausen zwischen den Übungen: Grundwert 20 Wiederholungen je Übung (Hüftkreisen 1 min), in der Technik-Ansicht einer Übung mit −/+ änderbar (5er-Schritte, Hüftkreisen 15 s) und gemerkt; nach „Weiter“ folgt gleich die nächste Übung. Oben im Ablauf zählt „Zeit m:ss“ hoch, wie lange das Programm schon läuft. Die Reihenfolge der Übungen änderst du auf der Startseite mit „Reihenfolge ändern“ (▲▼); sie wird gemerkt. Antippen einer Übung in der Liste zeigt ihre Technik-Animation. Die App ist immer dunkel.
Alle Daten bleiben auf dem Gerät (gespeicherte Einstellungen: Reihenfolge und Dosen der Übungen, Schlüssel `mob_order`, `mob_doses`). Keine Konten, kein Tracking, kein Server.

- Abgeleitet aus dem Workout Tracker (`ST0PTV/Workout-Tracker`), aber als eigener, eingefrorener Stand mit eigenem Link.
- Kein Krafttraining, keine Statistik, kein Streak. Nur so weit bewegen, wie es angenehm ist.
- Dauerangaben sind eine Konvention (3 s pro Wiederholung), keine Messwerte.

## Technik-Animationen
Die Figur und die Bewegungsabläufe stammen aus dem Workout Tracker (dort gezeichnet, mit Quellen geprüft). Hier werden sie nur übernommen:
`node tools/sync-anim.mjs <Pfad zum Workout-Tracker-Checkout>` kopiert die Engine und die gewählten Animationen (nach `anim` in `js/data.js`),
blendet Hanteln aus und entfernt Kernpunkte, die nur Gewichte betreffen (`tools/mobility-adapt.js`). Die erzeugten Dateien nicht von Hand ändern.

## Entwickeln und prüfen
```
npm run check    # Syntax
npm test         # Logik (Node)
PLAYWRIGHT_MODULE=<Ordner von playwright> node tests/browser-check.mjs [Screenshot-Ordner]
```
Bei jeder Änderung an Dateien `CACHE_VERSION` in `sw.js` hochzählen, sonst bleibt auf den Geräten der alte Stand im Cache.

Veröffentlichung über GitHub Pages (Branch `main`, Ordner `/`).

Ab 1.3.0 hat jede der 13 Übungen eine Animation. Für Stuhl-Kniebeuge, Türrahmen-Push-up, Balanceboard-Wadenheben und Hüftkreisen liegen keine Messstudien mit Gelenkwinkeln vor: Die Karten sind als „Übertragen“ bzw. „Zeichenkonvention“ gekennzeichnet.
