// Browser-Check (Playwright): Startseite, Reihenfolge ändern, Ablauf ohne Pausen, Ablauf mit Pausen-Leiste, Zeitübung, Ende; System hell und dunkel (App immer dunkel); keine Konsolenfehler.
// Aufruf: node tests/browser-check.mjs [Ordner für Screenshots]
import { createRequire } from 'node:module';
// Keine Abhängigkeit im Repo: Playwright wird in der Umgebung gesucht (PLAYWRIGHT_MODULE = Ordner des Pakets).
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const shots = process.argv[2] || null;
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png' };
const srv = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
  const f = path.join(root, p);
  if (!f.startsWith(root) || !fs.existsSync(f)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); res.end(fs.readFileSync(f));
});
await new Promise((r) => srv.listen(0, r));
const url = `http://localhost:${srv.address().port}/`;
let fails = 0;
const ok = (c, m) => { console.log(`${c ? 'ok  ' : 'FAIL'} ${m}`); if (!c) fails++; };

const ANIM_COUNT = 13; // alle 13 Übungen haben seit 1.3.0 eine Animation
const EXPECT_NO_ANIM = '';
const b = await chromium.launch();
for (const scheme of ['dark', 'light']) {
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, colorScheme: scheme, serviceWorkers: 'block' })).newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e)));
  p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto(url); await p.waitForTimeout(300);
  const txt = () => p.evaluate(() => document.getElementById('view').innerText);
  let t = await txt();
  ok(/Mobilitätsprogramm/.test(t) && /13 Übungen/.test(t) && /Starten/.test(t), `${scheme}: Startseite mit Titel, 13 Übungen und Starten`);
  ok(await p.evaluate(() => ['body', '.btn', '.view'].every((q) => getComputedStyle(document.querySelector(q)).touchAction === 'manipulation')), `${scheme}: kein Doppeltipp-Zoom (touch-action: manipulation), Pinch bleibt möglich`);
  // 1.3.2: Karte nur noch Titel, Anzahl, Pause −/+ und Starten (Nutzer); Hilfetexte, Geräteliste, Gesamtzeit und „Zurück auf“ entfernt
  ok(!/rund \d+ min|ohne Gewicht ·|Du brauchst|Wiederholungen bleiben gleich|Zurück auf/.test(t), `${scheme}: keine Zusatztexte auf der Startseite`);
  ok(!/≈|Schätzung|object HTML|undefined|NaN/.test(t), `${scheme}: keine ≈, Schätzung oder undefined`);
  ok(/Übungen/.test(t) && /Bizeps-Curl/.test(t) && /Hüftkreisen/.test(t), `${scheme}: Übersicht der Übungen bleibt`);
  if (shots) await p.screenshot({ path: `${shots}/mob-${scheme}-home.png` });
  // 1.3.4: App immer dunkel, auch bei hellem System
  ok(await p.evaluate(() => getComputedStyle(document.body).backgroundColor === 'rgb(0, 0, 0)' && getComputedStyle(document.querySelector('.card')).backgroundColor === 'rgb(28, 28, 30)'), `${scheme}: App ist dunkel (System ${scheme})`);
  // 1.3.4: Technik direkt aus der Liste der Startseite
  await p.getByRole('button', { name: /^Hüftkreisen, Technik ansehen/ }).click(); await p.waitForTimeout(250);
  const ex = await p.evaluate(() => ({ t: document.getElementById('view').innerText, svg: document.querySelectorAll('.anim-svg').length, kps: document.querySelectorAll('.anim-kp').length, hash: location.hash }));
  ok(ex.hash === '#/ex/6' && /Übung 7 von 13/.test(ex.t) && /Hüftkreisen/.test(ex.t) && ex.svg === 1 && ex.kps >= 2, `${scheme}: Tipp auf eine Übung der Liste zeigt Technik-Animation und Kernpunkte`);
  if (shots) await p.screenshot({ path: `${shots}/mob-${scheme}-tech.png` });
  await p.getByRole('button', { name: 'Nächste' }).click(); await p.waitForTimeout(200);
  ok(/Übung 8 von 13/.test(await txt()) && /Balanceboard/.test(await txt()), `${scheme}: „Nächste“ zeigt die folgende Übung`);
  await p.getByRole('button', { name: 'Zur Übersicht' }).click(); await p.waitForTimeout(200);
  ok(/Mobilitätsprogramm/.test(await txt()) && await p.evaluate(() => document.querySelectorAll('.anim-svg').length === 0), `${scheme}: „Zur Übersicht“ führt zur Startseite zurück`);
  ok(!/Mittelwerte aus kleinen Studien/.test(t), `${scheme}: keine Studien-Texte`);
  // 1.3.5: keine Pausen (weder Einstellung noch Leiste), Wiederholungen bleiben 20
  ok(!/Pause|−|\+/.test(t) && await p.getByRole('button', { name: /Pause/ }).count() === 0, `${scheme}: keine Pausen-Einstellung auf der Startseite`);
  ok(/20×/.test(t) && !/2[1-9]×|[3-9]\d×/.test(t), `${scheme}: Wiederholungen bleiben 20`);
  // 1.3.5: Reihenfolge mit ▲▼ auf der Startseite ändern, gemerkt nach Neuladen, gilt im Ablauf
  const first = () => p.evaluate(() => document.querySelector('.card.list .row .t').textContent);
  ok(await first() === 'Bizeps-Curl ohne Gewicht', `${scheme}: Grundreihenfolge beginnt mit Bizeps-Curl`);
  await p.getByRole('button', { name: 'Reihenfolge ändern' }).click(); await p.waitForTimeout(150);
  ok(await p.getByRole('button', { name: /Technik ansehen/ }).count() === 0 && await p.getByRole('button', { name: 'Nach oben: Bizeps-Curl ohne Gewicht' }).isDisabled(), `${scheme}: Bearbeiten-Modus zeigt ▲▼, oberste Übung kann nicht höher`);
  const arrowBox = await p.getByRole('button', { name: 'Nach unten: Bizeps-Curl ohne Gewicht' }).boundingBox();
  ok(arrowBox.width >= 44 && arrowBox.height >= 44, `${scheme}: ▲▼-Tasten groß genug (${Math.round(arrowBox.width)}×${Math.round(arrowBox.height)})`);
  if (shots) await p.screenshot({ path: `${shots}/mob-${scheme}-order.png` });
  await p.getByRole('button', { name: 'Nach unten: Bizeps-Curl ohne Gewicht' }).click(); await p.waitForTimeout(150);
  ok(await first() === 'Schulterdrücken ohne Gewicht', `${scheme}: ▼ schiebt Bizeps-Curl auf Platz 2`);
  // 1.3.6: Verschieben springt nicht nach oben – Scrollposition bleibt
  await p.evaluate(() => { document.getElementById('view').scrollTop = 400; });
  const sBefore = await p.evaluate(() => document.getElementById('view').scrollTop);
  await p.getByRole('button', { name: 'Nach unten: Bizeps-Curl ohne Gewicht' }).click(); await p.waitForTimeout(150);
  const sAfter = await p.evaluate(() => document.getElementById('view').scrollTop);
  ok(sBefore > 100 && Math.abs(sAfter - sBefore) <= 2, `${scheme}: Scrollposition bleibt beim Verschieben (${sBefore} → ${sAfter})`);
  await p.getByRole('button', { name: 'Nach oben: Bizeps-Curl ohne Gewicht' }).click(); await p.waitForTimeout(150);
  await p.getByRole('button', { name: 'Fertig', exact: true }).click(); await p.waitForTimeout(150);
  await p.reload(); await p.waitForTimeout(250);
  ok(await first() === 'Schulterdrücken ohne Gewicht', `${scheme}: Reihenfolge bleibt nach Neuladen`);
  await p.getByRole('button', { name: 'Starten' }).click(); await p.waitForTimeout(250);
  ok(/Übung 1 von 13/.test(await txt()) && /Schulterdrücken/.test(await txt()), `${scheme}: Ablauf folgt der neuen Reihenfolge`);
  await p.getByRole('button', { name: 'Beenden' }).click(); await p.waitForTimeout(200);
  await p.getByRole('button', { name: 'Reihenfolge ändern' }).click(); await p.waitForTimeout(150);
  await p.getByRole('button', { name: 'Nach oben: Bizeps-Curl ohne Gewicht' }).click(); await p.waitForTimeout(150);
  await p.getByRole('button', { name: 'Fertig', exact: true }).click(); await p.waitForTimeout(150);
  ok(await first() === 'Bizeps-Curl ohne Gewicht', `${scheme}: ▲ stellt die Grundreihenfolge wieder her`);
  await p.getByRole('button', { name: 'Starten' }).click(); await p.waitForTimeout(250);
  t = await txt();
  ok(/Übung 1 von 13/.test(t) && /Bizeps-Curl/.test(t) && /20×/.test(t) && /Zeit 0:0\d/.test(t) && !/noch \d|Als Nächstes/.test(t), `${scheme}: Ablauf startet mit Bizeps-Curl 20× und zählt die Zeit hoch („Zeit 0:0x“)`);
  if (shots) await p.screenshot({ path: `${shots}/mob-${scheme}-run.png` });
  await p.getByRole('button', { name: 'Weiter', exact: true }).click(); await p.waitForTimeout(300);
  t = await txt();
  ok(/Übung 2 von 13/.test(t) && /Schulterdrücken/.test(t) && await p.evaluate(() => !document.querySelector('.restbar, .rt-time')), `${scheme}: nach „Weiter“ gleich die nächste Übung, keine Pausen-Leiste`);
  for (let i = 0; i < 5; i++) await p.getByRole('button', { name: 'Weiter', exact: true }).click();
  await p.waitForTimeout(2300);
  t = await txt();
  ok(/Übung 7 von 13/.test(t) && /Hüftkreisen/.test(t) && /von 1:00/.test(t) && /0:5[5-8]/.test(t), `${scheme}: Hüftkreisen zählt sofort herunter (1:00 → ${(t.match(/0:5\d/) || ['?'])[0]})`);
  ok(/Zeit 0:0[3-9]|Zeit 0:[1-5]\d/.test(t), `${scheme}: Gesamtzeit läuft hoch`);
  if (shots) await p.screenshot({ path: `${shots}/mob-${scheme}-timer.png` });
  await p.getByRole('button', { name: 'Pause', exact: true }).click();
  ok(/Weiter zählen/.test(await txt()), `${scheme}: Pause-Taste der Zeitübung funktioniert`);
  await p.getByRole('button', { name: 'Zurück', exact: true }).click();
  ok(/Übung 6 von 13/.test(await txt()), `${scheme}: Zurück zeigt die vorige Übung`);
  for (let i = 0; i < 8; i++) await p.getByRole("button", { name: /^(Weiter|Fertig)$/ }).click();
  t = await txt();
  ok(/Geschafft/.test(t) && !/Serie|Streak|Tage in Folge/i.test(t), `${scheme}: Ende ohne Streak-Druck`);
  if (shots) await p.screenshot({ path: `${shots}/mob-${scheme}-done.png` });
  await p.getByRole('button', { name: 'Fertig' }).click(); await p.waitForTimeout(250);
  ok(/Mobilitätsprogramm/.test(await txt()), `${scheme}: zurück zur Startseite`);
  // 1.3.7: Türrahmen-Push-up mit flachen Füßen (Sicht kontrolliert per Bild); Animation läuft ohne Fehler
  await p.getByRole('button', { name: /^Türrahmen-Push-up, Technik ansehen/ }).click(); await p.waitForTimeout(600);
  ok(await p.evaluate(() => document.querySelectorAll('.anim-svg').length === 1) && /Türrahmen-Push-up/.test(await txt()), `${scheme}: Türrahmen-Push-up zeigt die Animation`);
  if (shots) await p.screenshot({ path: `${shots}/mob-${scheme}-door.png` });
  await p.getByRole('button', { name: 'Zur Übersicht' }).click(); await p.waitForTimeout(200);
  // 1.3.6: Wiederholungen in der Technik-Ansicht ändern (5er-Schritte), gemerkt, gelten in Liste und Ablauf; Hüftkreisen in 15-s-Schritten
  await p.getByRole('button', { name: /^Bizeps-Curl ohne Gewicht, Technik ansehen/ }).click(); await p.waitForTimeout(250);
  ok(/20×/.test(await txt()) && await p.getByRole('button', { name: 'Mehr: Bizeps-Curl ohne Gewicht' }).isEnabled(), `${scheme}: Technik-Ansicht zeigt 20× mit − und +`);
  await p.getByRole('button', { name: 'Mehr: Bizeps-Curl ohne Gewicht' }).click(); await p.waitForTimeout(250);
  ok(/25×/.test(await txt()) && await p.evaluate(() => document.querySelectorAll('.anim-svg').length === 1), `${scheme}: + ergibt 25×, Animation bleibt`);
  if (shots) await p.screenshot({ path: `${shots}/mob-${scheme}-dose.png` });
  const db = await p.getByRole('button', { name: 'Mehr: Bizeps-Curl ohne Gewicht' }).boundingBox();
  ok(db.width >= 44 && db.height >= 44, `${scheme}: +/−-Tasten groß genug (${Math.round(db.width)}×${Math.round(db.height)})`);
  await p.getByRole('button', { name: 'Zur Übersicht' }).click(); await p.waitForTimeout(200);
  ok(/Bizeps-Curl ohne Gewicht\s*25×/.test(await txt()), `${scheme}: Liste zeigt 25×`);
  await p.reload(); await p.waitForTimeout(250);
  ok(/Bizeps-Curl ohne Gewicht\s*25×/.test(await txt()), `${scheme}: 25× bleibt nach Neuladen`);
  await p.getByRole('button', { name: 'Starten' }).click(); await p.waitForTimeout(250);
  ok(/Bizeps-Curl/.test(await txt()) && /25×/.test(await txt()), `${scheme}: Ablauf nutzt 25×`);
  await p.getByRole('button', { name: 'Beenden' }).click(); await p.waitForTimeout(200);
  await p.getByRole('button', { name: /^Hüftkreisen, Technik ansehen/ }).click(); await p.waitForTimeout(250);
  await p.getByRole('button', { name: 'Länger: Hüftkreisen' }).click(); await p.waitForTimeout(250);
  ok(/1:15/.test(await p.evaluate(() => document.querySelector('.dur-value').textContent)), `${scheme}: Hüftkreisen +15 s = 1:15`);
  await p.getByRole('button', { name: 'Kürzer: Hüftkreisen' }).click(); await p.waitForTimeout(150);
  await p.getByRole('button', { name: 'Zur Übersicht' }).click(); await p.waitForTimeout(200);
  await p.getByRole('button', { name: /^Bizeps-Curl ohne Gewicht, Technik ansehen/ }).click(); await p.waitForTimeout(250);
  await p.getByRole('button', { name: 'Weniger: Bizeps-Curl ohne Gewicht' }).click(); await p.waitForTimeout(150);
  await p.getByRole('button', { name: 'Zur Übersicht' }).click(); await p.waitForTimeout(200);
  ok(/Bizeps-Curl ohne Gewicht\s*20×/.test(await txt()) && /Hüftkreisen\s*1:00/.test(await txt()), `${scheme}: zurück auf 20× und 1:00`);
  // Animationen: jede Übung mit Animation zeigt Figur und Kernpunkte (ohne Gewichte), die anderen nur Text.
  await p.getByRole('button', { name: 'Starten' }).click(); await p.waitForTimeout(250);
  const seen = [];
  for (let i = 0; i < 13; i++) {
    const info = await p.evaluate(() => ({ h2: document.querySelector('.run-card h2')?.textContent, svg: document.querySelectorAll('.anim-svg').length, kps: document.querySelectorAll('.anim-kp').length, db: document.querySelectorAll('.an-db').length }));
    seen.push(info);
    await p.getByRole('button', { name: /^(Weiter|Fertig)$/ }).click(); await p.waitForTimeout(60);
  }
  const withAnim = seen.filter((x) => x.svg === 1);
  ok(seen.length === 13 && withAnim.length === ANIM_COUNT && withAnim.every((x) => x.kps >= 2 && x.db === 0), `${scheme}: ${ANIM_COUNT} von 13 Übungen mit Animation, Kernpunkte, keine Hanteln (${withAnim.length})`);
  ok(seen.filter((x) => x.svg === 0).map((x) => x.h2).join('|') === EXPECT_NO_ANIM, `${scheme}: Übungen ohne Animation: ${seen.filter((x) => x.svg === 0).map((x) => x.h2).join(', ')}`);
  await p.getByRole('button', { name: 'Fertig' }).click(); await p.waitForTimeout(250);
  ok(errs.length === 0, `${scheme}: keine Konsolenfehler ${errs.slice(0, 2).join(' | ')}`);
  await p.context().close();
}
await b.close(); srv.close();
console.log(fails ? `\n${fails} Prüfung(en) fehlgeschlagen` : '\nalle Prüfungen bestanden');
process.exit(fails ? 1 : 0);
