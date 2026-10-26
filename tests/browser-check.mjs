// Browser-Check (Playwright): Startseite, Pause in der Leiste (gemerkt), Ablauf mit Pausen-Leiste, Zeitübung, Ende; Hell und Dunkel; keine Konsolenfehler.
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
  ok(!/Mittelwerte aus kleinen Studien/.test(t), `${scheme}: keine Studien-Texte`);
  // 1.3.3: keine Pausen-Einstellung auf der Startseite; die App merkt sich die in der Pausen-Leiste eingestellte Zeit
  ok(!/Pause|−|\+/.test(t) && await p.getByRole('button', { name: /Pause (kürzer|länger)/ }).count() === 0, `${scheme}: keine Pausen-Einstellung auf der Startseite`);
  ok(/20×/.test(t) && !/2[1-9]×|[3-9]\d×/.test(t), `${scheme}: Wiederholungen bleiben 20`);
  await p.getByRole('button', { name: 'Starten' }).click(); await p.waitForTimeout(250);
  t = await txt();
  ok(/Übung 1 von 13/.test(t) && /Bizeps-Curl/.test(t) && /20×/.test(t) && !/Als Nächstes/.test(t), `${scheme}: Ablauf startet mit Bizeps-Curl 20×, ohne Pausen-Leiste`);
  if (shots) await p.screenshot({ path: `${shots}/mob-${scheme}-run.png` });
  await p.getByRole('button', { name: 'Weiter', exact: true }).click(); await p.waitForTimeout(300);
  t = await txt();
  ok(/Übung 2 von 13/.test(t) && /Schulterdrücken/.test(t) && /0:10/.test(t) && /Als Nächstes: Schulterdrücken/.test(t) && !/Kurz ausruhen/.test(t), `${scheme}: nach „Weiter“ nächste Übung mit Pausen-Leiste unten`);
  const geo = await p.evaluate(() => { const r = document.querySelector('.restbar').getBoundingClientRect(); const d = document.querySelector('.dock').getBoundingClientRect(); const row = document.querySelector('.btn-row').getBoundingClientRect(); return { rb: Math.round(r.bottom), top: Math.round(row.top), dockBottom: Math.round(d.bottom), h: innerHeight }; });
  ok(geo.dockBottom === geo.h && geo.rb <= geo.top, `${scheme}: Pausen-Leiste und Tasten fest am unteren Rand`);
  if (shots) await p.screenshot({ path: `${shots}/mob-${scheme}-rest.png` });
  await p.getByRole('button', { name: 'Pause 15 Sekunden länger' }).click();
  ok(/0:(2[0-5])/.test(await p.evaluate(() => document.querySelector('.rt-time').textContent)), `${scheme}: +15 verlängert die Pause (10 → 25 s)`);
  await p.getByRole('button', { name: 'Pause 15 Sekunden kürzer' }).click();
  ok(/0:(1[0-5])/.test(await p.evaluate(() => document.querySelector('.rt-time').textContent)), `${scheme}: −15 verkürzt wieder (25 → 10 s)`);
  await p.getByRole('button', { name: 'Pause beenden' }).click();
  ok(await p.evaluate(() => !document.querySelector('.restbar')), `${scheme}: Schließen entfernt die Pausen-Leiste`);
  for (let i = 0; i < 5; i++) await p.getByRole('button', { name: 'Weiter', exact: true }).click();
  await p.waitForTimeout(300);
  t = await txt();
  ok(/Übung 7 von 13/.test(t) && /Hüftkreisen/.test(t) && /von 1:00/.test(t) && /1:00/.test(t), `${scheme}: Hüftkreisen wartet während der Pause (Ring zeigt 1:00)`);
  if (shots) await p.screenshot({ path: `${shots}/mob-${scheme}-timer.png` });
  await p.waitForTimeout(11600);
  t = await txt();
  ok(/Pause vorbei/.test(t) && /0:5[6-9]/.test(t), `${scheme}: Pause vorbei, danach läuft der 1:00-Zähler`);
  await p.getByRole('button', { name: 'Pause beenden' }).click();
  await p.getByRole('button', { name: 'Pause', exact: true }).click();
  ok(/Weiter zählen/.test(await txt()), `${scheme}: Pause-Taste der Zeitübung funktioniert`);
  await p.getByRole('button', { name: 'Zurück', exact: true }).click();
  ok(/Übung 6 von 13/.test(await txt()) && !(await p.evaluate(() => !!document.querySelector('.restbar'))), `${scheme}: Zurück ohne Pausen-Leiste`);
  for (let i = 0; i < 8; i++) await p.getByRole("button", { name: /^(Weiter|Fertig)$/ }).click();
  t = await txt();
  ok(/Geschafft/.test(t) && !/Serie|Streak|Tage in Folge/i.test(t), `${scheme}: Ende ohne Streak-Druck`);
  if (shots) await p.screenshot({ path: `${shots}/mob-${scheme}-done.png` });
  await p.getByRole('button', { name: 'Fertig' }).click(); await p.waitForTimeout(250);
  ok(/Mobilitätsprogramm/.test(await txt()), `${scheme}: zurück zur Startseite`);
  // gemerkte Pause: in der Leiste +15 → beim nächsten Start (auch nach Neuladen) läuft die Pause mit 25 s; Schließen ändert den Wert nicht
  await p.getByRole('button', { name: 'Starten' }).click(); await p.waitForTimeout(250);
  await p.getByRole('button', { name: 'Weiter', exact: true }).click(); await p.waitForTimeout(250);
  await p.getByRole('button', { name: 'Pause 15 Sekunden länger' }).click();
  await p.getByRole('button', { name: 'Pause beenden' }).click();
  await p.getByRole('button', { name: 'Weiter', exact: true }).click(); await p.waitForTimeout(250);
  ok(/0:2[0-5]/.test(await p.evaluate(() => document.querySelector('.rt-time').textContent)), `${scheme}: weitere Pausen im selben Ablauf nutzen die gemerkte Zeit (25 s)`);
  await p.reload(); await p.waitForTimeout(250);
  await p.getByRole('button', { name: 'Starten' }).click(); await p.waitForTimeout(250);
  await p.getByRole('button', { name: 'Weiter', exact: true }).click(); await p.waitForTimeout(250);
  ok(/0:2[0-5]/.test(await p.evaluate(() => document.querySelector('.rt-time').textContent)), `${scheme}: gemerkte Pause gilt beim nächsten Start nach Neuladen (25 s)`);
  await p.getByRole('button', { name: 'Pause 15 Sekunden kürzer' }).click();
  await p.reload(); await p.waitForTimeout(250);
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
