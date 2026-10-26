// Browser-Check (Playwright): Startseite, Dauer ändern, Ablauf, Zeitübung, Ende; Hell und Dunkel; keine Konsolenfehler.
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
  ok(/Mobilitätsprogramm/.test(t) && /13 Übungen/.test(t) && /15 min/.test(t) && /Starten/.test(t), `${scheme}: Startseite mit 15 min`);
  ok(!/≈|Schätzung|object HTML|undefined|NaN/.test(t), `${scheme}: keine ≈, Schätzung oder undefined`);
  ok(/Stuhl/.test(t) && /Balanceboard/.test(t), `${scheme}: Geräteliste`);
  if (shots) await p.screenshot({ path: `${shots}/mob-${scheme}-home.png` });
  ok(/Pause dazwischen 10 s/.test(t) && /Wiederholungen bleiben gleich/.test(t), `${scheme}: Pause 10 s bei 15 min, Hinweis zu den Wiederholungen`);
  ok(await p.getByRole('button', { name: 'Kürzer' }).isDisabled(), `${scheme}: kürzer als 15 min nicht möglich`);
  await p.getByRole('button', { name: 'Länger' }).click();
  t = await txt();
  ok(/20 min/.test(t) && /Pause dazwischen 35 s/.test(t) && /20×/.test(t) && !/2[1-9]×|[3-9]\d×/.test(t), `${scheme}: + ergibt 20 min, längere Pause, Wiederholungen bleiben 20 (${t.match(/Pause dazwischen \d+ s/)})`);
  await p.getByRole('button', { name: 'Länger' }).click();
  ok(/25 min/.test(await txt()), `${scheme}: nochmal + ergibt 25 min`);
  await p.reload(); await p.waitForTimeout(200);
  ok(/25 min/.test(await txt()), `${scheme}: Dauer bleibt nach Neuladen`);
  await p.getByRole('button', { name: /Zurück auf 15 min/ }).click();
  ok(/15 min/.test(await txt()), `${scheme}: zurück auf 15 min`);
  await p.getByRole('button', { name: 'Starten' }).click(); await p.waitForTimeout(250);
  t = await txt();
  ok(/Übung 1 von 13/.test(t) && /Bizeps-Curl/.test(t) && /20×/.test(t), `${scheme}: Ablauf startet mit Bizeps-Curl 20×`);
  if (shots) await p.screenshot({ path: `${shots}/mob-${scheme}-run.png` });
  await p.getByRole('button', { name: 'Weiter', exact: true }).click(); await p.waitForTimeout(200);
  t = await txt();
  ok(/Pause nach 1 von 13/.test(t) && /Kurz ausruhen/.test(t) && /Als Nächstes: Schulterdrücken/.test(t) && /von 0:10/.test(t), `${scheme}: Pause-Schritt mit Zeitring (10 s) und nächster Übung`);
  if (shots) await p.screenshot({ path: `${shots}/mob-${scheme}-rest.png` });
  for (let i = 0; i < 11; i++) await p.getByRole('button', { name: 'Weiter', exact: true }).click();
  await p.waitForTimeout(300);
  t = await txt();
  ok(/Übung 7 von 13/.test(t) && /Hüftkreisen/.test(t) && /von 1:00/.test(t), `${scheme}: Hüftkreisen mit 1:00-Zähler`);
  if (shots) await p.screenshot({ path: `${shots}/mob-${scheme}-timer.png` });
  await p.getByRole('button', { name: 'Pause' }).click();
  ok(/Weiter zählen/.test(await txt()), `${scheme}: Pause funktioniert`);
  await p.getByRole('button', { name: 'Zurück', exact: true }).click();
  ok(/Pause nach 6 von 13/.test(await txt()), `${scheme}: Zurück`);
  for (let i = 0; i < 14; i++) await p.getByRole("button", { name: /^(Weiter|Fertig)$/ }).click();
  t = await txt();
  ok(/Geschafft/.test(t) && !/Serie|Streak|Tage in Folge/i.test(t), `${scheme}: Ende ohne Streak-Druck`);
  if (shots) await p.screenshot({ path: `${shots}/mob-${scheme}-done.png` });
  await p.getByRole('button', { name: 'Fertig' }).click(); await p.waitForTimeout(250);
  ok(/Mobilitätsprogramm/.test(await txt()), `${scheme}: zurück zur Startseite`);
  // Animationen: jede Übung mit Animation zeigt Figur und Kernpunkte (ohne Gewichte), die anderen nur Text.
  await p.getByRole('button', { name: 'Starten' }).click(); await p.waitForTimeout(250);
  const seen = [];
  for (let i = 0; i < 25; i++) {
    const info = await p.evaluate(() => ({ h2: document.querySelector('.run-card h2')?.textContent, svg: document.querySelectorAll('.anim-svg').length, kps: document.querySelectorAll('.anim-kp').length, db: document.querySelectorAll('.an-db').length }));
    if (info.h2 !== 'Kurz ausruhen') seen.push(info);
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
