// Übernimmt die Animations-Engine und ausgewählte Animationen aus dem Workout Tracker (Repo ST0PTV/Workout-Tracker).
// Aufruf: node tools/sync-anim.mjs <Pfad zum Workout-Tracker-Checkout>
// Erzeugt/aktualisiert: js/motion.js, js/motion-front.js, js/motion-female.js, js/anim-bar.js, js/anim-view.js (angepasst),
// js/anim-data.js (nur die gewählten Animationen), js/pool-shim.js (Muskeln und Namen je Übung), js/util.js, js/icons.js, js/sheet.js.
// Die Animationen selbst werden nur im Workout Tracker gezeichnet und geprüft; hier nur kopiert (kein eigener Stand).
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { EXERCISES } from '../js/data.js';

const main = path.resolve(process.argv[2] || '');
if (!main || !fs.existsSync(path.join(main, 'js/anim-data.js'))) { console.error('Pfad zum Workout-Tracker-Checkout fehlt.'); process.exit(1); }
const out = (f) => path.join(path.dirname(new URL(import.meta.url).pathname), '..', f);
const read = (f) => fs.readFileSync(path.join(main, f), 'utf8');
const write = (f, s) => fs.writeFileSync(out(f), s);

// Übung der Mobility-App → Referenz in der Haupt-App (Animation und Pool-Eintrag)
export const REFS = Object.fromEntries(Object.entries(EXERCISES).filter(([, e]) => e.anim).map(([k, e]) => [k, e.anim]));
const wanted = new Set(Object.values(REFS));

// ---- einfache Dateien ----
for (const f of ['motion.js', 'motion-front.js', 'motion-female.js', 'anim-bar.js', 'util.js', 'icons.js', 'sheet.js']) write(`js/${f}`, read(`js/${f}`));

// ---- anim-view.js: Importe ersetzen, Gewichte ausblenden ----
let view = read('js/anim-view.js');
const rep = (from, to) => { if (!view.includes(from)) throw new Error(`anim-view.js: Stelle nicht gefunden: ${from.slice(0, 60)}`); view = view.replace(from, to); };
rep("import { poolEntry as poolOnly } from './pool.js';\nimport { ITEM_BY_REF } from './routine-data.js';", "import { poolEntry } from './pool-shim.js';");
rep("const poolEntry = (ref) => poolOnly(ref) || ITEM_BY_REF[ref] || null;\n", "");
rep("import { MUSCLES } from './model.js';\nimport * as store from './store.js';", "import { MUSCLES } from './pool-shim.js';");
rep("const figureSex = () => (store.get('settings')?.figure === 'female' ? 'female' : 'male');", "const figureSex = () => 'male';");
// Übungen ohne Gewicht: Kurzhanteln (db, dumbbell) werden nicht gezeichnet und nicht in die Begrenzung gerechnet.
rep("    for (const s of pose.scene) {\n      if (s.noBounds)", "    for (const s of pose.scene) {\n      if (s.type === 'db' || s.type === 'dumbbell') continue; // Mobility: ohne Gewicht\n      if (s.noBounds)");
rep("  for (const s of scene) {\n    const front", "  for (const s of scene) {\n    if (s.type === 'db' || s.type === 'dumbbell') continue; // Mobility: ohne Gewicht\n    const front");
// Mobility: der Hinweis "Mittelwerte aus kleinen Studien" entfällt (Wunsch des Nutzers).
rep("    list,\n    h('p', { class: 'muted small' }, 'Mittelwerte aus kleinen Studien – Orientierung, keine Vorgabe.'));", "    list);");
write('js/anim-view.js', view);

// ---- anim-data.js: nur gewählte Animationen ----
const src = read('js/anim-data.js');
const startMark = 'export const ANIMATIONS = [';
const a0 = src.indexOf(startMark);
if (a0 < 0) throw new Error('ANIMATIONS nicht gefunden');
let i = a0 + startMark.length, depth = 1, entryStart = -1;
const entries = [];
const closers = { '(': ')', '[': ']', '{': '}' };
const stack = [];
let endIdx = -1;
while (i < src.length) {
  const c = src[i], n = src[i + 1];
  if (c === '/' && n === '/') { i = src.indexOf('\n', i); if (i < 0) break; continue; }
  if (c === '/' && n === '*') { i = src.indexOf('*/', i) + 2; continue; }
  if (c === "'" || c === '"') { const q = c; i++; while (src[i] !== q) { if (src[i] === '\\') i++; i++; } i++; continue; }
  if (c === '`') { i++; let d = 0; while (!(src[i] === '`' && d === 0)) { if (src[i] === '\\') { i += 2; continue; } if (src[i] === '$' && src[i + 1] === '{') { d++; i += 2; continue; } if (src[i] === '}' && d > 0) d--; i++; } i++; continue; }
  if (c === '{' || c === '[' || c === '(') { if (depth === 1 && c === '{') entryStart = i; depth++; stack.push(closers[c]); i++; continue; }
  if (c === '}' || c === ']' || c === ')') {
    depth--; stack.pop();
    if (depth === 1 && c === '}') entries.push(src.slice(entryStart, i + 1));
    if (depth === 0) { endIdx = i; break; }
    i++; continue;
  }
  i++;
}
if (endIdx < 0) throw new Error('Ende von ANIMATIONS nicht gefunden');
const refOf = (e) => (e.match(/\bref:\s*'([^']+)'/) || [])[1];
const mainCount = (src.slice(a0).match(/^ {2}\{\s*$/gm) || []).length;
const kept = entries.filter((e) => wanted.has(refOf(e)));
const missing = [...wanted].filter((r) => !kept.some((e) => refOf(e) === r));
if (missing.length) throw new Error(`Animation nicht in der Haupt-App: ${missing.join(', ')}`);
console.log(`Animationen in der Haupt-App: ${entries.length} (Zeilenzählung ${mainCount}), übernommen: ${kept.length}`);
write('js/anim-data.js', `${src.slice(0, a0)}${startMark}\n  ${kept.join(',\n  ')}\n${src.slice(endIdx)}\n${fs.readFileSync(out('tools/mobility-adapt.js'), 'utf8')}`);

// ---- pool-shim.js: Name und Muskeln je Referenz aus dem Pool der Haupt-App ----
const poolMod = await import(pathToFileURL(path.join(main, 'js/pool.js')).href);
const modelMod = await import(pathToFileURL(path.join(main, 'js/model.js')).href);
const routineMod = await import(pathToFileURL(path.join(main, 'js/routine-data.js')).href);
const pool = {};
for (const ref of wanted) {
  const p = (poolMod.POOL || poolMod.default || []).find?.((x) => x.ref === ref) || poolMod.poolEntry?.(ref) || routineMod.ITEM_BY_REF?.[ref]; // 1.3.0: Mobility-Übungen ohne Poolplatz (Hüftkreisen) aus dem Routine-Katalog
  if (!p) throw new Error(`Pool-Eintrag fehlt: ${ref}`);
  pool[ref] = { name: p.name, muscles: { primary: p.muscles.primary, secondary: p.muscles.secondary } };
}
write('js/pool-shim.js', `// Erzeugt von tools/sync-anim.mjs – nicht von Hand ändern.\nexport const POOL = ${JSON.stringify(pool, null, 2)};\nexport const poolEntry = (ref) => POOL[ref] || null;\nexport const MUSCLES = ${JSON.stringify(modelMod.MUSCLES, null, 2)};\n`);
console.log('fertig');
