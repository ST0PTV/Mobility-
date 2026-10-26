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
  await p.getByRole('button', { name: 'Länger' }).click();
  ok(/20 min/.test(await txt()), `${scheme}: + ergibt 20 min`);
  await p.getByRole('button', { name: 'Kürzer' }).click(); await p.getByRole('button', { name: 'Kürzer' }).click();
  ok(/10 min/.test(await txt()), `${scheme}: − ergibt 10 min`);
  await p.reload(); await p.waitForTimeout(200);
  ok(/10 min/.test(await txt()), `${scheme}: Dauer bleibt nach Neuladen`);
  await p.getByRole('button', { name: /Zurück auf 15 min/ }).click();
  ok(/15 min/.test(await txt()), `${scheme}: zurück auf 15 min`);
  await p.getByRole('button', { name: 'Starten' }).click(); await p.waitForTimeout(250);
  t = await txt();
  ok(/Übung 1 von 13/.test(t) && /Bizeps-Curl/.test(t) && /20×/.test(t), `${scheme}: Ablauf startet mit Bizeps-Curl 20×`);
  if (shots) await p.screenshot({ path: `${shots}/mob-${scheme}-run.png` });
  for (let i = 0; i < 6; i++) await p.getByRole('button', { name: 'Weiter', exact: true }).click();
  await p.waitForTimeout(300);
  t = await txt();
  ok(/Übung 7 von 13/.test(t) && /Hüftkreisen/.test(t) && /von 1:00/.test(t), `${scheme}: Hüftkreisen mit 1:00-Zähler`);
  if (shots) await p.screenshot({ path: `${shots}/mob-${scheme}-timer.png` });
  await p.getByRole('button', { name: 'Pause' }).click();
  ok(/Weiter zählen/.test(await txt()), `${scheme}: Pause funktioniert`);
  await p.getByRole('button', { name: 'Zurück', exact: true }).click();
  ok(/Übung 6 von 13/.test(await txt()), `${scheme}: Zurück`);
  for (let i = 0; i < 8; i++) await p.getByRole('button', { name: /^(Weiter|Fertig)$/ }).click();
  t = await txt();
  ok(/Geschafft/.test(t) && !/Serie|Streak|Tage in Folge/i.test(t), `${scheme}: Ende ohne Streak-Druck`);
  if (shots) await p.screenshot({ path: `${shots}/mob-${scheme}-done.png` });
  await p.getByRole('button', { name: 'Fertig' }).click(); await p.waitForTimeout(250);
  ok(/Mobilitätsprogramm/.test(await txt()), `${scheme}: zurück zur Startseite`);
  ok(errs.length === 0, `${scheme}: keine Konsolenfehler ${errs.slice(0, 2).join(' | ')}`);
  await p.context().close();
}
await b.close(); srv.close();
console.log(fails ? `\n${fails} Prüfung(en) fehlgeschlagen` : '\nalle Prüfungen bestanden');
process.exit(fails ? 1 : 0);
