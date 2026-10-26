// Übungsanimationen (v2.0): Keyframes, Phasen, Kernpunkte und Quellen je Übung – Daten, kein DOM.
// Jeder Zahlenwert trägt seine Herkunft: V(wert, quellen, lesart). Lesarten (READ): wie der Wert gelesen wurde.
// Winkelkonvention siehe js/motion.js. Alle Werte sind Gruppenmittel kleiner Studien, keine Vorgabe für die eigene Technik.
// Recherche: Drive „Research - Animations“ (2026-10-14), Rohdaten im claude.ai-Projekt (claude/v2-animation-research/).
import { LEN, ARM_REACH, solvePose, anchor, shapesFor, tf } from './motion.js';
import { solveFront, layersFront } from './motion-front.js';

export const ANIM_CHECKED_AT = '2026-10-14';

// Lesart eines Werts
export const READ = {
  fulltext: 'Volltext',
  abstract: 'Abstract',
  summary: 'automatische Seitenzusammenfassung – noch nicht am PDF geprüft',
  computed: 'berechnet aus Studienwerten',
  ik: 'aus der Geometrie gelöst, nicht gemessen',
  protocol: 'Vorgabe im Studienprotokoll, nicht gemessen',
  figure: 'aus einer Abbildung abgelesen (Schätzung)',
  convention: 'Zeichenkonvention, nicht gemessen'
};
// Datenbasis einer Animation
export const BASIS = {
  measured: { label: 'Gemessen', text: 'Die Gelenkwinkel der Endpositionen stammen aus Bewegungsmessungen in Studien (3D-Motion-Capture, Sensoren oder Goniometer). Fehlende Winkel sind aus der Geometrie berechnet und so gekennzeichnet.' },
  protocol: { label: 'Nach Studienprotokoll', text: 'Keine Studie hat die Bewegung gemessen. Die Winkel sind Vorgaben aus Studienprotokollen.' },
  convention: { label: 'Zeichenkonvention', text: 'Keine Studie hat die Bewegung gemessen oder Winkel vorgegeben. Gerät und Winkel folgen einem üblichen Aufbau und sind Zeichenkonvention.' },
  transfer: { label: 'Übertragen', text: 'Die Winkel stammen aus einer anderen Variante oder einem anderen Gerät und sind übertragen.' }
};
export const STATUS = { consensus: 'Konsens', contested: 'umstritten', single: 'Einzelstudie', convention: 'Konvention' };
export const TEMPO_BASIS = { measured: 'gemessen', protocol: 'Studienprotokoll', computed: 'aus Studienwerten berechnet', convention: 'Konvention' };

const V = (v, src, read, raw) => ({ v, src: [].concat(src || []), read, raw: raw || null });
const C = (v, raw) => V(v, [], 'convention', raw); // Konvention
const K = (v, src, raw) => V(v, src, 'computed', raw);
const PLATE = 46; // Hantelscheibe Ø 45 cm → Radius 0.225 m ≈ 46 Einheiten (1 m ≈ 204.6 Einheiten)
// Stangenpositionen beim Kreuzheben (Weltkoordinaten, Knöchel bei x = 0, Ballen bei x = 30): Start über dem Mittelfuß am Schienbein,
// auf Kniehöhe vor der Kniescheibe, oben am Oberschenkel. Konvention; Stangenweg ≈ 8 Einheiten (≈ 4 cm) nach hinten, vgl. Hancock et al. 2012.
const STEP = 28; // Stufe beim Wadenheben (≈ 14 cm): Oberkante bei y = −28, nur unter dem Vorfuß (x 16–38), Ballen bei x = 30
const PU = { grip: 62, bar: -330 }; // Klimmzugstange: Hände bei ±62 (1,5-fache Biakromialbreite ≈ 82 Einheiten), Stange auf 1,6 m
// Sumo-Kniebeuge (Frontansicht, v2.9): Knöchelmitte bei ±52 (≈ 0,51 m Fußabstand; Protokolle 1,5-fache Trochanterbreite bis 169 % Schulterbreite), Fußöffnung 32° (Konvention).
// Das räumlich gelöste Bein ergibt unten ≈ 36° Winkel des Oberschenkels zur Sagittalebene; Sinclair et al. 2022 berichten 23,2° Hüftabduktion (Tabelle, ungeprüft; andere Winkeldefinition).
// Arme: Hände an der Stange außerhalb der Schultern, Ellbogen unten (projiziert, Konvention).
const SUMO = { stance: C(52, 'Fußabstand ≈ 0,51 m; im Bereich der Protokolle (1,5-fache Trochanterbreite bis 169 % Schulterbreite)'), toeOut: V(26, 'S2', 'fulltext', 'Fußwinkel 26 ± 4° (breiter Stand, Escamilla et al. 2001, Tabelle 2); das Knie folgt der Ebene Hüfte–Knöchel'), arms: { elbow: [30, 44], wrist: [46, 4] } };
// ---------- Runde 3.1 (v2.9): Geräte und gelöste Winkel ----------
const dir2 = (a) => [Math.sin(a * Math.PI / 180), -Math.cos(a * Math.PI / 180)]; // Richtung von senkrecht-oben, nach vorn positiv
// Multipresse: Stange läuft senkrecht über dem Punkt, den die gemessene Endstellung unten ergibt (Kotiuk et al. 2022).
// Oben und in der Mitte wird die Schienbeinneigung so gelöst, dass die Stange über demselben x liegt (Bisektion).
const SMITH_BAR = [-8, 15]; // Stange auf dem oberen Trapez, in Rumpfkoordinaten ab dem Schultergelenk (wie Kniebeuge hochstabig)
function smithBarX(spec) { const P = solvePose(spec); return trunkPoint(P, SMITH_BAR[0], SMITH_BAR[1])[0]; }
function smithShank(knee, hip, x) {
  let lo = -30, hi = 30;
  for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (smithBarX({ shank: m, knee, hip }) > x) hi = m; else lo = m; }
  return Math.round((lo + hi) / 2 * 10) / 10;
}
const SMITH_X = smithBarX({ shank: 4.46, knee: 94.42, hip: 106.28 });
const SMITH = { x: SMITH_X, shank: [smithShank(4, 6, SMITH_X), smithShank(50, 58, SMITH_X)] };
// Hack Squat: Schlitten 45°, Hüfte läuft auf einer Linie parallel zum Rumpf. Für jede Kniebeugung wird die Schienbeinneigung
// so gelöst, dass die Hüfte auf dieser Linie liegt (Knöchel fest auf der Plattform). Plattform 24 hoch (≈ 12 cm), vorn um 20° angehoben; Konvention.
const HACK_T = -45;
function hackHip(shank, knee) { // Hüfte relativ zum Knöchel bei Rumpf −45°
  const k = dir2(shank), K = [k[0] * LEN.shank, k[1] * LEN.shank]; const t = dir2(shank - knee);
  return [K[0] + t[0] * LEN.thigh, K[1] + t[1] * LEN.thigh];
}
function hackSolve(knee, line) { // line: { p, d } Punkt und Richtung der Hüftbahn
  const off = (sh) => { const h = hackHip(sh, knee); return (h[0] - line.p[0]) * line.d[1] - (h[1] - line.p[1]) * line.d[0]; };
  let lo = -40, hi = 70, flo = off(lo);
  for (let i = 0; i < 50; i++) { const m = (lo + hi) / 2, fm = off(m); if (flo * fm <= 0) hi = m; else { lo = m; flo = fm; } }
  return Math.round((lo + hi) / 2 * 10) / 10;
}
const HACK_TOP = { knee: 5, shank: -35 }; // oben liegt der ganze Körper etwa in der Schlittenlinie, die Füße stehen weit vorn
const HACK_LINE = { p: hackHip(HACK_TOP.shank, HACK_TOP.knee), d: dir2(HACK_T) };
const HACK = { plat: 24, top: HACK_TOP, bottom: { knee: 100, shank: hackSolve(100, HACK_LINE) } };
// Runde 3.2 (v2.9): Good Morning – Schienbein so gelöst, dass die Stange über dem Mittelfuß bleibt (x = 13, Konvention).
function barShank(spec, off, x) {
  let lo = -30, hi = 40;
  const bx = (s) => trunkPoint(solvePose({ ...spec, shank: s }), off[0], off[1])[0];
  const dec = bx(lo) > bx(hi); // Richtung des Zusammenhangs
  for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if ((bx(m) > x) !== dec) hi = m; else lo = m; }
  return Math.round((lo + hi) / 2 * 10) / 10;
}
// v2.15.0: Good Morning – Schienbein so gelöst, dass der gemeinsame Schwerpunkt von Körper und Stange über dem Mittelfuß liegt (vorher: die Stange
// selbst). Das hielt die Stange zu weit hinten: Schienbein −21°, Oberschenkel stark nach hinten gekippt, die Hüfte „sackte“ nach hinten weg.
// Segmentmassen nach Dempster (Anteile am Körpergewicht, Trainingswissen, nicht nachgeprüft): Rumpf 0,497, Kopf 0,081, Arme 0,1, Oberschenkel 0,2,
// Unterschenkel 0,093, Füße 0,029; Stange 0,5 × Körpergewicht (Konvention, Vigotsky et al. 2015 nennen die Last nur in % 1RM).
function comShank(spec, off, barMass, x) {
  const lerp = (p, q, u) => [p[0] + (q[0] - p[0]) * u, p[1] + (q[1] - p[1]) * u];
  const cx = (s) => {
    const P = solvePose({ ...spec, shank: s }), J = P.joints, bar = trunkPoint(P, off[0], off[1]);
    const parts = [[0.497, lerp(J.shoulder, J.hip, 0.5)], [0.081, lerp(J.hip, J.shoulder, 1.25)], [0.1, J.shoulder], [0.2, lerp(J.hip, J.knee, 0.433)], [0.093, lerp(J.knee, J.ankle, 0.433)], [0.029, [J.ankle[0] + 10, J.ankle[1]]], [barMass, bar]];
    let m = 0, sx = 0; for (const [w, q] of parts) { m += w; sx += w * q[0]; }
    return sx / m - x;
  };
  return Math.round(bisect(cx, -40, 30) * 10) / 10;
}
const GM = { shank: [comShank({ knee: 4, hip: 4 }, [-8, 15], 0.5, 13), comShank({ knee: 20.1, hip: 100.7 }, [-8, 15], 0.5, 13)] };
// Glute Bridge: Rückenlage, Füße flach (Knöchel bei x = 0). Unten liegen Schultern (y = −20) und Hüftgelenk (y = −26) am Boden,
// oben bleibt die Schulter an derselben Stelle und Schulter–Hüfte–Knie bilden eine Linie (Hüfte 0°). Verschachtelte Bisektion.
function bisect(f, lo, hi) { let flo = f(lo); for (let i = 0; i < 50; i++) { const m = (lo + hi) / 2, fm = f(m); if (flo * fm <= 0) hi = m; else { lo = m; flo = fm; } } return (lo + hi) / 2; }
const BRIDGE = (() => {
  const P = (sp) => solvePose({ ...sp, foot: 90 }), r = (v) => Math.round(v * 10) / 10;
  const hipAt = (s) => bisect((h) => P({ shank: s, knee: 90, hip: h }).joints.shoulder[1] + 20, -20, 140);
  const sB = bisect((s) => P({ shank: s, knee: 90, hip: hipAt(s) }).joints.hip[1] + 26, -85, 10), hB = hipAt(sB);
  const X = P({ shank: sB, knee: 90, hip: hB }).joints.shoulder[0];
  const shankAt = (k) => bisect((s) => P({ shank: s, knee: k, hip: 0 }).joints.shoulder[1] + 20, -85, 20);
  const kT = bisect((k) => P({ shank: shankAt(k), knee: k, hip: 0 }).joints.shoulder[0] - X, 30, 140);
  return { bottom: { shank: r(sB), hip: r(hB) }, top: { shank: r(shankAt(kT)), knee: r(kT) }, headTop: r(-90 - P({ shank: shankAt(kT), knee: kT, hip: 0 }).angles.trunk) };
})();
// Rückenstrecken 45°: Fußplatte 30 hoch (≈ 15 cm), Beine 45° geneigt (Konvention). Kickback: Turm vor der Figur, Rolle unten (Konvention).
const BACKEXT = { plat: 30 };
const KICK = { tower: 150, pulley: -20, hand: [78, 46] }; // Hand relativ zur Schulter, hält den Griff am Turm
// v2.10: Das arbeitende Bein ist das nahe (vorn gezeichnete) Bein; das Standbein ist das zweite Bein und steht per IK fest am Boden.
// Hüfte und Standfuß entsprechen der bisherigen Pose (Standbein: Schienbein 4°, Knie 8°, Rumpf 25°).
KICK.pose = { root: 'hip', rootPos: [-0.6, -182.6], trunk: C(25), leg2: { ankle: [0, -15], foot: C(90, 'Fuß flach'), kneeSide: 1 }, armTarget: KICK.hand, elbow: C(20) };
// Runde 3.3 (v2.9): gemeinsame Liegeposition auf der Flachbank (wie Bankdrücken) und auf der Negativbank (−15°, Beine eingehakt).
const BENCH_POSE = () => ({ root: 'shoulder', rootPos: [0, -102], trunk: C(-90, 'liegend'), hip: C(-6), knee: C(99), foot: C(90, 'Fuß flach') });
const DECLINE_POSE = () => ({ root: 'shoulder', rootPos: [0, -96], trunk: V(-105, 'C1', 'protocol', 'Bank −15° (Kopf tiefer als die Hüfte)'), hip: C(35, 'Beine unter den Rollen eingehakt'), knee: C(95), foot: C(120) });
// Step-up: Box 40 cm ≈ 82 Einheiten (Bruenger et al. 2012: 38,7–41,3 cm, Knie und Sprunggelenk je 90°).
const STEPUP = { box: 82 };
// Goblet Squat: Kurzhantel senkrecht vor dem Brustbein, Hände unter dem oberen Kopf (Konvention).
const GOBLET = { at: [34, -34], hand: [30, -30] }; // v2.15.0: Hantel an der Brust, Handgelenk unter dem oberen Kopf (Hände umfassen ihn von unten); Unterarm verkürzt (zeigt nach innen zur Hantel), damit er fast senkrecht steht
// v2.15.0: Frontkniebeuge – Handgelenk an der Stange vor der Schulter (Rumpfkoordinaten), Ellbogen vorn; Unterarm verkürzt gezeichnet (zeigt schräg nach innen).
const FSQ_HAND = [20, 6], FSQ_SIDE = 1;
const DL_BAR = { start: [16, -PLATE], knee: [14, -95], top: [8, -150] };

// Hantelscheibe an einem Punkt (Seitenansicht) – als Szene-Objekt
const plate = (at, r = PLATE) => ({ type: 'plate', at, r });
// Kurzhantel in echter Größe (v2.9): Griffmitte „at“, Achse „dir“ (Einheitsvektor in der Bildebene) oder endOn (Achse zeigt aus dem Bild).
// Maße sind Konvention (übliche Kurzhantel 10–20 kg): Länge ≈ 38 cm, Kopf ≈ 14 cm hoch und ≈ 10 cm breit, Griff ≈ 13 cm.
const DB = { len: 78, hr: 14.5, hw: 20 };
const db = (at, dir = [1, 0], endOn = false) => ({ type: 'db', at, dir, endOn });
// Umriss der Kurzhantel als SVG-Pfad: zwei Köpfe und der Griff dazwischen (für Ansicht und Prüfwerkzeuge)
export function dumbbellPath(s) {
  const [x, y] = s.at;
  if (s.endOn) { const r = DB.hr; return `M${x - r} ${y}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`; }
  const d = s.dir, n = [-d[1], d[0]], f = (v) => Math.round(v * 10) / 10;
  const box = (c0, c1, h) => { const p = [[c0, -h], [c1, -h], [c1, h], [c0, h]].map(([a, b]) => [x + d[0] * a + n[0] * b, y + d[1] * a + n[1] * b]); return 'M' + p.map((q) => `${f(q[0])} ${f(q[1])}`).join('L') + 'Z'; };
  const e = DB.len / 2;
  return box(-e, -e + DB.hw, DB.hr) + box(e - DB.hw, e, DB.hr) + box(-e + DB.hw, e - DB.hw, 2.2);
}
export function dumbbellBox(s) { const e = s.endOn ? DB.hr : DB.len / 2 + DB.hr; return [s.at[0] - e, s.at[1] - e, s.at[0] + e, s.at[1] + e]; }

// ---------- Runde 4 (v2.10): Ruderfamilie – Geometrie aus der Pose berechnet ----------
const unit2 = (v) => { const l = Math.hypot(v[0], v[1]) || 1; return [v[0] / l, v[1] / l]; };
// Einarmiges Rudern: Standbein vorn (Wurzel), Knie und Hand der fernen Seite auf der Bank (Oberkante y = −92 ≈ 45 cm).
const ONE_ROW = (() => {
  const t = 70, base = { shank: 5, knee: 15, trunk: t }, P = solvePose(base), h = P.joints.hip, s = P.joints.shoulder;
  const k2y = -103, dx = Math.sqrt(LEN.thigh ** 2 - (k2y - h[1]) ** 2); // Kniemitte ≈ 11 über der Bank, Schienbein liegt auf
  const a = Math.acos(Math.min(1, (-100 - s[1]) / (LEN.uarm + LEN.farm))) * 180 / Math.PI; // Stützarm gestreckt, Handfläche auf der Bank
  return {
    bench: [h[0] - 70, s[0] + 75],
    pose: {
      shank: C(5), ankle: C(5, 'Fuß flach'), knee: C(15, 'Standbein leicht gebeugt'), trunk: C(t, 'Rumpf ≈ 20° über der Waagerechten (Stützarm gestreckt auf der Bank)'),
      leg2: { ankle: [h[0] + dx - LEN.shank, k2y + 1], foot: C(205, 'Fuß hängt hinter der Bank'), kneeSide: 1 },
      arm2: { shoulder: C(t + a, 'Stützarm gestreckt, Hand auf der Bank'), elbow: C(0) }, handFlat2: 1
    }
  };
})();
// T-Bar: Stange im Drehpunkt am Boden hinter der Figur; Hände folgen dem Kreisbogen (Radius ≈ 1,85 m).
const TBAR = (() => {
  const pose = { shank: C(8), ankle: C(8, 'Fuß flach'), knee: V(20, 'R1', 'protocol', '„Beine leicht gebeugt“ (Langhantelrudern, übertragen)'), trunk: C(55, 'Oberkörper deutlich vorgeneigt; Winkel nicht gemessen (Konvention)') };
  const P0 = solvePose({ shank: 8, ankle: 8, knee: 20, trunk: 55, armPlumb: true, elbow: 0 });
  const bottom = P0.joints.wrist, R = 380, py = -10;
  const pivot = [bottom[0] - Math.sqrt(R * R - (bottom[1] - py) ** 2), py];
  const c = trunkPoint(P0, 36, -68), u = unit2([c[0] - pivot[0], c[1] - pivot[1]]); // Griff am unteren Brustkorb
  return { pose, pivot, R, bottom: bottom.map((x) => Math.round(x * 10) / 10), top: [pivot[0] + R * u[0], pivot[1] + R * u[1]].map((x) => Math.round(x * 10) / 10), side: 1 };
})();
// Brustgestütztes Rudern: Polster 45°, Füße auf einer Fußplatte; Hebel mit Drehpunkt vor und über den Händen.
const CSR = (() => {
  const pose = { rootPos: [0, -23], shank: C(15), knee: C(25), trunk: C(45, 'Polster 45°; 30–45° Bank ergäben 60–45° Rumpf (Konvention)') };
  const a = solvePose({ ...{ rootPos: [0, -23], shank: 15, knee: 25, trunk: 45 }, shoulder: 45, elbow: 0 }).joints.hand;
  const b = solvePose({ ...{ rootPos: [0, -23], shank: 15, knee: 25, trunk: 45 }, shoulder: -5, elbow: 105.4 }).joints.hand;
  const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], d = [b[0] - a[0], b[1] - a[1]];
  const px = m[0] + 200, py = m[1] - (px - m[0]) * d[0] / d[1]; // auf der Mittelsenkrechten: beide Endlagen gleich weit vom Drehpunkt
  return { pose, pivot: [px, py] };
})();
// Rudermaschine sitzend: Drehpunkt der Hebel über dem Kopf, auf der Mittelsenkrechten der beiden Griffpositionen.
const MROW = (() => {
  const base = { root: 'hip', rootPos: [0, -95], trunk: 0, hip: 90, knee: 90 };
  const a = solvePose({ ...base, shoulder: 61.1, elbow: 5.9 }).joints.hand, b = solvePose({ ...base, shoulder: -5, elbow: 105.4 }).joints.hand;
  const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], d = [b[0] - a[0], b[1] - a[1]];
  const py = -330, px = m[0] - (py - m[1]) * d[1] / d[0];
  return { pose: { root: 'hip', rootPos: [0, -95], trunk: V(0, 'S2', 'protocol', 'aufrecht'), hip: C(90), knee: C(90), foot: C(90, 'Füße flach') }, pivot: [px, py] };
})();
// Rudern im Hang: Stange auf Hüfthöhe (y = −185 ≈ 90 cm), Fersen am Boden; Wurzel ist der Knöchel, das Handgelenk bleibt per IK an der Stange.
// Oben ist die Brust ≈ 10 cm (20 Einheiten) unter der Stange (Brustvorderseite 31 vor der Rumpfachse, 45 unter der Schulter; McGill et al. 2014) → Rumpfwinkel oben und Fersenposition;
// unten sind die Arme gestreckt (Schulter–Handgelenk = Armlänge) → Rumpfwinkel unten. Der Körper dreht dabei um die Fersen.
const INV = (() => {
  const bar = [0, -185], grip = [0, -178], ay = -15.5; // Handgelenk ≈ 7 unter der Stangenmitte
  const pose0 = (t, ax = 0) => solvePose({ root: 'ankle', rootPos: [ax, ay], trunk: t, hip: 0, knee: 0, armWorld: grip });
  const chest = (t) => trunkPoint(pose0(t), 51, -45);
  const top = bisect((t) => chest(t)[1] - bar[1], -89, -20), ax = bar[0] - chest(top)[0];
  const low = bisect((t) => { const s = pose0(t, ax).joints.shoulder; return Math.hypot(s[0] - grip[0], s[1] - grip[1]) - 121.5; }, -89, top);
  const r1 = (x) => Math.round(x * 10) / 10;
  return { bar, grip, low: r1(low), top: r1(top), pose: { root: 'ankle', rootPos: [r1(ax), ay], hip: V(0, 'V1', 'protocol', 'Körperlinie gerade'), knee: C(0), armWorld: grip, elbowSide: 1 } };
})();

// ---------- Runde 5 (v2.11): Zugfamilie und hintere Schulter ----------
// Klimmzug im Untergriff (Seitenansicht): Wurzel ist das Handgelenk an der Stange; der Rumpf ist je Bild so gewählt,
// dass der Mittelpunkt von Schulter, Hüfte und Knie unter den Händen hängt (grobes Zeichenmodell für den Körperschwerpunkt).
const CHIN = (() => {
  const grip = [0, PU.bar + 7], base = { root: 'wrist', rootPos: grip, hip: 0, knee: 90, elbowSide: -1 };
  const solveT = (tgt) => { const ps = (t) => solvePose({ ...base, trunk: t, armTarget: tgt }); const t = bisect((x) => { const J = ps(x).joints; return (J.shoulder[0] + J.hip[0] + J.knee[0]) / 3 - grip[0]; }, -60, 60); return { t, P: ps(t) }; };
  const hang = [6, -121], top = [34, -16]; // unten fast gestreckt über der Schulter; oben Stange vor dem Hals, Schulter ≈ 34 dahinter und ≈ 23 unter der Stange → Kinn über der Stange
  const r1 = (x) => Math.round(x * 10) / 10;
  return { grip, hang, top, tHang: r1(solveT(hang).t), tTop: r1(solveT(top).t), elbowTop: r1(solveT(top).P.angles.elbow) };
})();
// Latzug eng/neutral (Seitenansicht): sitzend, Oberschenkel unter dem Polster; Umlenkrolle über dem Griff in Startstellung.
const CGP = { hip: [0, -100], start: [18, -121], mid: [50, -56], end: [38, 12], lean: -10, leanMid: -5 }; // v2.15.0: lean = leichte Rücklage an der Brust (Konvention)
// v2.20.0: Mittelbild – die Hände laufen in einem Bogen vor dem Gesicht vorbei (Griff ≈ 12 cm vor der Nase). Vorher fuhren sie senkrecht nach unten
// und glitten auf Gesichtshöhe nur ≈ 2 cm vor der Nase durch das Gesicht. Die Oberarme zeigen dabei fast waagerecht nach vorn (aus der Geometrie).
const CGP_PULLEY_X = Math.round(solvePose({ root: 'hip', rootPos: CGP.hip, trunk: 0, hip: 90, knee: 90, foot: 90 }).joints.shoulder[0] + CGP.start[0] + 8);
// Überzüge am Kabel (Seitenansicht): Turm vor der Figur, obere Rolle auf ≈ 2,05 m.
const SAP = { tower: 240, pulley: [228, -420] };
// Reverse Butterfly (Frontansicht): sitzend; Arme vorn auf Schulterhöhe (in der Projektion fast ein Punkt) bis seitlich in Linie mit dem Rumpf.
const RPD = { seat: -105, start: { elbow: [6, 6], wrist: [8, 12] }, end: { elbow: [67, 6], wrist: [119, 10] } };
// Sitzende Maschinen in der Frontansicht (v2.25.0): Reverse Butterfly, Butterfly, Seitheben an der Maschine (alle Sitzhöhe RPD.seat = MLR.seat). Bis v2.24.0 lagen die
// Oberschenkel nur verkürzt hinter Rumpf und Sitz, die Knie waren nicht zu sehen (die Figur wirkte wie im Stehen). Jetzt wie bei den Hüftmaschinen (HIPM): Beine vor dem
// Rumpf gezeichnet, Oberschenkel waagerecht zum Betrachter (stark verkürzt, Knie ≈ 24 Einheiten unter der Hüfte, leicht nach außen), Unterschenkel etwas verkürzt –
// die Verkürzung ist so gewählt, dass die Füße auf dem Boden stehen (Zeichenkonvention, keine Messung).
const SEAT_LEGS = (() => {
  const R = Math.PI / 180, legs = { thighDir: 8, thighF: 0.28, shankDir: -3 };
  const shankF = (-14.4 - (RPD.seat + LEN.thigh * legs.thighF * Math.cos(legs.thighDir * R))) / (LEN.shank * Math.cos(legs.shankDir * R));
  return { ...legs, shankF: Math.round(shankF * 1000) / 1000 };
})();
// Butterfly mit Armpolstern (Frontansicht, v2.25.0): Oberarm Richtung az (0° = nach vorn, 90° = zur Seite, negativ = über die Mitte hinaus),
// Unterarm senkrecht am Polster. Projektion: dx = Oberarmlänge · sin(az) – die Ellbogen laufen auf einem Bogen (Bilder gleichmäßig im Winkel) und stehen am Ende
// vor der Brust (≈ 12 cm von der Mitte), nicht neben den Schultern wie bis v2.24.0 (dort wirkten die Arme hinter den Rücken geführt). Der Ellbogen sinkt dabei
// von 6 auf 16 Einheiten unter die Schulter (Oberarm am Ende ≈ 14° unter der Waagerechten): bei genau waagerechtem Arm schrumpft der Oberarm im Bild zum Punkt und seine
// Richtung dreht beim Durchgang durch die Schulterlinie sprunghaft (Stetigkeitstest: 11° pro Bild).
const PECD = (() => {
  const R = Math.PI / 180, r1 = (v) => Math.round(v * 10) / 10;
  return { az: [90, 63, 37, 11, -12], arm: (az) => { const dx = r1(LEN.uarm * Math.sin(az * R)), dy = r1(6 + 10 * (90 - az) / 102); return { elbow: [dx, dy], wrist: [dx, dy - 54] }; } };
})();

// ---------- Runde 6 (v2.11): Armbeuger ----------
// Griffmitte zwischen Handgelenk und Handende (dort sitzt Stange oder Hantel)
const gripOf = (P) => [(P.joints.wrist[0] + P.joints.hand[0]) / 2, (P.joints.wrist[1] + P.joints.hand[1]) / 2];
const CURL_PLATE = 26; // kleine Scheiben (Ø ≈ 25 cm) an der SZ-Stange, Konvention
// Bayesian Curl: Rücken zum Turm, Oberarm 45° hinter dem Rumpf. Rolle so gesetzt, dass Seil und Unterarm bei 61,5° Ellbogenbeugung senkrecht stehen
// (Lage des größten Drehmoments in Attarieh et al. 2025); der Turm steht ≈ 83 cm hinter der Figur (Konvention).
const BAY = (() => {
  const P = solvePose({ shank: 0, knee: 3, ankle: 0, trunk: 0, shoulder: -45, elbow: 61.5 }), g = gripOf(P), d = P.F.farm.d;
  let c = [-d[1], d[0]]; if (c[0] > 0) c = [-c[0], -c[1]]; // senkrecht zum Unterarm, nach hinten
  const tower = -170, px = tower + 8, k = (px - g[0]) / c[0];
  return { tower, pulley: [px, Math.round((g[1] + c[1] * k) * 10) / 10] };
})();

// ---------- Runde 7 (v2.11): Schultern ----------
// Aufrechtes Rudern (Frontansicht): Griff 100 % der Schulterbreite (Hände unter den Schultern); oben liegt die Stange am unteren Ende des Brustbeins
// (Protokoll McAllister et al. 2013). Mit diesem Griff und der Unterarmlänge erreichen die Ellbogen ≈ 62° Abduktion (aus der Geometrie, unter Schulterhöhe).
const URR = { grip: 0, start: { elbow: [4, 68], wrist: [0, 122] }, top: { elbow: [60.1, 31.8], wrist: [8, 46] } };
// Schulterdrücken an der Maschine (Seitenansicht): Lehne 75° → Rumpf 15° zurück; Hebel mit Drehpunkt hinter dem Kopf auf der Mittelsenkrechten der beiden Griffpositionen.
const MSP = (() => {
  const base = { root: 'hip', rootPos: [0, -98], trunk: -15, hip: 75, knee: 90, foot: 90 };
  const a = solvePose({ ...base, armPoints: { elbow: [14, 36], wrist: [20, -8] } }).joints.hand, b = solvePose({ ...base, armPoints: { elbow: [8, -50], wrist: [10, -102] } }).joints.hand;
  const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], d = [b[0] - a[0], b[1] - a[1]];
  const px = m[0] - 150, py = m[1] - (px - m[0]) * d[0] / d[1]; // beide Endlagen gleich weit vom Drehpunkt
  return { pivot: [Math.round(px), Math.round(py)] };
})();
// Seitheben am Kabel (Frontansicht): Turm auf der Gegenseite, Rolle auf Handhöhe (Larsen et al. 2025), Seil vor dem Körper.
const CLR = { tower: -150, pulleyY: -152 };

// ---------- Runde 8 (v2.12): Trizeps ----------
// Überkopf-Trizepsstrecken am Kabel: Rücken zum Turm (Mir et al. 2025), Turm ≈ 45 cm hinter der Figur, Rolle auf Hüfthöhe (Konvention).
const OHX = { tower: -95, pulley: [-87, -170] };
// Bankdips: Hand fest an der Bankkante (Oberkante y = −92), Ferse fest am Boden, Beine fast gestreckt.
// Rumpf, Schulter und Ellbogen je Keyframe → Hüfte (über die Wurzel „Handgelenk“); Knie per Zwei-Glieder-IK zur festen Ferse.
// Gezeichnet wird mit der Wurzel „Knöchel“ und armWorld, damit Hand und Ferse auch zwischen den Keyframes still stehen.
const BDIP = (() => {
  const W = [0, -98], hipOf = (k) => solvePose({ root: 'wrist', rootPos: W, trunk: k.trunk, shoulder: k.shoulder, elbow: k.elbow, hip: 80, knee: 0 }).joints.hip;
  const top = { trunk: 5, shoulder: -25, elbow: 10 }, bottom = { trunk: 12.6, shoulder: -88.1, elbow: 90 };
  const ht = hipOf(top), hb = hipOf(bottom), reach = LEN.thigh + LEN.shank - 0.2; // oben Knie ≈ 3°
  const A = [Math.round(ht[0] + Math.sqrt(reach ** 2 - (-15 - ht[1]) ** 2)), -15];
  const leg = (h) => { // Knöchel → Hüfte: Schienbein- und Kniewinkel (Knie nach oben)
    const v = [h[0] - A[0], h[1] - A[1]], L = Math.hypot(v[0], v[1]), D = 180 / Math.PI;
    const g = Math.acos(Math.min(1, (LEN.shank ** 2 + L * L - LEN.thigh ** 2) / (2 * LEN.shank * L))) * D;
    const aAH = Math.atan2(v[0], -v[1]) * D, aSup = aAH + g; // Knöchel → Knie
    const kn = [A[0] + LEN.shank * Math.sin(aSup / D), A[1] - LEN.shank * Math.cos(aSup / D)];
    const aTh = Math.atan2(kn[0] - h[0], -(kn[1] - h[1])) * D; // Hüfte → Knie
    return { shank: Math.round((aSup) * 10) / 10, knee: Math.round((aSup + 180 - aTh) * 10) / 10 };
  };
  return { W, A, top, bottom, legTop: leg(ht), legBottom: leg(hb), drop: Math.round((hb[1] - ht[1]) * 10) / 10 };
})();
// ---------- Runde 9 (v2.12): Fliegende ----------
// Arm im Raum → Frontansicht (armPoints relativ zur Schulter, dx nach außen, dy nach unten). e = Hebung aus dem Hängen
// (0° unten, 90° waagerecht, 180° oben), a = Richtung in der Waagerechten (0° nach vorn, 90° zur Seite, negativ = über die Körpermitte),
// b = leichte Ellbogenbeugung, Unterarm dreht nach innen/vorn. Die Tiefe (zum Betrachter) fällt weg; Arme vorn erscheinen verkürzt.
function armFront(e, a, b) {
  const R = Math.PI / 180, u = [Math.sin(e * R) * Math.sin(a * R), Math.cos(e * R), Math.sin(e * R) * Math.cos(a * R)];
  const p = [-Math.cos(a * R), 0, Math.sin(a * R)], cb = Math.cos(b * R), sb = Math.sin(b * R);
  const f = [u[0] * cb + p[0] * sb, u[1] * cb, u[2] * cb + p[2] * sb], n = Math.hypot(f[0], f[1], f[2]);
  const r1 = (v) => Math.round(v * 10) / 10, E = [LEN.uarm * u[0], LEN.uarm * u[1]];
  return { elbow: E.map(r1), wrist: [E[0] + LEN.farm * f[0] / n, E[1] + LEN.farm * f[1] / n].map(r1) };
}
// Kabelzug von unten nach oben (v2.25.0): die Arme laufen auf einem Bogen im Raum – Hebung e von 40° auf 85° und Richtung a von 70° (seitlich) auf −12° (über die Mitte),
// in sieben Bildern. Vorher drei Bilder: der zweite Abschnitt war fast doppelt so lang wie der erste (die Hände beschleunigten gegen Ende und bremsten vor „Oben“ ab).
// Die 2 s des Hebens sind auf die Abschnitte im Verhältnis ihres Wegs (Ellbogen + Handgelenk im Bild) verteilt: gleichmäßige Geschwindigkeit, weicher Start und Stopp nur an den Enden.
const LCF = (() => {
  const r1 = (v) => Math.round(v * 10) / 10;
  const q = Array.from({ length: 7 }, (_, i) => ({ e: r1(40 + 45 * i / 6), a: r1(70 - 82 * i / 6) }));
  const seg = q.slice(1).map((b, i) => { const A = armFront(q[i].e, q[i].a, 15), B = armFront(b.e, b.a, 15); return Math.hypot(B.elbow[0] - A.elbow[0], B.elbow[1] - A.elbow[1]) + Math.hypot(B.wrist[0] - A.wrist[0], B.wrist[1] - A.wrist[1]); });
  const T = seg.reduce((x, y) => x + y, 0);
  return { q, dur: seg.map((l) => Math.round(200 * l / T) / 100) };
})();
// Kabelturm-Paar (Frontansicht, Konvention): Türme bei x = ±170, Rollen 10 innen; oben ≈ 1,6 m, unten ≈ 20 cm.
const XOV = { tower: 170, high: -330, low: -40 };
// Dip-Maschine (sitzend): Griffe seitlich, Hebel mit Drehpunkt hinter der Figur auf der Mittelsenkrechten der beiden Griffpositionen (Konvention).
const DIPM = (() => {
  const base = { root: 'hip', rootPos: [0, -98], trunk: 0, hip: 90, knee: 90, foot: 90 };
  const a = solvePose({ ...base, shoulder: -35, elbow: 95 }).joints.hand, b = solvePose({ ...base, shoulder: -15, elbow: 20 }).joints.hand;
  const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], d = [b[0] - a[0], b[1] - a[1]];
  const px = m[0] - 150, py = m[1] - (px - m[0]) * d[0] / d[1];
  return { pivot: [Math.round(px), Math.round(py)] };
})();

// ---------- Runde 10 (v2.13): Bauch am Boden ----------
// Rückenlage auf einer Matte (6 Einheiten ≈ 3 cm, Konvention), Kopf links. Höhe des Hüftgelenks so gelöst, dass der tiefste Punkt
// des liegenden Körpers auf der Matte liegt. Rumpfbeugung über curl (js/motion.js): Crunch und Sit-up rollen den oberen Rumpf ein,
// beim Reverse Crunch und Beinheben bleibt der obere Rücken liegen (Wurzel Schulter, Rumpf −90 − curl) und das Becken rollt ein.
const MAT = 6;
const lowestY = (spec) => { const P = solvePose(spec); let m = -1e9; for (const sh of shapesFor('male')) if (sh.seg === 'trunk') for (const q of sh.pts) m = Math.max(m, tf(P, 'trunk', q)[1]); return m; }; // tiefster Konturpunkt des Rumpfs (Standardfigur; die weibliche liegt am Gesäß und Haarknoten bis ≈ 4,5 cm tiefer und drückt in die Matte)
const FLOOR = (() => {
  const r = (v) => Math.round(v * 10) / 10;
  // Liegewinkel: Rumpf so geneigt, dass Gesäß und Schulterblätter zugleich aufliegen (die Figur ist am Gesäß tiefer als am Rücken).
  const low = (t, f) => { const P = solvePose({ root: 'hip', rootPos: [0, 0], trunk: t, hip: 30, knee: 90 }); let m = -1e9; for (const sh of shapesFor('male')) if (sh.seg === 'trunk') for (const q of sh.pts) if (f(q)) m = Math.max(m, tf(P, 'trunk', q)[1]); return m; };
  const lie = r(bisect((t) => low(t, (q) => q[1] < -240) - low(t, (q) => q[1] > -215), -110, -85));
  const hipY = r(-MAT - lowestY({ root: 'hip', rootPos: [0, 0], trunk: lie, hip: 30, knee: 90, foot: 90, shoulder: 90 }));
  const sh = solvePose({ root: 'hip', rootPos: [0, hipY], trunk: lie, hip: 90, knee: 90 }).joints.shoulder.map(r);
  // Crunch-Start: Knie 90°, Hüfte so gelöst, dass der Fuß flach auf der Matte steht (Ballen auf Mattenhöhe).
  const hook = (h, x) => solvePose({ root: 'hip', rootPos: [0, hipY], trunk: lie, hip: h, knee: 90, foot: 90, ...x });
  const hookHip = r(bisect((h) => hook(h).joints.toe[1] + MAT + 2, 0, 90));
  const hookShank = r(hook(hookHip).segAngles.shank);
  // Crunch oben: so weit eingerollt, dass der untere Schulterblattrand (Anker back) ≈ 4 cm von der Ausgangslage abhebt.
  const back0 = anchor(hook(hookHip), 'back')[1];
  const crunchCurl = r(bisect((c) => anchor(hook(hookHip, { curl: c }), 'back')[1] - back0 + 8, 0, 70));
  return { lie, hipY, sh, hookHip, hookShank, crunchCurl };
})();
// Sit-up oben (Konvention): oberer Rumpf ≈ 15° über die Senkrechte, davon 20° Rumpfbeugung; die Ellbogen kommen damit etwa auf Kniehöhe.
const SITUP = { curlTop: 20, trunkTop: -5 };
// v2.14.1: Das Gesäß bleibt beim Aufrichten auf der Matte. Wurzel Knöchel (Füße fixiert, Knie 90°); das Schienbein neigt sich so, dass der tiefste
// Rumpfpunkt auf der Matte liegt (das Hüftgelenk sinkt beim Aufrichten um ≈ 8 cm und rutscht ein wenig zu den Füßen: Becken kippt nach vorn).
const SITUP_ROOT = (() => {
  const P0 = solvePose({ root: 'hip', rootPos: [0, FLOOR.hipY], trunk: FLOOR.lie, hip: FLOOR.hookHip, knee: 90, foot: 90 });
  const ank = P0.joints.ankle.map((v) => Math.round(v * 10) / 10);
  const at = (trunk, curl) => Math.round(bisect((sh) => lowestY({ root: 'ankle', rootPos: ank, shank: sh, knee: 90, foot: 90, trunk, curl }) + MAT, -75, -20) * 10) / 10;
  return { ank, at, midTrunk: Math.round(((FLOOR.lie + SITUP.trunkTop) / 2) * 10) / 10 };
})();


// ---------- Runde 11 (v2.16): Halteübungen und Liegestütz mit erhöhten Füßen ----------
// Gemeinsam: in die Position gehen, halten, ablegen. Kontaktstellen (Unterarm, Füße, Gesäß) sind gelöst, nicht geschätzt; Zeichenkonventionen
// sind in den Datensätzen so benannt. Matte wie in Runde 10 (MAT).
const r1 = (v) => Math.round(v * 10) / 10;
const lowSeg = (P, segs) => { let m = -1e9; for (const sh of shapesFor('male')) if (sh.id === 'body' && segs.includes(sh.seg)) for (const q of sh.pts) m = Math.max(m, tf(P, sh.seg, q)[1]); return m; };
// Unterarmstütz (Seitenansicht): Ellbogen senkrecht unter der Schulter, Unterarm flach (Gelenke 7 über der Matte), Zehen auf der Matte.
// Start: Becken abgelegt – Rumpf so geneigt, dass das Hüftgelenk 22 über der Matte liegt, Hüfte so gestreckt, dass die Zehen aufliegen.
const PLANK = (() => {
  const base = { root: 'wrist', rootPos: [60, -MAT - 7], armPoints: { elbow: [0, 68], wrist: [54, 68] }, knee: 0, foot: 165 };
  const hipFor = (t) => bisect((h) => solvePose({ ...base, trunk: t, hip: h }).joints.toe[1] + MAT, -80, 10);
  const tS = bisect((t) => solvePose({ ...base, trunk: t, hip: hipFor(t) }).joints.hip[1] + MAT + 22, 50, 95);
  const hold = solvePose({ ...base, hip: 0, solve: { param: 'trunk', joint: 'toe', y: -MAT, range: [60, 120] } });
  return { base, start: { trunk: r1(tS), hip: r1(hipFor(tS)) }, mat: [Math.round(hold.joints.toe[0] - 40), 140] };
})();
// Liegestütz mit erhöhten Füßen: Arme wie beim Liegestütz (Suprak et al. 2013), Füße auf einer Stufe von ≈ 40 cm (82 Einheiten, Konvention);
// unten so tief, dass der tiefste Rumpfpunkt (Kinn/Brust) ≈ 4 cm über dem Boden bleibt – mit erhöhten Füßen kippt der Kopf sonst in den Boden.
const FEPU = (() => {
  const BOX = 82, base = { root: 'wrist', rootPos: [0, -6], hip: 0, knee: 0, foot: 165, handFlat: 1 };
  const top = { elbow: [3, 54], wrist: [6, 104] }, bot = { elbow: [-14, 4], wrist: [10, 32] };
  const mix = (u) => ({ elbow: top.elbow.map((v, i) => r1(v + (bot.elbow[i] - v) * u)), wrist: top.wrist.map((v, i) => r1(v + (bot.wrist[i] - v) * u)) });
  const sp = (arm) => ({ ...base, armPoints: arm, solve: { param: 'trunk', joint: 'toe', y: -BOX, range: [60, 150] } });
  const u = bisect((x) => lowSeg(solvePose(sp(mix(x))), ['trunk']) + 8, 0, 1);
  const P0 = solvePose(sp(top));
  return { BOX, base, top, bottom: mix(u), depth: r1(u), toeX: Math.round(P0.joints.toe[0]), trunkTop: r1(P0.angles.trunk) };
})();
// Seitstütz und Copenhagen Plank: Frontfigur, um die Bildachse gedreht (rotate), Figur liegt auf der linken Seite (unten), rechte Seite oben.
// Unterer Oberarm im Bild senkrecht unter der Schulter, Unterarm zeigt zum Betrachter (kurz gezeichnet). armL.points: relativ zur Schulter,
// dx nach außen, dy nach unten (Körperrahmen). Ellbogen 8 und Knöchel 9 über der Matte (Dicke von Unterarm und Fußkante, Konvention).
const SIDE_DEG = Math.PI / 180;
const toBodyF = (r, v) => { const c = Math.cos(-r * SIDE_DEG), sn = Math.sin(-r * SIDE_DEG); return [v[0] * c - v[1] * sn, v[0] * sn + v[1] * c]; };
const armDownF = (r) => { const d = toBodyF(r, [0, 1]); const e = [-d[0] * LEN.uarm, d[1] * LEN.uarm]; return { elbow: e.map(r1), wrist: [r1(e[0]), r1(e[1] - 10)] }; };
const armToF = (r, sh, E) => { const v = toBodyF(r, [E[0] - sh[0], E[1] - sh[1]]); const e = [-v[0], v[1]]; return { pts: { elbow: e.map(r1), wrist: [r1(e[0]), r1(e[1] - 10)] }, len: Math.hypot(e[0], e[1]) }; };
const SIDEP = (() => {
  const AW = [120, -MAT - 9], EY = -MAT - 8;
  const spec = (r, lean, armL, armR = 4) => ({ view: 'front', rotate: r, trunk: lean, root: 'ankleL', rootPos: AW, legs: { stance: -9 }, arm: { abd: armR }, armL: { points: armL } });
  const rH = bisect((r) => solveFront(spec(r, 0, armDownF(r))).joints.elbowL[1] - EY, -95, -40);
  const PH = solveFront(spec(rH, 0, armDownF(rH))), E = [r1(PH.joints.elbowL[0]), EY];
  const at = (r, lean) => armToF(r, solveFront(spec(r, lean, { elbow: [68, 0], wrist: [68, -10] })).joints.shoulderL, E);
  // Start: Hüfte abgesenkt (Hüftgelenk 34 über der Matte, Becken nahe am Boden), Ellbogen und Füße bleiben, der Rumpf knickt seitlich
  const rS = bisect((r) => solveFront(spec(r, 0, armDownF(r))).joints.hipL[1] - (-MAT - 28), -100, -60);
  const leanS = bisect((l) => at(rS, l).len - LEN.uarm, -80, 0);
  return { hold: { rotate: r1(rH), trunk: 0, armL: armDownF(rH), armR: 4 }, start: { rotate: r1(rS), trunk: r1(leanS), armL: at(rS, leanS).pts, armR: r1(4 + leanS) }, AW, E };
})();
const COPEN = (() => {
  const HB = 90, EW = [-150, -MAT - 8]; // Bank ≈ 44 cm (Konvention; im Protokoll hält ein Partner das Bein)
  const spec = (r, lean, armL, abdL, root, rootPos, armR = 4) => ({ view: 'front', rotate: r, trunk: lean, root, rootPos, legs: { stance: -9, abdL }, arm: { abd: armR }, armL: { points: armL } });
  const rH = bisect((r) => solveFront(spec(r, 0, armDownF(r), -4, 'elbowL', EW)).joints.ankleR[1] - (-HB - 9), -100, -30);
  const PH = solveFront(spec(rH, 0, armDownF(rH), -4, 'elbowL', EW)), AR = PH.joints.ankleR.map(r1), KR = PH.joints.kneeR.map(r1);
  const startFor = (r) => {
    const at = (lean) => armToF(r, solveFront(spec(r, lean, { elbow: [68, 0], wrist: [68, -10] }, 0, 'ankleR', AR)).joints.shoulderL, EW);
    const lean = bisect((l) => at(l).len - LEN.uarm, -60, 30), arm = at(lean).pts;
    const abdL = bisect((a) => solveFront(spec(r, lean, arm, a, 'ankleR', AR)).joints.ankleL[1] - (-MAT - 9), -10, 80);
    return { r, lean, arm, abdL };
  };
  const target = (PH.joints.hipL[1] + (-MAT - 24)) / 2; // halb abgesenkt (Serner et al. 2013)
  const rS = bisect((r) => { const S = startFor(r); return solveFront(spec(r, S.lean, S.arm, S.abdL, 'ankleR', AR)).joints.hipL[1] - target; }, rH - 30, rH + 15);
  const S = startFor(rS);
  return { HB, AR, KR, hold: { rotate: r1(rH), trunk: 0, armL: armDownF(rH), abdL: -4, armR: 4 }, start: { rotate: r1(rS), trunk: r1(S.lean), armL: S.arm, abdL: r1(S.abdL), armR: r1(4 + S.lean) } };
})();
// L-Sitz (Seitenansicht): Hände auf niedrigen Griffen (≈ 12 cm, Konvention) neben der Hüfte. Halten: Arme fast gestreckt (Schulter–Handgelenk 120),
// Rumpf 5° vor, Hüfte 95° – die Beine liegen waagerecht, Fußspitzen gestreckt. Start: Gesäß und Fersen am Boden, Arme gebeugt (Ellbogen hinten).
const LSIT = (() => {
  const HP = 24, HAND = [0, -HP - 4], base = { root: 'hip', trunk: 5, knee: 0, foot: 70, armWorld: HAND, elbowSide: 1, handFlat: 1 }; // handFlat: Hand liegt um den Griff statt nach unten in den Boden
  const yH = bisect((y) => { const P = solvePose({ ...base, hip: 95, rootPos: [-6, y] }); return Math.hypot(P.joints.shoulder[0] - HAND[0], P.joints.shoulder[1] - HAND[1]) - 120; }, -200, -20);
  // Start: Füße angezogen (90°), Ferse auf dem Boden; im Halten Fußspitzen gestreckt (Fuß in Verlängerung des Schienbeins)
  const yS0 = -20, hipS = bisect((h) => anchor(solvePose({ ...base, foot: 90, hip: h, rootPos: [-6, yS0] }), 'heel')[1] + 1, 70, 120);
  const yS = bisect((y) => lowSeg(solvePose({ ...base, foot: 90, hip: hipS, rootPos: [-6, y] }), ['trunk', 'thigh']), -60, 0);
  return { HP, HAND, base, hold: { hip: 95, y: r1(yH) }, start: { hip: r1(hipS), y: r1(yS) } };
})();

// ---------- Runde 12 (v2.17): Bauch hängend, im Stütz und am Seilzug ----------
// Körperschwerpunkt für hängende Posen: Segmentmassen nach Dempster (Kopf+Rumpf 0,578, Arme 0,1, Oberschenkel 0,2, Unterschenkel 0,093,
// Füße 0,029; Lehrbuchwerte aus dem Trainingswissen, nicht nachgeschlagen), je Segment in der Mitte – grobes Zeichenmodell.
const comX = (P) => { const J = P.joints, m = (a, b) => (a[0] + b[0]) / 2; return 0.578 * m(J.shoulder, J.hip) + 0.1 * m(J.shoulder, J.wrist) + 0.2 * m(J.hip, J.knee) + 0.093 * m(J.knee, J.ankle) + 0.029 * J.toe[0]; };
// Hängendes Beinheben (Seitenansicht): Obergriff an einer hohen Stange (≈ 2,2 m, damit die gestreckten Beine frei hängen), Arme lang.
// Oben Beine gestreckt und waagerecht, Becken nach hinten gekippt (curl, Konvention). Rumpfneigung je Bild so, dass der Schwerpunkt unter den Händen liegt.
const HLR = (() => {
  const BAR = -452, grip = [0, BAR + 7], base = { root: 'wrist', rootPos: grip, armTarget: [4, -121], elbowSide: 1, knee: 0, ankle: -20 };
  const at = (curl, legUp) => { const ps = (t) => solvePose({ ...base, trunk: t, curl, hip: legUp ? t + 90 : 0 }); return r1(bisect((t) => comX(ps(t)) - grip[0], -60, 40)); };
  return { BAR, grip, base, curlTop: 20, tHang: at(0, false), tTop: at(20, true) };
})();
// Captain's Chair (Seitenansicht): Unterarme auf den Polstern (Ellbogen fest, Oberarm senkrecht, Unterarm waagerecht), Rücken am Polster.
// Aufbau und Winkel vom hängenden Knieheben in Armschlaufen übertragen (Escamilla et al. 2006): Schulter und Ellbogen ≈ 90°, oben Hüfte und Knie
// 125–135° gebeugt und das Becken nach hinten gekippt. Der obere Rumpf bleibt am Polster (senkrecht), das Becken rollt mit curl ein.
const CAPT = (() => {
  const E = [0, -300], arm = { elbow: [0, 68], wrist: [54, 68] }, base = { root: 'elbow', rootPos: E, armPoints: arm, ankle: -20 };
  const P0 = solvePose({ ...base, trunk: 0, hip: 0, knee: 0 });
  let back = 1e9; for (const sh of shapesFor('male')) if (sh.seg === 'trunk' && sh.id === 'body' && !sh.part) for (const q of sh.pts) if (q[1] < -230) back = Math.min(back, tf(P0, 'trunk', q)[0]);
  return { E, arm, base, curlTop: 20, padX: r1(back), sh: P0.joints.shoulder.map(r1) };
})();
// Crunch am Kabel (Seitenansicht): kniend vor dem Turm, Seil von der oberen Rolle, Hände seitlich am Kopf. Schienbein und Fußrücken liegen
// auf dem Boden (Kniehöhe gelöst). Der Rumpf rollt ein (curl), die Hüfte beugt nur wenig mit – Zeichenkonvention, keine Messung.
const CCR = (() => {
  const base = { root: 'knee', shank: 90, knee: 90, foot: 262, armTargetTrunk: [8, 32], elbowSide: 1, armScale: [0.8, 0.9] };
  const y = r1(bisect((yy) => lowSeg(solvePose({ ...base, trunk: 20, rootPos: [0, yy] }), ['shank', 'foot']), -40, 20));
  const start = { trunk: 20, curl: 0 }, end = { trunk: 28, curl: 48 };
  const h0 = solvePose({ ...base, ...start, rootPos: [0, y] }).joints.hand;
  return { base, y, start, end, pulley: [Math.round(h0[0] + 96), -452] };
})();
// Crunch an der Maschine (Seitenansicht): sitzend, Oberschenkel waagerecht, Füße unter der Rolle, Brust am Polster, Hände an den Griffen.
// Das Polster dreht um eine Achse seitlich auf Höhe der Lendenwirbelsäule (Mitte der Biegezone, Konvention).
const MCR = (() => {
  const hip = [0, -100], base = { root: 'hip', rootPos: hip, knee: 90, foot: 90, armTargetTrunk: [40, -40], elbowSide: 1, armScale: [0.85, 0.9] };
  const start = { trunk: -4, curl: 0 }, end = { trunk: 6, curl: 42 };
  const pivot = [r1(hip[0] + 57 * Math.sin(start.trunk * Math.PI / 180)), r1(hip[1] - 57 * Math.cos(start.trunk * Math.PI / 180))];
  return { hip, base, start, end, pivot };
})();
// Frontansicht, beide Hände an einem Griff: Arme fast gestreckt und projiziert (Ellbogen auf der Linie Schulter–Hand, 8 Einheiten nach außen und 6 nach unten
// versetzt; liegt die Hand dicht vor der Schulter, rückt der Ellbogen nach außen unten – der Oberarm zeigt dann nach vorn und verschwindet nie ganz), W ist die Griffmitte. armPoints gelten für die rechte Seite (dx nach außen), armL für die linke (gespiegelt).
const handsTo = (spec, W, rest = [10, 16]) => { // rest: Ellbogen (nach außen, nach unten) für eine Hand dicht vor der Schulter
  const P = solveFront({ ...spec, armPoints: { elbow: [6, 60], wrist: [8, 110] } });
  const one = (S, sg) => { const g = [W[0] - S[0], W[1] - S[1]], l = Math.hypot(g[0], g[1]), v = [g[0] * (1 - 7 / l), g[1] * (1 - 7 / l)], k = LEN.uarm / ARM_REACH; const wv = Math.max(0, Math.min(1, 1 - Math.hypot(v[0], v[1]) / 80)), e = [(sg * v[0] * k + 8) * (1 - wv) + rest[0] * wv, (v[1] * k + 6) * (1 - wv) + rest[1] * wv]; return { elbow: [r1(e[0]), r1(e[1])], wrist: [r1(sg * v[0]), r1(v[1])], len: l }; }; // Griff 7 vor dem Handgelenk (Handmitte)
  const R = one(P.joints.shoulderR, 1), L = one(P.joints.shoulderL, -1);
  return { armPoints: { elbow: R.elbow, wrist: R.wrist }, armL: { points: { elbow: L.elbow, wrist: L.wrist } }, reach: r1(Math.max(R.len, L.len)) };
};
// Holzhacker (Frontansicht): von der oberen Rolle rechts diagonal nach links unten. Die Rumpfdrehung zeigt die Frontfigur nicht – sichtbar sind
// Armdiagonale, Seitneigung und die tiefer werdenden Knie. Griffpunkte und Kniebeugung sind Zeichenkonvention.
const WCH = (() => {
  const legs = (k, s) => ({ planted: true, stance: 34, toeOut: 12, knee: k, shank: s });
  const wStart = [78, -372], wEnd = [-58, -178];
  // Sieben Bilder auf der geraden Griffbahn: linear gemischte Armpunkte ließen die Hände sonst auseinanderlaufen (Schultern wandern mit),
  // und dicht vor der rechten Schulter dreht der kurze projizierte Arm schnell.
  const at = (u) => { const sp = { trunk: r1(6 - 16 * u), legs: legs(r1(6 + 20 * u), r1(3 + 9 * u)) }; return { ...sp, ...handsTo(sp, [wStart[0] + (wEnd[0] - wStart[0]) * u, wStart[1] + (wEnd[1] - wStart[1]) * u]) }; };
  return { tower: 168, pulleyY: -440, path: [0, 1, 2, 3, 4, 5, 6].map((i) => at(i / 6)) };
})();
// Pallof Press (Frontansicht): Kabel von rechts auf Höhe der gestreckten Hände (waagerecht, Juan-Recio et al. 2025); Start Hände an der Brust,
// Ende Arme gerade nach vorn auf Schulterhöhe – von vorn stark verkürzt, die Hände bleiben vor der Körpermitte.
const PAL = (() => {
  const legs = { planted: true, stance: 18, toeOut: 8, knee: 10, shank: 5 };
  const P = solveFront({ legs, armPoints: { elbow: [-16, 4], wrist: [-31, 8] } });
  return { legs, chest: { elbow: [6, 60], wrist: [-27, 30] }, out: { elbow: [-16, 4], wrist: [-31, 8] }, tower: 170, pulleyY: r1(P.joints.wristR[1] + 2) };
})();

// ---------- Runde 13 (v2.18): Bauch am Boden, Drehung, Seitbeugen, Hüftbeugen ----------
// Ab-Wheel-Rollout (Seitenansicht): kniend, Schienbein und Fußrücken am Boden (Kniehöhe gelöst wie beim Kabel-Crunch). Rad Ø ≈ 18 cm
// (Achse 18 über dem Boden, Konvention), Arme gestreckt: Schulter–Griff = 141 (Arm bis Handgelenk 121, knapp unter der vollen Länge, + Handfläche 20). Start im Vierfüßlerstand (Hüfte 90°,
// Arm senkrecht zum Rumpf; Escamilla et al. 2006), Ende gestreckt mit Brust ≈ 4 cm über dem Boden (Youdas et al. 2008: Unterarme fast am Boden).
// Neun Bilder: Hüfte 90° → 0°, Schulterhöhe linear dazwischen; die Radachse folgt aus der Armlänge.
const ROLL = (() => {
  const AX = -18, REACH = 141, base = { root: 'knee', shank: 90, foot: 262, elbow: 0 };
  const y = r1(bisect((yy) => lowSeg(solvePose({ ...base, trunk: 80, knee: 100, rootPos: [0, yy] }), ['shank', 'foot']), -40, 20));
  const at = (t, h) => solvePose({ ...base, rootPos: [0, y], trunk: t, knee: 90 - t + h, shoulder: 90 });
  const H0 = 90; // Vierfüßlerstand: Hüfte und Schulter je ≈ 90° (Escamilla et al. 2006) – der Arm steht senkrecht zum Rumpf, das Rad liegt etwas vor der Schulter
  const tS = bisect((t) => at(t, H0).joints.shoulder[1] + REACH * Math.sin(t * Math.PI / 180) - AX, 45, 95);
  const tE = bisect((t) => lowSeg(at(t, 0), ['trunk']) + 8, 40, 95);
  const s0 = at(tS, H0).joints.shoulder[1], s1 = at(tE, 0).joints.shoulder[1];
  const frame = (u) => {
    const h = H0 * (1 - u), t = bisect((tt) => at(tt, h).joints.shoulder[1] - (s0 + (s1 - s0) * u), 45, 100), P = at(t, h), sh = P.joints.shoulder;
    const ax = [r1(sh[0] + Math.sqrt(Math.max(REACH * REACH - (AX - sh[1]) ** 2, 0))), AX]; // Radachse vor der Schulter auf Achshöhe
    const d = [ax[0] - sh[0], ax[1] - sh[1]], l = Math.hypot(d[0], d[1]), w = [r1(ax[0] - d[0] / l * 20), r1(ax[1] - d[1] / l * 20)]; // Handgelenk 20 vor der Achse: die Handfläche liegt am Griff
    return { trunk: r1(t), knee: r1(90 - t + h), hip: r1(h), axle: ax, wrist: w };
  };
  const frames = [0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => frame(i / 8));
  // Dauer je Abschnitt nach dem Weg des Rads (gesamt 1 s), damit das Rad gleichmäßig rollt
  const seg = frames.slice(1).map((f, i) => f.axle[0] - frames[i].axle[0]), tot = seg.reduce((a, b) => a + b, 0);
  return { AX, y, base, frames, durs: seg.map((d) => Math.round((d / tot) * 1000) / 1000) };
})();
// Fahrrad-Crunch (Seitenansicht, Rückenlage auf der Matte wie Runde 10): Oberkörper bleibt eingerollt (Schulterblätter abgehoben),
// ein Knie zur Brust (Hüfte 110°, Knie 100°, Konvention), das andere Bein gestreckt bis 30° Hüftbeugung (Pereira et al. 2017).
const BIKE = (() => {
  const bent = { hip: 110, knee: 100 }, straight = { hip: 30, knee: 0 };
  // Hüfthöhe je Bild so gelöst, dass das Gesäß auf der Matte bleibt (bei angezogenem nahem Bein hebt die Gesäßkontur sonst ≈ 3 cm ab)
  const pose = (near, far) => ({ root: 'hip', trunk: FLOOR.lie, curl: FLOOR.crunchCurl, hip: near.hip, knee: near.knee, ankle: -10, leg2: { hip: far.hip, knee: far.knee, ankle: -10 } });
  const yFor = (near, far) => r1(bisect((y) => lowSeg(solvePose({ ...pose(near, far), rootPos: [0, y] }), ['trunk']) + MAT, -80, 20));
  return { bent, straight, yR: yFor(bent, straight), yL: yFor(straight, bent) };
})();
// Hüftbeugen am Kabel (Seitenansicht): aufrecht, Standbein fest (zweites Bein per IK), Manschette am arbeitenden (nahen) Bein, Kabel von
// der unteren Rolle hinter der Figur. Knie bis Hüfthöhe (Oberschenkel waagerecht, Knie 90°), Hände an den Hüften – alles Konvention.
const HFX = { tower: -150, pulley: -20, pose: { root: 'hip', rootPos: [-0.6, -182.6], trunk: 0, leg2: { ankle: [0, -15], foot: 90, kneeSide: 1 }, armTargetTrunk: [-6, -78], elbowSide: 1, armScale: [0.9, 0.9] } };
// Seitbeugen mit Kurzhantel (Frontansicht): Hantel in der rechten Hand, Arm hängt senkrecht; linke Hand an der Hüfte. Seitneigung des Rumpfs
// bis 25° zur Hantelseite und 6° zurück über die Mitte (bequemer Endbereich im Protokoll von Kang & Park 2026; Gradzahl Konvention).
const SBD = (() => {
  const legs = { planted: true, stance: 18, toeOut: 6, knee: 4, shank: 2 };
  // linke Hand bleibt an der Hüfte: Handgelenk auf einem Punkt seitlich am Becken, Ellbogen nach außen (je Neigung gelöst)
  const handL = (lean) => {
    const P = solveFront({ trunk: lean, legs }), S = P.joints.shoulderL, hp = P.joints.hipL, W = [hp[0] - 30, hp[1] - 16], v = [W[0] - S[0], W[1] - S[1]], l = Math.hypot(v[0], v[1]);
    let n = [v[1] / l, -v[0] / l]; if (n[0] > 0) n = [-n[0], -n[1]]; // senkrecht zur Linie Schulter–Hand, nach außen (links)
    const e = [v[0] / 2 + n[0] * 26, v[1] / 2 + n[1] * 26];
    return { elbow: [r1(-e[0]), r1(e[1])], wrist: [r1(-v[0]), r1(v[1])] };
  };
  return { legs, down: 25, up: -6, handUp: handL(-6), handDown: handL(25) };
})();
// Russian Twist (Frontansicht): Sitz auf der Matte, Rumpf ≈ 40° zurückgelehnt (als Verkürzung), Knie hoch vor dem Rumpf, Füße angehoben
// (Oberschenkel nach oben, Schienbein nach unten gezeichnet, Beine vor dem Rumpf). Hände zusammen, von tief neben der einen Hüfte über die
// Mitte (vor dem Bauch) zur anderen, Rumpf neigt sich leicht mit. Die Drehung um die Längsachse zeigt die Frontfigur nicht. Alles Konvention.
const RTW = (() => {
  const legs = { hip: 0, knee: 0, thighDir: 156, thighF: 0.75, shankDir: -24, shankF: 0.45 }, PEL = [0, -34], A = 70;
  const at = (u) => { const x = A * Math.cos(Math.PI * u), sp = { root: 'pelvis', rootPos: PEL, trunkFlex: 40, trunk: r1(8 * Math.cos(Math.PI * u)), legs, legsFront: true }; return { ...sp, ...handsTo(sp, [x, -58 - 34 * Math.sin(Math.PI * u)], [24, 4]) }; }; // seitlich tief neben der Hüfte, in der Mitte vor dem Bauch (über den Knien)
  return { PEL, legs, path: [0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => at(i / 8)) };
})();

// ---------- Runde 14 (v2.19): Waden, Hüftmaschinen, Hüfte am Kabel und in Seitlage ----------
const DG = Math.PI / 180;
// Wadenheben sitzend (Seitenansicht): Gesäß auf dem Sitz (Hüftgelenk fest), Fußballen auf dem Block (fest), Knie ≈ 90° (Kinoshita et al. 2023),
// Polster auf den Oberschenkeln knapp hinter den Knien. Je Sprunggelenkwinkel Schienbein und Knie so gelöst, dass Hüfte und Ballen am Platz bleiben –
// das Knie hebt sich mit der Ferse, der Oberschenkel kippt leicht. Block ≈ 13 cm, Sitz und Polster Konvention.
const SCR = (() => {
  const BLK = 26, P0 = solvePose({ root: 'hip', rootPos: [0, 0], trunk: 0, hip: 90, knee: 90, ankle: 20 });
  const hip = [0, r1(-BLK - 2 - P0.joints.toe[1])], toe = [r1(P0.joints.toe[0]), -BLK - 2];
  const at = (a) => {
    const kOf = (sh) => solvePose({ root: 'toe', rootPos: toe, shank: sh, knee: 0, trunk: 0, ankle: a }).joints.knee;
    const sh = bisect((x) => { const K = kOf(x); return Math.hypot(K[0] - hip[0], K[1] - hip[1]) - LEN.thigh; }, -30, 30), K = kOf(sh);
    const aThigh = Math.atan2(K[0] - hip[0], -(K[1] - hip[1])) / DG;
    return { shank: r1(sh), knee: r1(180 + sh - aThigh), ankle: a };
  };
  const withHand = (o) => { const P = solvePose({ root: 'toe', rootPos: toe, trunk: 0, ...o }), K = P.joints.knee, d = [K[0] - P.joints.hip[0], K[1] - P.joints.hip[1]], l = Math.hypot(d[0], d[1]);
    const u = [d[0] / l, d[1] / l], n = [u[1], -u[0]], pad = [K[0] - u[0] * 16 + n[0] * 24, K[1] - u[1] * 16 + n[1] * 24];
    return { ...o, hand: [r1(pad[0] - 4), r1(pad[1] - 8)] }; }; // Hände an den Griffen des Polsters
  return { BLK, hip, toe, down: withHand(at(20)), mid: withHand(at(-5)), up: withHand(at(-30)) };
})();
// Wadenheben an der Beinpresse (Seitenansicht): Sitz, Lehne und Beine wie oben an der Beinpresse, Knie fast gestreckt; nur die Fußballen
// stehen an der unteren Kante der Platte, die Ferse hängt frei. Das Bein bleibt starr, nur das Sprunggelenk bewegt sich – die Platte folgt
// den Ballen entlang der Schienen. Alles Konvention.
const LPC = { pose: { root: 'hip', rootPos: [0, -70], trunk: -70, hip: 70, knee: 4, shoulder: 5, elbow: 25, armScale: [1, 0.9] } };
// Wadenheben einbeinig (Seitenansicht): auf der Stufe wie beim Wadenheben stehend, das hintere Bein angewinkelt, eine Hand an der Wand vor der Figur.
const SLC = { wall: 104, hand: [94, -262] };
// Hüftmaschinen (Frontansicht, sitzend): Oberschenkel waagerecht zum Betrachter (stark verkürzt, Knie leicht unter der Hüfte gezeichnet),
// Unterschenkel senkrecht, Füße auf den Fußstützen. Abspreizen je Bein in der Waagerechten: das Knie wandert seitlich um L · sin(Winkel).
// Polster außen (Abduktion) oder innen (Adduktion) an den Knien. Winkel und Sitzhöhe Konvention.
const HIPM = (() => {
  const PEL = [0, -132], DROP = 0.45; // Knie ≈ 40 Einheiten unter der Hüfte (Projektion des leicht abfallenden Oberschenkels)
  const legs = (a) => { const lat = LEN.thigh * Math.sin(a * DG), dn = LEN.thigh * DROP; return { thighDir: r1(Math.atan2(lat, dn) / DG), thighF: Math.round(Math.hypot(lat, dn) / LEN.thigh * 1000) / 1000, shankDir: 0, shankF: 0.85 }; };
  const arms = { elbow: [12, 58], wrist: [26, 106] }; // Hände an den Griffen neben dem Sitz
  return { PEL, legs, arms, open: 38, closed: 2 };
})();
// Hand an der Hüfte (Frontansicht): Handgelenk seitlich am Becken, Ellbogen nach außen – wie beim Seitbeugen, für beide Seiten.
const hipHand = (spec, side) => {
  const P = solveFront(spec), sg = side === 'R' ? 1 : -1, S = P.joints['shoulder' + side], hp = P.joints['hip' + side];
  const W = [hp[0] + sg * 30, hp[1] - 16], v = [W[0] - S[0], W[1] - S[1]], l = Math.hypot(v[0], v[1]);
  let n = [v[1] / l, -v[0] / l]; if (n[0] * sg < 0) n = [-n[0], -n[1]];
  const e = [v[0] / 2 + n[0] * 26, v[1] / 2 + n[1] * 26];
  return { elbow: [r1(sg * e[0]), r1(e[1])], wrist: [r1(sg * v[0]), r1(v[1])] };
};
// Abduktion am Kabel stehend (Frontansicht): Stand auf dem linken Bein, Manschette am rechten Knöchel, Kabel von der unteren Rolle des
// Turms links (Standbeinseite) vor dem Standbein vorbei. Linke Hand am Turm, rechte an der Hüfte. Bein bis 35° seitlich (Konvention), Rumpf neigt leicht zum Standbein.
// Adduktion am Kabel (Frontansicht): Turm rechts, Manschette am rechten (nahen) Knöchel; das Bein startet abgespreizt und zieht bis knapp vor das Standbein.
const CHIP = (() => {
  const AL = [-13, -15], legs = (abd) => ({ abdR: abd });
  const spec = (abd, lean) => ({ root: 'ankleL', rootPos: AL, trunk: lean, legs: legs(abd) });
  const towerHand = (abd, lean, side) => { const P = solveFront(spec(abd, lean)), S = P.joints['shoulder' + side], sg = side === 'R' ? 1 : -1, T = [sg * 112, -276];
    const v = [T[0] - S[0], T[1] - S[1]], k = LEN.uarm / ARM_REACH; return { elbow: [r1(sg * v[0] * k + 2), r1(v[1] * k + 10)], wrist: [r1(sg * v[0] - 8), r1(v[1])] }; };
  const abdF = (abd, lean) => ({ armL: { points: towerHand(abd, lean, 'L') }, armPoints: hipHand(spec(abd, lean), 'R') });
  const addF = (abd, lean) => ({ armPoints: towerHand(abd, lean, 'R'), armL: { points: hipHand(spec(abd, lean), 'L') } });
  return { AL, spec, abd: { down: { abd: 0, lean: 0, ...abdF(0, 0) }, up: { abd: 35, lean: -4, ...abdF(35, -4) } }, add: { out: { abd: 28, lean: 3, ...addF(28, 3) }, in: { abd: 3, lean: 0, ...addF(3, 0) } } };
})();
// Seitlage (Frontansicht, um −90° gedreht wie beim Seitstütz: Kopf links, linke Körperseite unten auf der Matte). Unterer Arm über dem Kopf
// (Kopf liegt darauf), oberer Arm am Körper. Beckenhöhe so gelöst, dass der tiefste Umrisspunkt auf der Matte liegt.
const lowF = (P) => { let m = -1e9; for (const l of layersFront(P, () => '', 'male')) { if (!l.cls.includes('fill') || l.d.includes(' a')) continue; const n = l.d.replace(/[MCZ]/g, ' ').trim().split(/\s+/).map(Number); for (let i = 1; i < n.length; i += 2) m = Math.max(m, n[i]); } return m; };
const SIDEL = (() => {
  const base = { rotate: -90, root: 'pelvis', armL: { abd: 186, elbow: 0 }, arm: { abd: 6, elbow: 6 } };
  const y = (extra) => r1(bisect((yy) => lowF(solveFront({ ...base, ...extra, rootPos: [0, yy] })) + MAT, -200, 100));
  return { base, y };
})();
// Seitliches Beinheben: unteres Bein gestreckt, oberes bis 40° abgespreizt (Konvention).
const SLA = { y: SIDEL.y({ legs: { abdR: 0 } }), up: 35 };
// Clamshell: Hüfte 60° gebeugt (Variante mit der höchsten Aktivität des mittleren Gesäßmuskels bei Willcox & Burden 2013), Knie 90°, Fersen zusammen.
// Das obere Knie öffnet sich um die Achse Hüfte–Knöchel bis 40° (Konvention). Bein räumlich gelöst und in die Frontalebene projiziert
// (x seitlich, y abwärts, z zum Betrachter).
const CLAM = (() => {
  const HF = 60, K = 90;
  const kn = [0, LEN.thigh * Math.cos(HF * DG), LEN.thigh * Math.sin(HF * DG)], sa = (HF - K) * DG;
  const an = [0, kn[1] + LEN.shank * Math.cos(sa), kn[2] + LEN.shank * Math.sin(sa)];
  const ax = (() => { const l = Math.hypot(...an); return an.map((c) => c / l); })(), d = kn[1] * ax[1] + kn[2] * ax[2];
  const perp = [0, kn[1] - d * ax[1], kn[2] - d * ax[2]], cr = [ax[1] * perp[2] - ax[2] * perp[1], 0, 0]; // ax × perp zeigt seitlich
  const legs = (phi) => {
    const c = Math.cos(phi * DG), sn = Math.sin(phi * DG), k = [Math.abs(cr[0]) * sn, d * ax[1] + perp[1] * c, 0];
    return { thighDir: r1(Math.atan2(k[0], k[1]) / DG), thighF: Math.round(Math.hypot(k[0], k[1]) / LEN.thigh * 1000) / 1000, shankDir: r1(Math.atan2(-k[0], an[1] - k[1]) / DG), shankF: Math.round(Math.hypot(k[0], an[1] - k[1]) / LEN.shank * 1000) / 1000 };
  };
  const closed = legs(0), open = legs(40);
  const L = { thighDirL: closed.thighDir, thighFL: closed.thighF, shankDirL: closed.shankDir, shankFL: closed.shankF };
  const mk = (o) => ({ ...o, ...L });
  return { HF, closed: mk(closed), open: mk(open), y: SIDEL.y({ legs: mk(closed), legsFront: true }) };
})();

// ---------- v2.20.0: Ausfallschritt neu aufgebaut ----------
// Bis v2.19 klappte das hintere Knie unten vor die Hüfte (fast bis zum vorderen Fuß): Mit 70 % Beinlänge Schritt und den gemessenen Winkeln des
// vorderen Beins liegt der hintere Fuß so nah unter der Hüfte, dass die Zwei-Glieder-IK nur diese Lösung hat. Außerdem schob sich die Hüfte
// beim Ausfallschritt vorwärts beim Aufsetzen ≈ 15 cm über das Ziel hinaus und rutschte beim Absenken zurück, und rückwärts setzte der hintere
// Fuß erst unten auf. Jetzt: Unten liegt das hintere Knie knapp über dem Boden (Kniemitte 15 über dem Boden, Konvention) und der hintere Fußballen
// am Boden; daraus folgt die Schrittlänge. Die Zwischenbilder geben die Hüftbahn vor (vorn/hinten und abwärts, ohne Rücklauf); die Beine folgen per IK.
const footAnkle = (ball, phi) => { const d = [Math.sin(phi * DG), -Math.cos(phi * DG)]; return [r1(ball[0] - d[0] * 30 + d[1] * 13), r1(ball[1] - d[1] * 30 - d[0] * 13)]; }; // Knöchel bei festem Ballen und Fußwinkel phi
function legTo(hip, ankle) { // Beinwinkel (Schienbeinneigung, Kniebeugung) für Hüfte → Knöchel, Knie vorn
  const ang = (w) => ((Math.atan2(w[0], -w[1]) / DG) % 360 + 360) % 360, v = [ankle[0] - hip[0], ankle[1] - hip[1]];
  const d = Math.min(Math.hypot(v[0], v[1]), LEN.thigh + LEN.shank - 0.5), g = Math.acos((LEN.thigh ** 2 + d * d - LEN.shank ** 2) / (2 * LEN.thigh * d)) / DG;
  const aT = ang(v) - g, K = [hip[0] + LEN.thigh * Math.sin(aT * DG), hip[1] - LEN.thigh * Math.cos(aT * DG)], aS = ang([ankle[0] - K[0], ankle[1] - K[1]]);
  return { shank: r1(aS - 180), knee: r1(aS - aT) };
}
const LUNGE = (() => {
  const bottom = { shank: 11.4, knee: 96.4, hip: 84.3, ankle: 11.4 }; // gemessene Winkel des vorderen Beins (Riemann et al. 2012)
  const P = solvePose({ ...bottom, rootPos: [0, -15] }), H = P.joints.hip, trunk = P.angles.trunk; // Hüfte relativ zum vorderen Knöchel
  const KY = -15, ballY = -2, phiB = 140; // Kniemitte, Ballen, Fußwinkel unten
  const knee = [H[0] - Math.sqrt(LEN.thigh ** 2 - (KY - H[1]) ** 2), KY];
  const a0 = footAnkle([0, ballY], phiB), ankY = a0[1], ankle = [knee[0] - Math.sqrt(LEN.shank ** 2 - (ankY - KY) ** 2), ankY];
  const ballX = ankle[0] - a0[0]; // Ballen relativ zum vorderen Knöchel
  return { bottom, H, trunk, ballX, ballY, phiB, step: r1(-ballX) };
})();
// Ausfallschritt vorwärts: hinterer Ballen bleibt bei x = 30 (Stand), der vordere Fuß setzt bei F auf.
const FWL = (() => {
  const ball = [30, LUNGE.ballY], F = [r1(30 - LUNGE.ballX), -15], Hb = [F[0] + LUNGE.H[0], LUNGE.H[1]];
  const back = (phi) => ({ ankle: footAnkle(ball, phi), foot: phi });
  const swing = { hip: [r1(0.3 * Hb[0]), -180], ankle: [r1(0.5 * F[0]), -34] };
  const touchX = r1(0.82 * Hb[0]), touch = { hip: [touchX, r1(F[1] - Math.sqrt(164 ** 2 - (F[0] - touchX) ** 2))], ankle: F };
  return { F, Hb, back, swing: { ...swing, leg: legTo(swing.hip, swing.ankle) }, touch: { ...touch, leg: legTo(touch.hip, touch.ankle) } };
})();
// Ausfallschritt rückwärts: der vordere Fuß bleibt bei x = 0, der hintere Ballen setzt bei LUNGE.ballX auf.
const RVL = (() => {
  const ball = [r1(LUNGE.ballX), LUNGE.ballY], Hb = LUNGE.H;
  const back = (phi) => ({ ankle: footAnkle(ball, phi), foot: phi });
  const swing = { hip: [r1(0.3 * Hb[0]), -180], ankle: [r1(0.5 * ball[0] - 10), -36], foot: 125 };
  const aT = footAnkle(ball, 125), tx = r1(0.83 * Hb[0]), touch = { hip: [tx, r1(aT[1] - Math.sqrt(164 ** 2 - (aT[0] - tx) ** 2))] }; // Hüfte so tief, dass der Ballen den Boden erreicht
  const back2 = (phi) => (phi === 125 ? { ankle: aT, foot: phi } : back(phi));
  return { ball, Hb, back: back2, swing: { ...swing, leg: legTo(swing.hip, [0, -15]) }, touch: { ...touch, leg: legTo(touch.hip, [0, -15]) } };
})();
// ---------- Runde 15 (v2.20): Drücken und Heben ----------
// Schrägbankdrücken an der Multipresse (Seitenansicht): Bank 30° und Körper wie beim Schrägbankdrücken mit der Langhantel (Rodríguez-Ridao et al. 2020).
// Die Stange läuft senkrecht über dem Punkt, an dem sie unten die obere Brust erreicht (x der Hand unten). Oben ist der Arm fast gestreckt
// (Abstand Schulter–Handgelenk 95 % der Armlänge, Konvention); das Handgelenk ist so gesetzt, dass die Hand über demselben x liegt (geführte Bahn).
const SMI = (() => {
  const base = { root: 'hip', rootPos: [0, -100], trunk: -60, hip: 30, knee: 90, foot: 90 };
  const bottom = { elbow: [16, 30], wrist: [30, -14] };
  const xb = solvePose({ ...base, armPoints: bottom }).joints.hand[0], sh = solvePose(base).joints.shoulder;
  const reach = 0.95 * (LEN.uarm + LEN.farm);
  const arm = (dx) => { // Zwei-Glieder-IK in der Bildebene, Ellbogen unter der Linie Schulter–Handgelenk
    const dy = -Math.sqrt(reach * reach - dx * dx), l = reach, a = LEN.uarm, b = LEN.farm;
    const g = Math.acos((a * a + l * l - b * b) / (2 * a * l)), base0 = Math.atan2(dy, dx), e = base0 - g;
    return { elbow: [r1(a * Math.cos(e)), r1(a * Math.sin(e))], wrist: [r1(dx), r1(dy)] };
  };
  let dx = xb - sh[0];
  for (let i = 0; i < 4; i++) { const h = solvePose({ ...base, armPoints: arm(dx) }).joints.hand[0]; dx += xb - h; }
  return { base, bottom, top: arm(dx), x: r1(xb) };
})();
// Schräge Brustpresse (Seitenansicht): Lehne 20° zurück, Griffe unten auf Höhe der oberen Brust, Druck schräg nach oben-vorn bis ≈ 115°
// Schulterbeugung zum Rumpf (übertragen von der 30°-Schrägbank: senkrechter Druck = 120°). Hebel mit Drehpunkt hinter dem Kopf auf der
// Hebel mit Drehpunkt tief hinter dem Sitz. Alles außer der Druckrichtung Konvention.
const IMP = (() => {
  const base = { root: 'hip', rootPos: [0, -100], trunk: -20, hip: 75, knee: 85, foot: 90 };
  const back = { elbow: [-20, 34], wrist: [26, 6] }, mid = { elbow: [40, 26], wrist: [64, -22] }; // Mitte: Ellbogen kommt vor den Körper (sonst springt der Oberarm beim Überblenden)
  const up = (180 + base.trunk - 115) * DG, el = 8; // Oberarm aus der Senkrechten nach vorn: 180° + Rumpf (−20°) − Beugung 115° = 45°
  const E = [LEN.uarm * Math.sin(up), -LEN.uarm * Math.cos(up)], fa = up - el * DG; // Unterarm 8° steiler (Ellbogen leicht gebeugt)
  const front = { elbow: [r1(E[0]), r1(E[1])], wrist: [r1(E[0] + LEN.farm * Math.sin(fa)), r1(E[1] - LEN.farm * Math.cos(fa))] };
  // Drehpunkt tief hinter dem Sitz (Konvention); der Hebel läuft hinter dem Körper zum Griff. Er ist nicht starr gezeichnet:
  // ein Drehpunkt, von dem beide Griffpositionen gleich weit entfernt sind, läge vor der Figur oder über dem Kopf.
  return { base, back, mid, front, pivot: [-62, -64] };
})();
// Seitheben an der Maschine (Frontansicht, sitzend): Arm in der Frontalebene von 0° auf 90° Abduktion (Protokolle Larsen et al. 2025,
// Coratella et al. 2020, Campos et al. 2020). Variante „gebeugt“: Ellbogen 90°, Unterarm zeigt nach vorn und leicht nach unten (20°, Konvention),
// in der Projektion kurz unter dem Ellbogen; Polster außen am Oberarm über dem Ellbogen. Variante „gestreckt“: Ellbogen fast gestreckt,
// Polster am Unterarm. Drehachse der Hebel hinter dem Schultergelenk (Konvention, wie in der Beschreibung im Übungspool).
const MLR = (() => {
  const seat = -105;
  const bent = (abd) => { const e = [LEN.uarm * Math.sin(abd * DG), LEN.uarm * Math.cos(abd * DG)]; return { elbow: [r1(e[0]), r1(e[1])], wrist: [r1(e[0]), r1(e[1] + LEN.farm * Math.sin(20 * DG))] }; };
  return { seat, bent, legs: { hip: 85, knee: 85 } };
})();
// Reverse Fly am Kabel (Frontansicht, stehend): Kabel über Kreuz von zwei Rollen auf Schulterhöhe (Türme wie XOV). Start mit den Armen vorn
// und leicht über der Körpermitte (−20°, Konvention für gekreuzte Kabel), Ende in Linie mit dem Rumpf (Bergquist et al. 2018); Ellbogen 14°
// gebeugt (Band-Reverse-Fly, 14,08 ± 9,14°, Liu et al. 2024). Armgeometrie mit armFront.
const CRF = { stance: 14, lift: 84, start: -20, mid: 0, end: 90, elbow: 14 }; // lift: Armhebung 84° (fast waagerecht), damit der Oberarm von vorn nie auf einen Punkt schrumpft; Mittelbild bei 0° (Arme zeigen nach vorn)
// Y-Raise auf der Schrägbank (Seitenansicht): Brust auf dem Polster einer 45°-Bank (Konvention; keine Studie mit Brustauflage gefunden),
// Füße am Boden. Start mit senkrecht hängenden Armen; oben 135° Armhebung in der Schulterblattebene (Song et al. 2026), projiziert auf die
// Seitenansicht (Ebene 30° vor der Frontalebene): Beugung 153°, sichtbare Armlänge 79 % (berechnet).
const YR = (() => {
  const e = 135 * DG, pl = 30 * DG, up = -Math.cos(e), fw = Math.sin(e) * Math.sin(pl);
  return { trunk: 45, flex: r1(180 - Math.atan2(fw, up) / DG), scale: Math.round(Math.hypot(up, fw) * 100) / 100 };
})();
// Face Pull (Seitenansicht, stehend): Turm vor der Figur, Rolle auf Kopfhöhe (Konvention; keine Studie zur Kabelhöhe gefunden).
// Start: Arme gestreckt zur Rolle. Ende: Hände neben den Ohren, Oberarme seitlich auf Schulterhöhe – in der Seitenansicht zeigen sie zum Betrachter
// und erscheinen sehr kurz, die Unterarme stehen nach oben (Außenrotation). Endstellung Trainingswissen, nicht gemessen.
const FP = (() => {
  const base = { shank: 0, knee: 4, hip: 4, ankle: 0 }, pulley = [200, -335], sh = solvePose(base).joints.shoulder;
  const v = [pulley[0] - sh[0], pulley[1] - sh[1]], l = Math.hypot(v[0], v[1]), u = [v[0] / l, v[1] / l];
  const start = { elbow: [r1(u[0] * LEN.uarm), r1(u[1] * LEN.uarm)], wrist: [r1(u[0] * (LEN.uarm + LEN.farm)), r1(u[1] * (LEN.uarm + LEN.farm))] }; // Arm gestreckt zur Rolle
  return { base, tower: 210, pulley, start, end: { elbow: [-4, -5], wrist: [2, -40] } };
})();
// Shrugs (Frontansicht): Arme hängen mit den Kurzhanteln seitlich, Schultern heben sich um 12 Einheiten (≈ 6 cm). Berechnet aus 25° Hebung des
// Schlüsselbeins (Peeters et al. 2023, passiv an Körperspenden) und ≈ 15 cm Schlüsselbeinlänge (Trainingswissen, nicht nachgeprüft).
const SHR = { up: 12 };

// ---------- Runde 16 (v2.21): Unterarme, Beinbeuger, Beine und Tragen ----------
// Beinbeuger sitzend (Seitenansicht): Hüfte ≈ 90° (Maeo et al. 2021), Oberschenkel waagerecht auf dem Sitz, Knie 0° → 90°. Kniegelenk auf der
// Drehachse des Hebels (Protokoll), Polster oben auf dem Oberschenkel knapp vor dem Knie, Rolle hinten am Unterschenkel über der Ferse.
// Hände an den Griffen neben dem Sitz (Handgelenk-Ziel in Weltkoordinaten). Sitzhöhe, Lehne und Griffe sind Konvention.
const SLC2 = { hip: [0, -112], hand: [26, -124] };
// Nordic Hamstring Curl (Seitenansicht): kniend auf einem Polster (Schienbein waagerecht, Polster 14 hoch, Konvention), Knöchel unter einer Rolle.
// Start: Oberschenkel und Rumpf senkrecht (Knie 90°, Maeo et al. 2024). Absenken mit gestreckter Hüfte bis zum Bruchpunkt bei 58° Kniebeugung
// (57,75 ± 13,28°, Soga et al. 2021, Unterschenkel flach), danach Fallen und mit den Händen abfangen (Knie ≈ 15°). Hüfte leicht gebeugt (8°,
// Konvention; gemessen wurden 24° bei maximaler Aktivität, Jorge et al. 2024). Arme: vor der Brust, beim Abfangen gestreckt zum Boden.
const NHC = (() => {
  const KN = [0, -24], base = { root: 'knee', rootPos: KN, shank: 90, foot: 205 };
  const sh = (knee, hip) => solvePose({ ...base, knee, hip }).joints.shoulder;
  const chest = { shoulder: 25, elbow: 125 }; // Arme vor der Brust (Konvention); als Winkel, damit die Überblendung glatt bleibt
  const WY = -22; // Handgelenk über dem Boden (Faust liegt auf)
  const wristY = (knee, hip, shoulder, elbow) => solvePose({ ...base, knee, hip, shoulder, elbow }).joints.wrist[1];
  const catchArm = (knee, hip, elbow) => ({ shoulder: r1(bisect((sh) => wristY(knee, hip, sh, elbow) - WY, 20, 120)), elbow }); // Schulterwinkel so, dass die Hand den Boden erreicht
  // tiefstes Knie: die fast gestreckten Arme (Ellbogen 5°) erreichen den Boden gerade senkrecht unter der Schulter
  const low = r1(bisect((k) => { const S = sh(k, 8); return -S[1] - (LEN.uarm + LEN.farm - 2) + WY + 0; }, 0, 58));
  return { KN, base, chest, bp: 57.75, low, catch: catchArm(low, 8, 5), mid: catchArm(35, 8, 70) };
})();
// Reverse Hyperextension (Seitenansicht): Bauchlage auf einem hohen Polster, Hüfte an der Polsterkante, Beine hängen; gestreckte Beine von 77°
// Hüftbeugung (76,6° Oberschenkel–Rumpf-Bewegung, Lawrence et al. 2019) bis in Linie mit dem Rumpf. Pendel mit Drehachse am Hüftgelenk,
// Schlaufe an den Unterschenkeln über dem Knöchel; Hände an Griffen vorn. Polsterhöhe ≈ 1 m (Konvention).
const RHE = { hip: [0, -222], hand: [126, -100], bottom: 76.6 };

// Handgelenkcurls (Seitenansicht): sitzend auf der Bank, Oberkörper vorgeneigt, Unterarme auf den Oberschenkeln, Handgelenk knapp vor dem Knie.
// Rumpfneigung so gelöst, dass der Ellbogen auf dem Oberschenkel liegt (Konvention; Studien fixierten den Unterarm, Takamori et al. 2026).
// Hand von waagerecht (0°) bis 60° nach oben (Takamori: „voll gebeugt/gestreckt“ ohne Gradwert; Alltag braucht 54° Beugung / 60° Streckung, Ryu et al. 1991).
const WCURL = (() => {
  const base = { root: 'hip', rootPos: [0, -100], knee: 90, foot: 90 };
  const pose = (t) => solvePose({ ...base, trunk: t, hip: t + 90 }); // Oberschenkel waagerecht auf der Bank
  const W = (P) => { const K = P.joints.knee; return [K[0] + 12, K[1] - 16]; }; // Handgelenk vor dem Knie, über dem Oberschenkel
  const elbowGap = (t) => { const P = pose(t), Wt = W(P), Q = solvePose({ ...base, trunk: t, hip: t + 90, armWorld: Wt, elbowSide: 1 }); const E = Q.joints.elbow, H = P.joints.hip, K = P.joints.knee;
    const d = [K[0] - H[0], K[1] - H[1]], l = Math.hypot(d[0], d[1]), n = [d[1] / l, -d[0] / l]; return (E[0] - H[0]) * n[0] + (E[1] - H[1]) * n[1] - 22; }; // Ellbogen 22 über der Oberschenkelachse
  const trunk = r1(bisect(elbowGap, 5, 75)), P = pose(trunk);
  return { base, trunk, wrist: W(P), top: 60 };
})();
// Farmer's Walk (Seitenansicht, auf der Stelle – die Hüfte bleibt im Bild, die Füße wandern wie auf einem Laufband nach hinten).
// Vier Bilder je Doppelschritt; Schritt ≈ 0,5 m (halbe Doppelschrittlänge 1,04 m bei Strongman-Athleten, Winwood et al. 2014 in Hindle et al. 2019),
// Füße bei ±42 vor/hinter der Hüfte; Rumpf 5° vor (Konvention; Strongman bei Höchstlast ≈ 12°). Beine per IK (legTo) zu den Fußzielen.
const FWK = (() => {
  const front = [42, -14], back = [-40, -30], under = [8, -15], swing = [-8, -48];
  const fr = (hy, near, nearFoot, far, farFoot) => ({ root: 'hip', rootPos: [0, hy], trunk: 5, ...legTo([0, hy], near), foot: nearFoot, leg2: { ankle: far, foot: farFoot } });
  const hyLow = r1(-14 - Math.sqrt(165 ** 2 - 42 ** 2)), hyHigh = -181;
  // Fußbahn eines Beins: Ziele und Fußwinkel; dazwischen Mittelbilder (gemittelte Ziele), damit der Knöchel der IK-Bahn folgt und der Fuß nicht in den Boden taucht
  const path = [[front, 80], [under, 90], [back, 125], [swing, 110]], hy = [hyLow, hyHigh, hyLow, hyHigh];
  const at = (i) => { const a = path[Math.floor(i) % 4], b = path[(Math.floor(i) + 1) % 4], u = i % 1; return [[r1(a[0][0] + (b[0][0] - a[0][0]) * u), r1(a[0][1] + (b[0][1] - a[0][1]) * u)], a[1] + (b[1] - a[1]) * u]; };
  const k = [];
  for (let i = 0; i < 8; i++) { const n = at(i / 2), f = at((i / 2 + 2) % 4), y = (hy[Math.floor(i / 2)] + hy[(Math.floor(i / 2) + 1) % 4]) / 2, h = i % 2 ? y - 1.5 : hy[i / 2];
    k.push(fr(r1(h), n[0], r1(n[1]), f[0], r1(f[1]))); }
  return { k };
})();
// Ausfallschritte gehend (Seitenansicht, Kamera folgt der Hüfte): abwechselnd links und rechts. Unten wie beim Ausfallschritt (Riemann et al. 2012,
// hinteres Knie knapp über dem Boden, LUNGE); dazwischen Aufrichten mit Durchschwingen des hinteren Beins und Aufsetzen ≈ 21 weiter vorn.
const WLG = (() => {
  const H = LUNGE.H, fx = r1(-H[0]), hb = H[1], tx = r1(fx + 21); // Hüfte bei x = 0; vorderer Knöchel unten bei +72, beim Aufsetzen 21 weiter vorn
  const ballB = r1(fx + LUNGE.ballX), ballT = r1(ballB + 21); // hinterer Ballen unten bzw. beim Aufsetzen (die Füße wandern im Bild nach hinten)
  const flat = (x) => ({ ankle: [x, -15], foot: 90 }), onBall = (x, phi) => ({ ball: x, foot: phi, ankle: footAnkle([x, -2], phi) }), air = { ankle: [-10, -50], foot: 110 };
  const hT = r1(-15 - Math.sqrt(164 ** 2 - tx ** 2));
  // Zustände [Hüfthöhe, nahes Bein, fernes Bein]; zwischen zwei Zuständen je 3 Teilbilder mit gemittelten Zielen (Ballen bleibt am Boden)
  const S = [[hb, flat(fx), onBall(ballB, LUNGE.phiB)], [-180, flat(10), air], [hT, onBall(ballT, 110), flat(tx)],
    [hb, onBall(ballB, LUNGE.phiB), flat(fx)], [-180, air, flat(10)], [hT, flat(tx), onBall(ballT, 110)]];
  const mixT = (a, b, u) => (a.ball !== undefined && b.ball !== undefined ? onBall(r1(a.ball + (b.ball - a.ball) * u), r1(a.foot + (b.foot - a.foot) * u))
    : { ankle: [r1(a.ankle[0] + (b.ankle[0] - a.ankle[0]) * u), r1(a.ankle[1] + (b.ankle[1] - a.ankle[1]) * u)], foot: r1(a.foot + (b.foot - a.foot) * u) });
  const pose = (hy, n, f) => ({ root: 'hip', rootPos: [0, hy], trunk: 3, ...legTo([0, hy], n.ankle), foot: n.foot, leg2: { ankle: f.ankle, foot: f.foot } });
  const k = [], seg = [];
  for (let i = 0; i < 6; i++) { const A = S[i], B = S[(i + 1) % 6];
    for (let j = 0; j < 3; j++) { const u = j / 3; k.push(pose(r1(A[0] + (B[0] - A[0]) * u), mixT(A[1], B[1], u), mixT(A[2], B[2], u))); seg.push(i); } }
  return { k, seg };
})();
// Belt Squat (Seitenansicht): Füße auf zwei Podesten (≈ 10 cm), Gurt um die Hüfte, Kette senkrecht zum Hebel unter dem Podest; Knöchel unter dem
// Gurt-Ansatz (Joseph et al. 2020). Rumpf möglichst aufrecht; Schienbein je Bild so gelöst, dass oben die Hüfte und unten der Gurt-Ansatz (≈ 22 vor dem
// Hüftgelenk) über dem Knöchel liegt (Gurt zieht senkrecht nach unten; Konvention). Tiefe 90° Kniebeugung (tiefste Testposition bei Varela-Olalla et al. 2024); Hände leicht am Griff vorn.
const BSQ = (() => {
  const PL = 20, root = { root: 'ankle', rootPos: [0, -15 - PL] };
  const solve = (knee, trunk) => { const sh = bisect((s) => solvePose({ ...root, shank: s, knee, trunk, ankle: s }).joints.hip[0] + 22 * knee / 90, -15, 60); // oben Hüfte über dem Knöchel, unten Hüftgelenk ≈ 22 dahinter (Gurt-Ansatz vorn an der Hüfte über dem Knöchel)
    return { shank: r1(sh), knee, trunk, ankle: r1(sh) }; };
  return { PL, root, top: solve(2, 2), mid: solve(45, 8), bottom: solve(90, 12), hand: [70, -170 - PL] };
})();
// Sissy Squat (Seitenansicht): Fußballen fest (Wurzel Ballen), Fersen heben sich, Knie wandern weit nach vorn, Hüfte gestreckt (Rumpf und
// Oberschenkel in einer Linie, Rücklage). Eine Hand hält einen Pfosten seitlich neben dem Körper. Keine Studie gefunden: alle Winkel Zeichenkonvention.
const SSQ = { post: 66, hand: [60, -200], ball: [30, -2] }; // Pfosten seitlich neben der Figur (hinter ihr gezeichnet), Hand in allen Bildern erreichbar

// ---------- v3.6.0: Animationen für die Mobilitätsroutine (Türrahmen-Push-up, Stuhl-Kniebeuge, Balanceboard-Wadenheben, Hüftkreisen) ----------
// Für diese Übungen gibt es keine gelesene Messstudie mit Gelenkwinkeln; Winkel sind übertragen oder Zeichenkonvention (so in den Datensätzen benannt).
// Türrahmen-Push-up (Seitenansicht): Hände fest am Türrahmen auf Brusthöhe (≈ 1,3 m, Konvention), Füße am Boden. Die Armbewegung ist die des Liegestützes
// (Suprak et al. 2013, Volltext) um 90° in die Waagerechte gedreht; die Körperneigung folgt daraus (Zehen auf dem Boden). Unten reicht die Brust bis auf die Höhe der Hände.
const DPU = (() => {
  const HY = -260, base = { root: 'wrist', rootPos: [0, HY], hip: 0, knee: 0, foot: 165, handFlat: 1 };
  const rot = (v) => [v[1], -v[0]]; // Liegestütz-Armgeometrie (Hände unter der Schulter) in die Waagerechte gedreht
  const top = { elbow: rot(FEPU.top.elbow).map(r1), wrist: [-104, -6].map((v) => -v).map(r1) };
  const fe = (a) => ({ elbow: rot(a.elbow).map(r1), wrist: rot(a.wrist).map(r1) });
  const t0 = { elbow: [52, 3], wrist: [104, 6] }, b0 = fe(FEPU.bottom);
  const mix = (u) => ({ elbow: t0.elbow.map((v, i) => r1(v + (b0.elbow[i] - v) * u)), wrist: t0.wrist.map((v, i) => r1(v + (b0.wrist[i] - v) * u)) });
  const sp = (arm) => ({ ...base, armPoints: arm, solve: { param: 'trunk', joint: 'toe', y: 0, range: [20, 150] } });
  const frontX = (P) => { let m = -1e9; for (const sh of shapesFor('male')) if (sh.id === 'body' && sh.seg === 'trunk') for (const q of sh.pts) m = Math.max(m, tf(P, sh.seg, q)[0]); return m; };
  const u = bisect((x) => frontX(solvePose(sp(mix(x)))) - 4, 0, 1);
  const P0 = solvePose(sp(t0)), P1 = solvePose(sp(mix(u)));
  return { HY, base, top: t0, bottom: mix(u), depth: r1(u), trunkTop: r1(P0.angles.trunk), trunkBottom: r1(P1.angles.trunk), sp };
})();
// Kniebeuge auf den Stuhl (Seitenansicht): Sitzhöhe ≈ Unterschenkellänge (Anan et al. 2017: Sitz auf die Länge des Unterschenkels eingestellt);
// Knie und Hüfte im Sitz sind Zeichenkonvention (Oberschenkel fast waagerecht, Rumpf ≈ 20° vor), der Sitz liegt unter dem tiefsten Punkt von Rumpf und Oberschenkel.
const CHSQ = (() => {
  const seat = { shank: 5, knee: 90, hip: 105, ankle: 5 }, stand = { shank: 0, knee: 3, hip: 3, ankle: 0 };
  const P = solvePose(seat);
  const sy = r1(lowSeg(P, ['trunk', 'thigh'])), hip = P.joints.hip.map(r1), knee = P.joints.knee.map(r1);
  return { seat, stand, seatY: sy, hip, knee };
})();
// Balanceboard-Wadenheben (Seitenansicht): Bewegung des Sprunggelenks wie beim stehenden Wadenheben (Larsen et al. 2025), Board als flache Platte
// unter beiden Füßen (Konvention: ≈ 40 cm breit, Kippachse mitten unter dem Fuß). Die Kippbewegung selbst wird nicht gezeigt: sie ist unregelmäßig und nicht gemessen.
const BAL = { w: 80, h: 6, axisR: 7, hand: [92, -255] }; // Fuß steht unten flach auf der Platte (Plattenoberkante y = −20) // Board, Rolle darunter, Hand an der Wand (Wand steht vor der Figur)
// Hüftkreisen (Frontansicht): Hände an der Hüfte, Becken verschiebt sich seitlich im Kreis; die Kreisbewegung nach vorn und hinten bleibt in der Frontansicht unsichtbar.
const HCIRC = (() => {
  const arms = { elbow: [16, 52], wrist: [-2, 102] }, A = 13; // Knöchel bleiben bei x = ±13 (Füße fest), das Becken wandert um ±12 (≈ 6 cm je Seite, Konvention)
  const at = (dx) => {
    const aR = bisect((a) => solveFront({ view: 'front', root: 'pelvis', rootPos: [dx, -183], legs: { abdR: a, abdL: 0 } }).joints.ankleR[0] - A, -20, 20);
    const aL = bisect((a) => solveFront({ view: 'front', root: 'pelvis', rootPos: [dx, -183], legs: { abdR: 0, abdL: a } }).joints.ankleL[0] + A, -20, 20);
    return { root: 'pelvis', rootPos: [dx, -183], legs: { abdR: C(r1(aR), 'Füße bleiben stehen'), abdL: C(r1(aL), 'Füße bleiben stehen') }, armPoints: arms };
  };
  return { arms, left: at(-12), right: at(12) };
})();

export const ANIMATIONS = [
  {
    ref: 'lateral-raise-dumbbell', view: 'front', basis: 'protocol',
    basisNote: 'Frontansicht. Keine Studie hat das Seitheben selbst vermessen. Endposition 90° Abduktion und fast gestreckter Ellbogen sind das Protokoll von Coratella et al. 2020 (EMG, 10 Bodybuilder, sitzend). Dass sich das Schulterblatt beim Anheben mitdreht (≈ 1° je 2,3° Oberarm), stammt aus Messungen ohne Last (Braman et al. 2009) und wird nicht gezeichnet. Stehend, Ebene der Bewegung in der Zeichnung frontal.',
    tempo: { basis: 'protocol', note: '2 s anheben, 0,5 s halten, 2 s absenken, 0,5 s halten (Metronom, Coratella et al. 2020).' },
    frames: [
      { label: 'Unten', pose: { arm: { abd: V(8, 'L1', 'protocol', 'Arm hängt neben dem Körper (Protokoll 0°, hier 8° wegen der Hanteln)'), elbow: C(12, 'fast gestreckt') }, legs: { hip: C(0), knee: C(0) }, props: raiseProps } },
      { label: 'Oben', pose: { arm: { abd: V(90, 'L1', 'protocol', 'bis 90° Abduktion (Protokollziel, nicht gemessen)'), elbow: C(12, 'fast gestreckt, bleibt gleich') }, legs: { hip: C(0), knee: C(0) }, props: raiseProps } }
    ],
    phases: [{ a: 0, b: 0, dur: 0.5, label: 'Unten', kp: [1, 3] }, { a: 0, b: 1, dur: 2.0, label: 'Anheben', kp: [0, 2] }, { a: 1, b: 1, dur: 0.5, label: 'Oben', kp: [0] }, { a: 1, b: 0, dur: 2.0, label: 'Absenken', kp: [4] }],
    keyPoints: [
      { short: 'Höhe', anchor: 'handR', side: 'r', status: 'consensus', text: 'Arme seitlich anheben, bis die Oberarme etwa waagerecht sind.', src: ['L1', 'L5'],
        explain: 'Zielwinkel 90° im Studienprotokoll (Coratella et al. 2020). Seitheben über 90° war in einer Querschnittsstudie mit Impingement-Zeichen assoziiert (Kolber et al. 2014, n = 77) – ein Zusammenhang, kein Beleg für eine Ursache.' },
      { short: 'Ellbogen', anchor: 'elbowL', side: 'l', status: 'single', text: 'Ellbogen fast gestreckt und während der Bewegung gleich lassen.', src: ['L1'],
        explain: 'Protokoll „fast gestreckt“; eine Variante mit 90° gebeugtem Ellbogen wurde in derselben Studie getestet. Ein Vergleich der Wirkung auf das Muskelwachstum liegt nicht vor.' },
      { short: 'Daumen', anchor: 'handL', side: 'l', status: 'contested', text: 'Daumen nach vorn oder leicht nach oben, nicht nach unten gedreht.', src: ['L1', 'L4', 'L6'],
        explain: 'Umstritten. Mit Daumen nach vorn war der mittlere Delta beim Anheben am aktivsten. Daumen nach unten erhöhte vor allem den hinteren Delta, den mittleren nur beim Absenken, beim Heben kaum (EMG, Coratella et al. 2020; Übersicht Rabello et al. 2022). Dagegen: Mit Daumen nach unten drehte das Schulterblatt etwas stärker nach innen (≈ 4–6°) und kippte etwas nach vorn (≈ 2–4°) (Thigpen et al. 2005, 20 Gesunde, leichtes Gewicht, Armheben schräg vor dem Körper). Das gilt als ungünstig für den Raum unter dem Schulterdach; gemessen wurde dieser Raum nicht, Verletzungsdaten gibt es nicht.' },
      { short: 'Rumpf', anchor: 'belly', side: 'r', status: 'single', text: 'Rumpf ruhig halten, nicht mit Schwung aus dem Oberkörper arbeiten.', src: ['L1'],
        explain: 'Die Studie ließ sitzend trainieren, um Rumpfbeteiligung zu vermeiden. Rumpfbewegung beim Seitheben wurde nie gemessen.' },
      { short: 'Ab', anchor: 'shoulderL', side: 'l', status: 'single', text: 'Kontrolliert absenken, etwa so langsam wie beim Anheben.', src: ['L1'],
        explain: 'Protokoll 2 s / 2 s (Coratella et al. 2020). Beim Absenken drehte das Schulterblatt in Messungen ohne Last etwas später zurück als es beim Anheben mitging (Braman et al. 2009).' }
    ],
    sources: {
      L1: { label: 'Coratella et al. 2020, Int J Environ Res Public Health', url: 'https://doi.org/10.3390/ijerph17176015', read: 'fulltext' },
      L3: { label: 'Braman et al. 2009, J Shoulder Elbow Surg', url: 'https://doi.org/10.1016/j.jse.2009.02.001', read: 'fulltext' },
      L4: { label: 'Thigpen et al. 2005, Am J Sports Med', url: 'https://doi.org/10.1177/0363546505281797', read: 'fulltext' },
      L5: { label: 'Kolber et al. 2014, J Strength Cond Res', url: 'https://doi.org/10.1519/JSC.0000000000000250', read: 'abstract' },
      L6: { label: 'Rabello et al. 2022, J Bodyw Mov Ther (Review)', url: 'https://doi.org/10.1016/j.jbmt.2022.12.002', read: 'fulltext' }
    }
  },
  {
    ref: 'shoulder-press-dumbbell', view: 'side', basis: 'protocol',
    basisNote: 'Keine Studie hat die Bewegung gemessen. Bank 85°, volle Ellbogenstreckung und Hände über den Schultergelenken sind Protokollvorgaben einer EMG-Studie (2013, 24 Frauen, 4,5 kg). Arme außerhalb der Bildebene verkürzt dargestellt; die Tiefe unten ist Konvention.',
    tempo: { basis: 'convention', note: 'Protokolle: selbst gewählt, „kontrolliert“ (EMG-Studie 2013); hier 1,2 s auf / 1,5 s ab.' },
    frames: [
      { label: 'Unten', pose: { root: 'hip', rootPos: [0, -98], trunk: V(-5, 'D1', 'protocol', 'Bank 85°'), hip: C(85), knee: C(90), foot: C(90, 'Fuß flach'), armPoints: { elbow: [14, 36], wrist: [20, -8] }, props: shoulderPressProps },
        facts: [V(1, 'D1', 'protocol', 'Umkehrpunkt: Hantelbewegung wechselt von abwärts nach aufwärts; keine Tiefe vorgegeben')] },
      { label: 'Oben', pose: { root: 'hip', rootPos: [0, -98], trunk: V(-5, 'D1', 'protocol', 'Bank 85°'), hip: C(85), knee: C(90), foot: C(90, 'Fuß flach'), armPoints: { elbow: [8, -50], wrist: [10, -102] }, props: shoulderPressProps },
        facts: [V(0, 'D1', 'protocol', 'volle Ellbogenstreckung, Hände über den Schultergelenken')] }
    ],
    phases: [{ a: 0, b: 0, dur: 0.1, label: 'Unten', kp: [0, 2] }, { a: 0, b: 1, dur: 1.2, label: 'Drücken', kp: [1] }, { a: 1, b: 1, dur: 0.4, label: 'Oben', kp: [1] }, { a: 1, b: 0, dur: 1.5, label: 'Absenken', kp: [2, 3] }],
    keyPoints: [
      { short: 'Bank', anchor: 'back', side: 'l', status: 'single', text: 'Bank fast senkrecht (≈ 85°) stellen; Rücken und Gesäß bleiben an der Lehne.', src: ['D1', 'S1'],
        explain: '85° Lehne in der EMG-Studie 2013; 10° Rücklage mit Kopf, Rücken und Gesäß an der Lehne beim sitzenden Drücken an der Multipresse (Hernández-Belmonte et al. 2020). Ein Lehnenvergleich wurde nicht untersucht.' },
      { short: 'Oben', anchor: 'wrist', side: 'r', status: 'consensus', text: 'Hanteln hochdrücken, bis die Ellbogen gestreckt sind; Hände über den Schultern.', src: ['D1', 'S5'],
        explain: 'Protokoll der EMG-Studie 2013 (volle Streckung, Hände über den Schultergelenken). Der volle Bewegungsumfang ergab meist mehr EMG-Aktivität als ein Stopp bei 90° Ellbogenwinkel (Paoli et al. 2010, n = 6).' },
      { short: 'Ab', anchor: 'elbow', side: 'r', status: 'single', text: 'Kontrolliert absenken und unten ohne Pause wenden.', src: ['D1'],
        explain: 'Umkehrpunkt im Protokoll: der Moment, in dem die Hantel die Richtung wechselt; eine Tiefe wurde nicht vorgegeben oder gemessen.' },
      { short: 'Hanteln', anchor: 'hand', side: 'r', status: 'single', text: 'Kurzhanteln fordern die vordere Schulter etwas mehr; im Stehen etwas weniger Gewicht.', src: ['S6', 'D3'],
        explain: 'Sitzend war die vordere Schulter mit Kurzhanteln ≈ 11 % aktiver als mit der Langhantel; das 1RM mit Kurzhanteln lag stehend ≈ 7 % unter dem der Langhantel (Saeterbakken & Fimland 2013, n = 15, Volltext). Mit Kurzhanteln lag das 10RM bei ≈ 86 % der Langhantel, die Trizepsaktivität war niedriger, die vordere Schulter gleich aktiv (Kohler et al. 2010, n = 30, sitzend ohne Lehne). Im Sitzen war das 1RM mit Kurz- und Langhantel etwa gleich.' }
    ],
    sources: {
      D1: { label: 'Luczak et al. 2013, J Sports Med', url: 'https://doi.org/10.1155/2013/612650', read: 'fulltext' },
      D3: { label: 'Kohler et al. 2010, J Strength Cond Res', url: 'https://doi.org/10.1519/JSC.0b013e3181c8655a', read: 'fulltext' },
      S1: { label: 'Hernández-Belmonte et al. 2020, Biol Sport', url: 'https://doi.org/10.5114/biolsport.2020.98453', read: 'fulltext' },
      S5: { label: 'Paoli et al. 2010, J Strength Cond Res', url: 'https://doi.org/10.1519/JSC.0b013e3181d756ea', read: 'fulltext' },
      S6: { label: 'Saeterbakken & Fimland 2013, J Strength Cond Res', url: 'https://doi.org/10.1519/JSC.0b013e318276b873', read: 'fulltext' }
    }
  },
  {
    ref: 'dumbbell-curl', view: 'side', basis: 'measured',
    basisNote: 'Bewegungsumfang des Ellbogens aus Marcolin et al. 2018 (Elektrogoniometer, 12 trainierte Männer, 65 % 1RM, Volltext): 123,1 ± 12,3°. Absolute Start- und Endwinkel wurden nicht berichtet; Start ≈ 15° Beugung ist Konvention, der obere Winkel folgt daraus. Leichte Vorbewegung des Ellbogens oben ist Konvention.',
    tempo: { basis: 'measured', note: 'Konzentrisch 1,44 ± 0,26 s, exzentrisch 1,72 ± 0,47 s bei Metronomvorgabe 3 s je Wiederholung (Marcolin et al. 2018).' },
    frames: [
      { label: 'Unten', pose: { shank: C(0), knee: C(3), hip: C(0), ankle: C(0), shoulder: C(0), elbow: C(15, 'fast gestreckt; Start nicht gemessen'), props: curlProps } },
      { label: 'Oben', pose: { shank: C(0), knee: C(3), hip: C(0), ankle: C(0), shoulder: C(8, 'leichte Vorbewegung des Ellbogens; nicht gemessen'), elbow: K(138, 'S1', 'Start 15° + gemessener Bewegungsumfang 123,1 ± 12,3°'), props: curlProps } }
    ],
    phases: [{ a: 0, b: 0, dur: 0.3, label: 'Unten', kp: [0, 1] }, { a: 0, b: 1, dur: 1.44, label: 'Beugen', kp: [1, 3] }, { a: 1, b: 1, dur: 0.2, label: 'Oben', kp: [2] }, { a: 1, b: 0, dur: 1.72, label: 'Senken', kp: [4] }],
    keyPoints: [
      { short: 'Oberarm', anchor: 'uarm', side: 'l', status: 'single', text: 'Oberarme bleiben seitlich am Körper; nur der Unterarm bewegt sich.', src: ['S1', 'S2'],
        explain: 'Haltung in den Protokollen: stehend, Arme seitlich am Körper (Oliveira et al. 2009; Marcolin et al. 2018). Wie weit der Ellbogen tatsächlich nach vorn wandert, wurde in keiner begutachteten Studie gemessen.' },
      { short: 'Rumpf', anchor: 'chest', side: 'r', status: 'single', text: 'Rumpf und Knie ruhig halten – kein Schwung aus dem Körper.', src: ['S1'],
        explain: 'Rumpfbewegung und Kniebeugung wurden in Marcolin et al. 2018 per Sichtkontrolle unterbunden; gemessen wurde das Ausweichen nicht.' },
      { short: 'Weg', anchor: 'hand', side: 'r', status: 'single', text: 'Unten den Arm fast strecken, oben so weit beugen, wie es ohne Ausweichen geht.', src: ['S1'],
        explain: 'Gemessener Umfang 123,1 ± 12,3° mit Kurzhanteln (Marcolin et al. 2018). Start- und Endwinkel wurden nicht berichtet.' },
      { short: 'Hand', anchor: 'wrist', side: 'r', status: 'single', text: 'Handfläche dreht beim Heben nach oben (ab etwa halber Beugung).', src: ['S1'],
        explain: 'Beschreibung der Kurzhantelcurls durch die Autoren (halb gedreht am Start, supiniert ab ≈ 90° Beugung), keine Messung. Ob die Drehung die Bizepsaktivität erhöht, wurde dort nicht geprüft.' },
      { short: 'Variante', anchor: 'elbow', side: 'l', status: 'single', text: 'Mit Kurzhanteln war der Bewegungsumfang etwas größer als mit SZ- oder gerader Stange.', src: ['S1', 'S2'],
        explain: 'Kurzhantel 123,1°, SZ-Stange 119,9°, gerade Stange 117,3° (Marcolin et al. 2018; der Text der Studie widerspricht an einer Stelle den eigenen Mittelwerten). Stehende und Schrägbank-Curls aktivierten den Bizeps über den ganzen Weg ähnlich, Scott-Curls nur über einen kurzen Bereich (Oliveira et al. 2009, 22 trainierte Männer, Volltext).' }
    ],
    sources: {
      S1: { label: 'Marcolin et al. 2018, PeerJ', url: 'https://doi.org/10.7717/peerj.5165', read: 'fulltext' },
      S2: { label: 'Oliveira et al. 2009, J Sports Sci Med', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC3737788/', read: 'fulltext' }
    }
  },
  {
    ref: 'dumbbell-reverse-lunge', checkedAt: '2026-10-19', view: 'side', basis: 'transfer',
    basisNote: 'Winkel des vorderen Beins unten vom Ausfallschritt vorwärts übertragen (Riemann et al. 2012, Tabelle 1 am PDF geprüft). Comfort et al. 2015 (9 Männer, 3D, Volltext) fanden zwischen vorwärts und rückwärts keine Unterschiede in Hüft- und Kniewinkel; ihr Kniewert ist im Text (114,9°) und in der Tabelle (63,7–66,6°) widersprüchlich und wird deshalb nicht übernommen. Auch die Momente in Tabelle und Text passen nicht zusammen. Seit v2.20.0 setzt der hintere Fußballen auf, bevor die Figur absenkt, und das hintere Knie liegt unten knapp über dem Boden unter der Hüfte (Konvention); daraus folgt die Schrittlänge (≈ 0,69 m, berechnet). Hüftbahn und hinteres Bein sind Konvention.',
    tempo: { basis: 'protocol', note: '3 s ab / 2 s auf in festem Takt (Comfort et al. 2015); hier kürzer mit Schrittphase (Konvention).' },
    frames: [
      { label: 'Stand', pose: { shank: C(0), knee: C(0), hip: C(0), ankle: C(0), leg2: { ankle: [-4, -15], foot: C(90) }, armPlumb: true, elbow: C(0), props: revLungeProps } },
      { label: 'Schritt', pose: { shank: C(RVL.swing.leg.shank, 'aus der Hüftbahn gelöst'), knee: C(RVL.swing.leg.knee), trunk: C(2), ankle: C(RVL.swing.leg.shank, 'Fuß flach'), leg2: { ankle: RVL.swing.ankle, foot: C(RVL.swing.foot) }, armPlumb: true, elbow: C(0), props: revLungeProps } },
      { label: 'Aufsetzen', pose: { shank: C(RVL.touch.leg.shank, 'aus der Hüftbahn gelöst'), knee: C(RVL.touch.leg.knee), trunk: C(4), ankle: C(RVL.touch.leg.shank, 'Fuß flach'), leg2: RVL.back(125), armPlumb: true, elbow: C(0), props: revLungeProps } },
      { label: 'Unten', pose: { shank: V(11.4, 'L1', 'computed', 'übertragen: gleich der Dorsalflexion'), knee: V(96.4, 'L1', 'fulltext', 'übertragen: 96,4 ± 10,7° (vorwärts)'), hip: V(84.3, 'L1', 'fulltext', 'übertragen: 84,3 ± 14,9° (vorwärts)'), ankle: V(11.4, 'L1', 'fulltext', 'übertragen: 11,4 ± 8,1°'), leg2: RVL.back(LUNGE.phiB), armPlumb: true, elbow: C(0), props: revLungeProps },
        facts: [V(99.3, 'C2', 'fulltext', 'Comfort et al. 2015 rückwärts: Hüftbeugung 99,3 ± 6,7° (vorwärts 93,2°, kein signifikanter Unterschied)'), V(22.2, 'C2', 'fulltext', 'Comfort et al. 2015 rückwärts: Dorsalflexion 22,2 ± 4,8°')] }
    ],
    phases: [{ a: 0, b: 0, dur: 0.5, label: 'Stand', kp: [0] }, { a: 0, b: 1, dur: 0.45, label: 'Schritt zurück', kp: [0] }, { a: 1, b: 2, dur: 0.4, label: 'Aufsetzen', kp: [0] }, { a: 2, b: 3, dur: 1.0, label: 'Absenken', kp: [1, 2] }, { a: 3, b: 3, dur: 0.3, label: 'Unten', kp: [2] }, { a: 3, b: 2, dur: 0.8, label: 'Hochdrücken', kp: [3] }, { a: 2, b: 1, dur: 0.4, label: 'Hochdrücken', kp: [3] }, { a: 1, b: 0, dur: 0.45, label: 'Stand', kp: [4] }],
    keyPoints: [
      { short: 'Schritt', anchor: 'foot2', side: 'l', status: 'single', text: 'Mit einem Bein weit nach hinten treten, der vordere Fuß bleibt stehen.', src: ['C2'],
        explain: 'Protokoll in Comfort et al. 2015: Stand auf einer Kraftmessplatte, Schritt zurück auf die zweite, der vordere Fuß bleibt die ganze Zeit am Boden.' },
      { short: 'Vorne', anchor: 'knee', side: 'r', status: 'single', text: 'Das vordere Bein trägt die Last; Knie etwa 90° beugen.', src: ['L1', 'C2'],
        explain: 'Winkel übertragen vom Ausfallschritt vorwärts (Riemann et al. 2012). Wie sich die Last auf vorderes und hinteres Bein verteilt, wurde dort nicht gemessen. Comfort et al. 2015 fanden keinen Unterschied in Hüft- und Kniewinkel zwischen vorwärts und rückwärts.' },
      { short: 'Hüfte', anchor: 'hip', side: 'l', status: 'single', text: 'Rückwärts arbeitet die Hüfte etwas weniger als vorwärts.', src: ['C2'],
        explain: 'Das Hüftmoment war beim Ausfallschritt vorwärts größer als rückwärts (Comfort et al. 2015, 9 Männer, Körpergewicht). Der Kniewinkel war bei beiden ähnlich. Das Kniemoment war vorwärts laut Text größer, die Tabelle zeigt es anders.' },
      { short: 'Rumpf', anchor: 'chest', side: 'r', status: 'single', text: 'Oberkörper aufrecht halten. Rückwärts neigt er sich meist mehr vor (etwa 22° statt 7°).', src: ['G2'],
        explain: 'Goulette et al. 2021 (20 Frauen, 3D, Schrittlänge 75 % der Beinlänge, Oberschenkel waagerecht, Volltext): rückwärts 22° Rumpfvorneigung und 97° Kniebeugung, vorwärts 7° und 103°. Die gezeigte Haltung ist übertragen.' },
      { short: 'Zurück', anchor: 'hand', side: 'l', status: 'single', text: 'Über das vordere Bein hochdrücken und den hinteren Fuß zurückstellen.', src: ['C2'],
        explain: 'Ablauf im Protokoll von Comfort et al. 2015; Hanteln hängen locker an den Seiten (Konvention, vgl. Riemann et al. 2012).' }
    ],
    sources: {
      L1: { label: 'Riemann et al. 2012, J Athl Train', url: 'https://doi.org/10.4085/1062-6050-47.4.16', read: 'fulltext', note: 'Ausfallschritt vorwärts, übertragen' },
      C2: { label: 'Comfort et al. 2015, J Athl Train', url: 'https://doi.org/10.4085/1062-6050-50.9.05', read: 'fulltext', note: 'Kniewinkel in Text und Tabelle widersprüchlich' },
      G2: { label: 'Goulette et al. 2021, Phys Ther Sport', url: 'https://doi.org/10.1016/j.ptsp.2020.12.001', read: 'fulltext' }
    }
  },
  {
    ref: 'dumbbell-front-raise', checkedAt: '2026-10-19', view: 'side', basis: 'protocol',
    basisNote: 'Keine Bewegungsstudie. Aufbau nach Coratella et al. 2020 (Volltext, 10 Bodybuilder, 8-RM-Last): im Sitzen, damit der untere Rücken nicht mithilft; Oberarm in neutraler Drehung mit gestrecktem Ellbogen nach vorn bis 90° Schulterbeugung. Leicht gebeugter Ellbogen (≈ 10°), Bank und Hantelgröße sind Konvention.',
    tempo: { basis: 'protocol', note: '2 s heben, 0,5 s halten, 2 s senken, 0,5 s halten (Metronom, Coratella et al. 2020).' },
    frames: [
      { label: 'Unten', pose: { root: 'hip', rootPos: [0, -96], trunk: V(0, 'F1', 'protocol', 'sitzend, aufrecht'), hip: C(90), knee: C(90), foot: C(90, 'Füße flach'), shoulder: C(8, 'Arm hängt vor dem Oberschenkel'), elbow: C(10, 'fast gestreckt'), props: frontRaiseProps } },
      { label: 'Oben', pose: { root: 'hip', rootPos: [0, -96], trunk: V(0, 'F1', 'protocol', 'sitzend, aufrecht'), hip: C(90), knee: C(90), foot: C(90, 'Füße flach'), shoulder: V(90, 'F1', 'protocol', 'Schulterbeugung bis 90°'), elbow: C(10, 'fast gestreckt, bleibt gleich'), props: frontRaiseProps } }
    ],
    phases: [{ a: 0, b: 0, dur: 0.5, label: 'Unten', kp: [3] }, { a: 0, b: 1, dur: 2.0, label: 'Heben', kp: [0, 1] }, { a: 1, b: 1, dur: 0.5, label: 'Oben', kp: [0, 2] }, { a: 1, b: 0, dur: 2.0, label: 'Senken', kp: [4] }],
    keyPoints: [
      { short: 'Höhe', anchor: 'hand', side: 'r', status: 'single', text: 'Arme vorn anheben, bis sie etwa auf Schulterhöhe sind (90°).', src: ['F1'],
        explain: 'Zielwinkel im Protokoll von Coratella et al. 2020. Höhere Endpositionen wurden dort nicht verglichen.' },
      { short: 'Ellbogen', anchor: 'elbow', side: 'r', status: 'single', text: 'Ellbogen gestreckt lassen, Oberarm nicht nach innen oder außen drehen.', src: ['F1'],
        explain: 'Protokoll: gestreckter Ellbogen, Oberarm in neutraler Drehung (Coratella et al. 2020). Die Figur zeigt ihn leicht gebeugt.' },
      { short: 'Muskeln', anchor: 'chest', side: 'l', status: 'single', text: 'Arbeitet vor allem den vorderen Delta und den oberen Brustmuskel.', src: ['F1'],
        explain: 'Bei Bodybuildern waren vorderer Deltamuskel und oberer (klavikulärer) Brustmuskel beim Frontheben aktiver als bei allen Seitheben-Varianten; seitlicher und hinterer Delta spielten kaum eine Rolle (Coratella et al. 2020). EMG ist kein Maß für Muskelwachstum.' },
      { short: 'Rumpf', anchor: 'lowBack', side: 'l', status: 'single', text: 'Im Sitzen geübt, damit der untere Rücken nicht mit Schwung hilft.', src: ['F1'],
        explain: 'Die Autoren ließen im Sitzen üben, um die Lendenmuskeln herauszuhalten (Coratella et al. 2020). Wie stark der Rumpf im Stehen ausweicht, wurde nicht gemessen.' },
      { short: 'Tempo', anchor: 'uarm', side: 'l', status: 'single', text: 'Gleichmäßig: 2 s heben, kurz halten, 2 s senken.', src: ['F1'],
        explain: 'Tempovorgabe per Metronom (Coratella et al. 2020). Andere Tempi wurden nicht verglichen.' }
    ],
    sources: {
      F1: { label: 'Coratella et al. 2020, Int J Environ Res Public Health', url: 'https://doi.org/10.3390/ijerph17176015', read: 'fulltext' }
    }
  },
  {
    ref: 'dumbbell-triceps-kickback', checkedAt: '2026-10-19', view: 'side', basis: 'convention',
    basisNote: 'Protokoll aus Serbest et al. 2025 (PDF geprüft): über eine Bank gebeugt, Oberkörper waagerecht, Schulter fest, Ellbogen 90° → gestreckt (gemessen 75–175° Innenwinkel). Gezeichnet auf derselben Bank wie das einarmige Rudern: Knie und Hand der Gegenseite auf der Bank, Oberarm waagerecht neben dem Rumpf, Ellbogen 90° → 0°. Der Rumpf ≈ 20° über der Waagerechten ist Zeichenkonvention und weicht vom Protokoll ab.',
    tempo: { basis: 'convention', note: '≈ 1,5 s strecken, 1,5 s beugen (Konvention); kein Tempo untersucht.' },
    frames: [
      { label: 'Gebeugt', pose: { ...ONE_ROW.pose, shoulder: C(-20, 'Oberarm waagerecht neben dem Rumpf'), elbow: C(90, 'Unterarm hängt senkrecht'), props: kickbackDbProps } },
      { label: 'Gestreckt', pose: { ...ONE_ROW.pose, shoulder: C(-20, 'Oberarm bleibt stehen'), elbow: C(0, 'gestreckt'), props: kickbackDbProps } }
    ],
    phases: [{ a: 0, b: 0, dur: 0.3, label: 'Gebeugt', kp: [0] }, { a: 0, b: 1, dur: 1.5, label: 'Strecken', kp: [0, 1] }, { a: 1, b: 1, dur: 0.3, label: 'Gestreckt', kp: [1, 2] }, { a: 1, b: 0, dur: 1.5, label: 'Beugen', kp: [3] }],
    keyPoints: [
      { short: 'Oberarm', anchor: 'uarm', side: 'l', status: 'single', text: 'Oberarm bleibt neben dem Rumpf; nur der Unterarm streckt nach hinten.', src: ['K3'],
        explain: 'Mit dem Oberarm parallel zum Rumpf (wie bei 0° Schulterhebung) trug in einer Modellrechnung der lange Kopf den größten Teil der Kraft (Kholinne et al. 2018, ohne Last, 10 Personen). Für den Kickback selbst ist das nicht gemessen.' },
      { short: 'Gewicht', anchor: 'hand', side: 'r', status: 'single', text: 'Gewicht behutsam steigern: mit 5 statt 2 kg kaum mehr Trizeps, aber schlechtere Streckung.', src: ['S1'],
        explain: 'Serbest et al. 2025 (14 trainierte Frauen, 2 und 5 kg, Halte-Pausen bei 90°, 135° und gestrecktem Arm): Die Trizepsaktivität (EMG) unterschied sich zwischen den Gewichten kaum. Am höchsten war sie bei gestrecktem Arm. Mit 5 kg erreichten die Frauen die volle Streckung seltener. Nur zwei Gewichte und eine kleine Gruppe.' },
      { short: 'Strecken', anchor: 'elbow', side: 'r', status: 'single', text: 'Arm hinten ganz strecken: Dort war der Trizeps am aktivsten.', src: ['S1'],
        explain: 'Serbest et al. 2025 (Volltext): Haltepausen bei 90°, 135° und gestrecktem Arm (≈ 180°). In jedem Durchgang und mit beiden Gewichten war die Trizepsaktivität (EMG) bei gestrecktem Arm am höchsten und bei 90° am niedrigsten. Eine Studie, kleine Gruppe; EMG zeigt Aktivierung, nicht Wachstum.' },
      { short: 'Wachstum', anchor: 'chest', side: 'l', status: 'single', text: 'Strecken überkopf brachte mehr Wachstum als mit hängendem Arm.', src: ['X1'],
        explain: 'Übertrag: Maeo et al. 2022 verglichen Kabelstrecken mit dem Arm am Körper und überkopf (MRT, 12 Wochen); überkopf wuchs der Trizeps etwa 1,4-mal so stark. Der Kickback wurde nicht untersucht. Beim Kickback ist der Oberarm sogar hinter dem Körper; der lange Kopf ist dort eher noch kürzer als in der neutralen Haltung.' }
    ],
    sources: {
      K3: { label: 'Kholinne et al. 2018, Acta Orthop Traumatol Turc', url: 'https://doi.org/10.1016/j.aott.2018.02.005', read: 'fulltext' },
      S1: { label: 'Serbest et al. 2025, Phys Eng Sci Med', url: 'https://doi.org/10.1007/s13246-025-01672-5', read: 'fulltext' },
      X1: { label: 'Maeo et al. 2022, Eur J Sport Sci', url: 'https://doi.org/10.1080/17461391.2022.2100279', read: 'fulltext' }
    }
  },
  {
    ref: 'floor-crunch', checkedAt: '2026-10-20', view: 'side', basis: 'protocol',
    basisNote: 'Keine gelesene Studie hat den Crunch mit Bewegungsmessung des Rumpfs erfasst. Start und Ende folgen den Protokollen von Escamilla et al. 2006, Youdas et al. 2008, Barbado et al. 2015 und Lee et al. 2016 (alle Volltext): Rückenlage, Knie etwa 90°, Füße auf dem Boden; einrollen, bis die Schulterblätter von der Matte abheben. Wie weit sich der Rumpf dabei beugt, ist nicht gemessen: Die Beugung ist so gelöst, dass der untere Schulterblattrand ≈ 4 cm abhebt, und verteilt sich in der Zeichnung auf die untere Brust- und Lendenwirbelsäule (Zeichenkonvention). Die Hüfte ist so gelöst, dass der Fuß flach steht (Protokoll ≈ 45°). Matte, Kopfhaltung und Ellbogen sind Konvention.',
    tempo: { basis: 'protocol', note: '1 s hoch, 1 s halten, 1 s ab, 1 s Pause (Metronom; Escamilla et al. 2006, ähnlich Youdas et al. 2008).' },
    frames: [
      { label: 'Unten', pose: { root: 'hip', rootPos: [0, FLOOR.hipY], trunk: C(FLOOR.lie, 'Rückenlage; Gesäß und Schulterblätter liegen auf'), curl: C(0), hip: K(FLOOR.hookHip, 'E1', 'so gelöst, dass der Fuß flach steht (Protokoll ≈ 45°)'), knee: V(90, ['E1', 'Y1', 'B1'], 'protocol', 'Knie etwa 90°'), foot: C(90, 'Fuß flach'), headTilt: C(0), armTargetTrunk: [-2, 38], armScale: [0.35, 0.7], elbowSide: 1, props: matProps } },
      { label: 'Oben', pose: { root: 'hip', rootPos: [0, FLOOR.hipY], trunk: C(FLOOR.lie, 'Becken bleibt liegen'), curl: K(FLOOR.crunchCurl, ['E1', 'Y1', 'B1'], 'so gelöst, dass der untere Schulterblattrand ≈ 4 cm von der Ausgangslage abhebt'), hip: K(FLOOR.hookHip, 'E1'), knee: V(90, ['E1', 'Y1', 'B1'], 'protocol'), foot: C(90), headTilt: C(10, 'Kinn leicht zur Brust'), armTargetTrunk: [-2, 38], armScale: [0.35, 0.7], elbowSide: 1, props: matProps } }
    ],
    phases: [{ a: 0, b: 0, dur: 1.0, label: 'Unten', kp: [0] }, { a: 0, b: 1, dur: 1.0, label: 'Einrollen', kp: [1, 3] }, { a: 1, b: 1, dur: 1.0, label: 'Oben', kp: [1, 2] }, { a: 1, b: 0, dur: 1.0, label: 'Ablegen', kp: [2, 4] }],
    keyPoints: [
      { short: 'Start', anchor: 'foot', side: 'r', status: 'consensus', text: 'Rückenlage, Füße flach auf dem Boden, Knie etwa 90° gebeugt.', src: ['E1', 'Y1', 'B1', 'L1'],
        explain: 'So beginnen alle vier gelesenen Protokolle (Escamilla et al. 2006, Youdas et al. 2008, Barbado et al. 2015, Lee et al. 2016). Die Hüfte ist dort etwa 45° gebeugt. Die Hände lagen je nach Studie an den Ohren, gekreuzt vor der Brust oder neben dem Körper.' },
      { short: 'Schulter', anchor: 'upperBack', side: 'l', status: 'consensus', text: 'Oberkörper einrollen, bis die Schulterblätter von der Matte abheben.', src: ['E1', 'Y1', 'B1', 'L1'],
        explain: 'Das ist in allen gelesenen Protokollen der obere Umkehrpunkt. Ein Winkel ist dafür nicht gemessen. Ob ein höheres Aufrichten mehr bringt, ist offen.' },
      { short: 'Lende', anchor: 'lowBack', side: 'l', status: 'single', text: 'Die Lendenwirbelsäule bleibt auf der Matte; nur der obere Rücken rollt ein.', src: ['B1', 'H1'],
        explain: 'Barbado et al. 2015 beschreiben den Crunch mit aufliegender Lendenregion. Halpern & Bleck 1979 (Abstract) maßen beim Anheben bis zu den Schulterblättern ≈ 3° Lendenbeugung, beim vollen Sit-up ≈ 38°.' },
      { short: 'Nacken', anchor: 'chin', side: 'l', status: 'single', text: 'Kinn leicht eingezogen; den Kopf nicht mit den Händen nach vorn ziehen.', src: ['L1'],
        explain: 'Lee et al. 2016 (13 Männer, EMG): Wurde die Nackenbeugung begrenzt (Kinn eingezogen, Hand leicht am Kiefer), war der Kopfwender weniger und der gerade und schräge Bauchmuskel mehr aktiv. Winkel wurden nicht gemessen.' },
      { short: 'Tempo', anchor: 'belly', side: 'r', status: 'single', text: 'Gleichmäßig: etwa 1 s hoch, 1 s halten, 1 s ab.', src: ['E1', 'B1'],
        explain: 'Takt der Protokolle von Escamilla et al. 2006 und Youdas et al. 2008. Barbado et al. 2015 (17 Aktive) testeten 1 Wiederholung je 4 s bis je 1 s: auch schnell blieb die Bahn seitlich gleich stabil, die Ausgleichsbewegungen am Boden nahmen aber zu.' }
    ],
    sources: {
      E1: { label: 'Escamilla et al. 2006, Phys Ther', url: 'https://pubmed.ncbi.nlm.nih.gov/16649890/', read: 'fulltext' },
      Y1: { label: 'Youdas et al. 2008, J Strength Cond Res', url: 'https://doi.org/10.1519/JSC.0b013e31818745bf', read: 'fulltext' },
      B1: { label: 'Barbado et al. 2015, J Hum Kinet', url: 'https://doi.org/10.1515/hukin-2015-0031', read: 'fulltext' },
      L1: { label: 'Lee et al. 2016, J Phys Ther Sci', url: 'https://doi.org/10.1589/jpts.28.90', read: 'fulltext' },
      H1: { label: 'Halpern & Bleck 1979, Clin Orthop Relat Res', url: 'https://pubmed.ncbi.nlm.nih.gov/161217/', read: 'abstract' }
    }
  },
  {
    ref: 'wrist-curl', checkedAt: '2026-10-21', view: 'side', basis: 'protocol',
    basisNote: 'Keine Studie hat Handgelenkcurls mit Kurzhantel gemessen. Protokoll nach Takamori et al. 2026 (Volltext, 13 Gesunde): Unterarm fixiert, Handfläche oben, Start mit waagerechter Hand (0°), gegen die Schwerkraft voll beugen, 1 s halten, 2-s-Takt. Einen Gradwert für „voll gebeugt“ nennt die Studie nicht; gezeichnet sind 60° (Alltag braucht bis 54° Beugung, Ryu et al. 1991, Abstract). Bank, Unterarm auf dem Oberschenkel und Rumpfneigung (aus der Geometrie gelöst) sind Konvention.',
    tempo: { basis: 'protocol', note: '1 s heben, 1 s halten, 1 s senken (2-s-Takt mit Halten, Takamori et al. 2026; 0,5 Hz in Haslam & Cobb 1983).' },
    frames: [
      { label: 'Waagerecht', pose: { ...WCURL.base, trunk: C(WCURL.trunk, 'aus der Geometrie: Unterarm auf dem Oberschenkel'), hip: C(WCURL.trunk + 90), armWorld: WCURL.wrist, elbowSide: 1, wrist: V(0, 'T1', 'protocol', 'Hand waagerecht'), props: wristCurlProps } },
      { label: 'Gebeugt', pose: { ...WCURL.base, trunk: C(WCURL.trunk), hip: C(WCURL.trunk + 90), armWorld: WCURL.wrist, elbowSide: 1, wrist: C(WCURL.top, 'voll gebeugt; Gradwert Konvention (Alltag: bis 54°, Ryu et al. 1991)'), props: wristCurlProps } }
    ],
    phases: [{ a: 0, b: 0, dur: 0.4, label: 'Waagerecht', kp: [0] }, { a: 0, b: 1, dur: 1.0, label: 'Beugen', kp: [1] }, { a: 1, b: 1, dur: 1.0, label: 'Halten', kp: [2] }, { a: 1, b: 0, dur: 1.0, label: 'Senken', kp: [3] }],
    keyPoints: [
      { short: 'Auflage', anchor: 'elbow', side: 'l', status: 'single', text: 'Unterarm auflegen, Handfläche nach oben – nur das Handgelenk bewegt sich.', src: ['T1'],
        explain: 'Im MRT-Protokoll (13 Gesunde) war der Unterarm fixiert und die Hand supiniert; nur das Handgelenk beugte gegen die Schwerkraft (Takamori et al. 2026). Zur Auflage auf Bank oder Oberschenkel gibt es keine Studie.' },
      { short: 'Ohne Last', anchor: 'hand', side: 'r', status: 'single', text: 'Schon ohne Gewicht arbeiten die Beuger, wenn man gegen die Schwerkraft beugt.', src: ['T1'],
        explain: '150 Beugungen nur mit dem Handgewicht (≈ 350 g) gegen die Schwerkraft brachten mehrere Beugemuskeln in den anaeroben Bereich (MRT, etwa die Hälfte der Messungen); waagerechte Bewegungen nicht (Takamori et al. 2026).' },
      { short: 'Oben', anchor: 'wrist', side: 'r', status: 'single', text: 'Voll beugen, oben kurz halten, dann kontrolliert zurück in die Waagerechte.', src: ['T1'],
        explain: 'Protokoll: volle Beugung, 1 s halten, zurück, im 2-s-Takt (Takamori et al. 2026). Ein Gradwert wird nicht genannt.' },
      { short: 'Weg', anchor: 'knee', side: 'r', status: 'single', text: 'Zum Vergleich: Im Alltag reichen etwa 54° Beugung und 60° Streckung.', src: ['R1'],
        explain: '40 Gesunde mit Elektrogoniometer: Alle getesteten Alltagsaufgaben gelangen mit 60° Streckung und 54° Beugung (Ryu et al. 1991, Abstract). Das ist eine Orientierung, kein Trainingsbefund.' }
    ],
    sources: {
      T1: { label: 'Takamori et al. 2026, Prog Rehabil Med', url: 'https://doi.org/10.2490/prm.20260037', read: 'fulltext' },
      R1: { label: 'Ryu et al. 1991, J Hand Surg Am', url: 'https://doi.org/10.1016/0363-5023(91)90006-w', read: 'abstract' },
      H1: { label: 'Haslam & Cobb 1983, Med Sci Sports Exerc', url: 'https://pubmed.ncbi.nlm.nih.gov/6645860/', read: 'abstract' }
    }
  },
  {
    ref: 'reverse-wrist-curl', checkedAt: '2026-10-21', view: 'side', basis: 'protocol',
    basisNote: 'Wie die Handgelenkcurls, aber Handrücken oben: Takamori et al. 2026 (Volltext) ließen aus der Waagerechten gegen die Schwerkraft voll strecken, 1 s halten, im 2-s-Takt. Gezeichnet sind 50° Streckung (Gradwert Konvention; Alltag bis 60°, Ryu et al. 1991). Bank, Auflage und Rumpfneigung sind Konvention.',
    tempo: { basis: 'protocol', note: '1 s heben, 1 s halten, 1 s senken (Takamori et al. 2026).' },
    frames: [
      { label: 'Waagerecht', pose: { ...WCURL.base, trunk: C(WCURL.trunk, 'aus der Geometrie: Unterarm auf dem Oberschenkel'), hip: C(WCURL.trunk + 90), armWorld: WCURL.wrist, elbowSide: 1, wrist: V(0, 'T1', 'protocol', 'Hand waagerecht'), props: wristCurlProps } },
      { label: 'Gestreckt', pose: { ...WCURL.base, trunk: C(WCURL.trunk), hip: C(WCURL.trunk + 90), armWorld: WCURL.wrist, elbowSide: 1, wrist: C(50, 'voll gestreckt; Gradwert Konvention'), props: wristCurlProps } }
    ],
    phases: [{ a: 0, b: 0, dur: 0.4, label: 'Waagerecht', kp: [0] }, { a: 0, b: 1, dur: 1.0, label: 'Strecken', kp: [1] }, { a: 1, b: 1, dur: 1.0, label: 'Halten', kp: [2] }, { a: 1, b: 0, dur: 1.0, label: 'Senken', kp: [3] }],
    keyPoints: [
      { short: 'Auflage', anchor: 'elbow', side: 'l', status: 'single', text: 'Handrücken nach oben, Unterarm aufgelegt, nur das Handgelenk streckt.', src: ['T1'],
        explain: 'Protokoll mit fixiertem Unterarm und pronierter Hand, Strecken gegen die Schwerkraft aus der Waagerechten (Takamori et al. 2026, 13 Gesunde).' },
      { short: 'Strecker', anchor: 'hand', side: 'r', status: 'single', text: 'Schon das Handgewicht reicht, damit die Strecker messbar arbeiten.', src: ['T1'],
        explain: 'Nach 150 Streckungen nur mit dem Handgewicht zeigten die Handgelenk- und Fingerstrecker im MRT bei etwa 40 % der Messungen anaerobe Arbeit (Takamori et al. 2026).' },
      { short: 'Finger', anchor: 'wrist', side: 'r', status: 'single', text: 'Beim Strecken krümmen sich die Finger von selbst etwas mit.', src: ['T1'],
        explain: 'Die Autoren nennen den Tenodese-Effekt: Strecken im Handgelenk beugt die Finger passiv; der Fingerstrecker arbeitet dagegen (Takamori et al. 2026).' }
    ],
    sources: {
      T1: { label: 'Takamori et al. 2026, Prog Rehabil Med', url: 'https://doi.org/10.2490/prm.20260037', read: 'fulltext' },
      R1: { label: 'Ryu et al. 1991, J Hand Surg Am', url: 'https://doi.org/10.1016/0363-5023(91)90006-w', read: 'abstract' }
    }
  },
  {
    ref: 'door-frame-push-up', checkedAt: '2026-10-26', view: 'side', basis: 'transfer',
    basisNote: 'Für den Push-up am Türrahmen fand ich keine Studie mit Ellbogenwinkeln. Die Armbewegung ist vom Liegestütz übertragen (Suprak et al. 2013, Volltext; Bereich 105° → 35°) und um 90° in die Waagerechte gedreht. Beim Wand-Push-up wurde nur die Schulter gemessen (Lunden et al. 2009, 12 Gesunde, Knochenpins, Abstract). Hände auf Brusthöhe (≈ 1,3 m), Körperneigung aus dem Boden-Kontakt der Zehen und die Tiefe (Brust bis auf Höhe der Hände) sind Zeichenkonvention. Der Rahmen steht im Bild als Linie an den Händen; in Wirklichkeit liegt je eine Hand links und rechts davon.',
    tempo: { basis: 'protocol', note: 'Übertragen vom Liegestütz: 2 s ab, 2 s auf (Suprak et al. 2013).' },
    frames: [
      { label: 'Oben', pose: { ...DPU.sp(DPU.top), props: dpuProps }, facts: [C(130, 'Handhöhe ≈ 1,3 m (Konvention)')] },
      { label: 'Unten', pose: { ...DPU.sp(DPU.bottom), props: dpuProps }, facts: [V(105, 'P1', 'fulltext', 'Ellbogen beim Liegestütz im Bereich 105° → 35° (übertragen)')] }
    ],
    phases: [{ a: 0, b: 0, dur: 0.4, label: 'Oben', kp: [0, 1] }, { a: 0, b: 1, dur: 2.0, label: 'Brust nach vorn', kp: [2] }, { a: 1, b: 1, dur: 0.15, label: 'Unten', kp: [2] }, { a: 1, b: 0, dur: 2.0, label: 'Wegdrücken', kp: [3] }],
    keyPoints: [
      { short: 'Hände', anchor: 'wrist', side: 'r', status: 'single', text: 'Hände links und rechts am Rahmen auf Brusthöhe, die Arme sind oben fast gestreckt.', src: ['P1'],
        explain: 'Die Handhöhe ist Zeichenkonvention. Für den Türrahmen gibt es keine gelesene Messung; die Armbewegung ist vom Liegestütz übertragen (Suprak et al. 2013).' },
      { short: 'Linie', anchor: 'hip', side: 'l', status: 'single', text: 'Körper gerade von Kopf bis Ferse nach vorn kippen, Hüfte nicht abknicken.', src: ['P2'],
        explain: 'Anweisung im Liegestütz-Protokoll von San Juan et al. 2015 (Volltext), hier übertragen; für den Türrahmen nicht eigens gemessen.' },
      { short: 'Tiefe', anchor: 'chest', side: 'r', status: 'single', text: 'Brust zwischen die Hände führen, so weit es angenehm ist; Schultern nicht hochziehen.', src: ['L1'],
        explain: 'Die gezeigte Tiefe ist Konvention. Beim Wand-Push-up mit Plus-Phase stand das Schulterblatt in einer Lage, die mit Einklemmen verbunden sein kann (Lunden et al. 2009, 12 Gesunde, Abstract); bei Schulterproblemen vorsichtig anfangen.' },
      { short: 'Zurück', anchor: 'hand', side: 'l', status: 'single', text: 'Gleichmäßig zurückdrücken, ohne den Rücken ins Hohlkreuz zu ziehen.', src: ['P1'],
        explain: 'Takt vom Liegestütz übertragen (Suprak et al. 2013); Hohlkreuz-Hinweis ist Konvention.' }
    ],
    sources: {
      P1: { label: 'Suprak et al. 2013, J Athl Train', url: 'https://doi.org/10.4085/1062-6050-48.5.08', read: 'fulltext', note: 'Liegestütz, übertragen' },
      P2: { label: 'San Juan et al. 2015, BMC Musculoskelet Disord', url: 'https://doi.org/10.1186/s12891-015-0486-5', read: 'fulltext' },
      L1: { label: 'Lunden et al. 2009, J Shoulder Elbow Surg', url: 'https://doi.org/10.1016/j.jse.2009.06.003', read: 'abstract' }
    }
  },
  {
    ref: 'chair-squat', checkedAt: '2026-10-26', view: 'side', basis: 'convention',
    basisNote: 'Keine gelesene Studie nennt Gelenkwinkel für das Hinsetzen und Aufstehen vom Stuhl bei dieser Übung. Gezeichnet: Sitz auf Höhe des Unterschenkels (Anan et al. 2017 stellten den Sitz so ein, Abstract), im Sitz Knie 90°, Oberschenkel fast waagerecht und Rumpf ≈ 20° nach vorn; die Arme zeigen zum Gleichgewicht nach vorn. Alle Winkel sind Zeichenkonvention, die Studien gelten für das Aufstehen aus dem Sitz, nicht für die Übung mit Antippen.',
    tempo: { basis: 'convention', note: 'Je ≈ 2 s ab und auf, im Sitz nur antippen (Konvention).' },
    frames: [
      { label: 'Stand', pose: { ...CHSQ.stand, shoulder: C(80), elbow: C(5), props: chairProps } },
      { label: 'Sitz', pose: { ...CHSQ.seat, shoulder: C(80), elbow: C(5), props: chairProps } }
    ],
    phases: [{ a: 0, b: 0, dur: 0.5, label: 'Stand', kp: [0] }, { a: 0, b: 1, dur: 2.0, label: 'Hinsetzen', kp: [1, 2] }, { a: 1, b: 1, dur: 0.2, label: 'Antippen', kp: [2] }, { a: 1, b: 0, dur: 2.0, label: 'Aufstehen', kp: [3] }],
    keyPoints: [
      { short: 'Stuhl', anchor: 'hip', side: 'l', status: 'single', text: 'Sitzhöhe etwa wie der Unterschenkel; der Stuhl steht fest, eventuell an die Wand.', src: ['A1'],
        explain: 'Anan et al. 2017 (39 Ältere, 21 Jüngere, Abstract): Sitz auf die Länge des Unterschenkels eingestellt. Ein Stuhl an der Wand ist Sicherheitskonvention.' },
      { short: 'Rumpf', anchor: 'chest', side: 'r', status: 'single', text: 'Beim Hinsetzen und Aufstehen den Oberkörper vorneigen, Gesäß nach hinten.', src: ['K1'],
        explain: 'Handläufe veränderten Hüftbeugung und Rumpfneigung beim Abheben vom Sitz (Kinoshita et al. 2015, 16 Junge, 25 Ältere, Abstract); die gezeigte Vorneigung ist Zeichenkonvention.' },
      { short: 'Antippen', anchor: 'thigh', side: 'r', status: 'single', text: 'Nur kurz antippen, nicht fallen lassen oder ganz entspannen.', src: ['I1'],
        explain: 'In einer Computersimulation wuchs die Hüftgelenkkraft ungefähr linear mit der Hüftbeugung beim Abheben (Inai et al. 2018, Abstract). Eine Simulation, keine Messung an der Übung.' },
      { short: 'Aufstehen', anchor: 'knee', side: 'r', status: 'single', text: 'Über die ganzen Füße aufstehen, Knie in Richtung der Zehen.', src: ['S1'],
        explain: 'Ein niedriger Sitz verlangte mehr Beugung von Rumpf, Hüfte und Knie und dauerte länger (dos Santos et al. 2019, Kinder mit und ohne Zerebralparese, Abstract) – Population und Übung unterscheiden sich, daher nur ein Hinweis.' }
    ],
    sources: {
      A1: { label: 'Anan et al. 2017, Phys Ther Res', url: 'https://doi.org/10.1298/ptr.E9923', read: 'abstract' },
      K1: { label: 'Kinoshita et al. 2015, PLoS One', url: 'https://doi.org/10.1371/journal.pone.0133747', read: 'abstract' },
      I1: { label: 'Inai et al. 2018, Biomed Eng Online', url: 'https://doi.org/10.1186/s12938-018-0610-5', read: 'abstract', note: 'Computersimulation' },
      S1: { label: 'dos Santos et al. 2019, Clin Biomech', url: 'https://doi.org/10.1016/j.clinbiomech.2019.11.007', read: 'abstract', note: 'Kinder' }
    }
  },
  {
    ref: 'balance-board-calf-raise', checkedAt: '2026-10-26', view: 'side', basis: 'transfer',
    basisNote: 'Zum Wadenheben auf dem Balanceboard fand ich keine Studie mit Gelenkwinkeln (PubMed-Suche ohne Treffer). Spitzen-Plantarflexion vom stehenden Wadenheben übertragen (Larsen et al. 2025, Volltext: 33,6°; dort mit Goniometer eingestellt, keine Bewegung unter Last). Unten steht der Fuß flach auf dem Board (Konvention; das Board hat keine Stufenkante, deshalb keine Dorsalflexion wie dort). Das Board liegt als flache Platte unter den Füßen, die Hand liegt zur Sicherheit an der Wand. Das Kippen des Boards ist unregelmäßig und wird nicht gezeigt; der Bewegungsumfang auf dem Board kann kleiner sein.',
    tempo: { basis: 'protocol', note: '1 s hoch, 2 s runter, unten kurz halten (Konvention, wie beim stehenden Wadenheben).' },
    frames: [
      { label: 'Unten', pose: { root: 'toe', rootPos: [30, -BAL.h - 2 * BAL.axisR - 2], shank: C(0), knee: C(0), hip: C(0), ankle: C(0, 'Fuß flach auf dem Board'), shoulder: C(25), elbow: C(95), armScale: [1, 0.9], props: balProps } },
      { label: 'Oben', pose: { root: 'toe', rootPos: [30, -BAL.h - 2 * BAL.axisR - 2], shank: C(0), knee: C(0), hip: C(0), ankle: V(-33.6, 'S1', 'fulltext', '+33,6 ± 7,8° Plantarflexion, übertragen'), shoulder: C(25), elbow: C(95), armScale: [1, 0.9], props: balProps } }
    ],
    phases: [{ a: 0, b: 0, dur: 0.5, label: 'Unten', kp: [0, 3] }, { a: 0, b: 1, dur: 1.0, label: 'Hochdrücken', kp: [1] }, { a: 1, b: 1, dur: 0.3, label: 'Oben', kp: [1] }, { a: 1, b: 0, dur: 2.0, label: 'Absenken', kp: [2] }],
    keyPoints: [
      { short: 'Board', anchor: 'foot', side: 'r', status: 'single', text: 'Mit beiden Füßen mittig auf das Board, das Board möglichst ruhig halten.', src: ['S1'],
        explain: 'Die Position auf dem Board ist Konvention. Gemessen wurde nur das Wadenheben auf festem Boden (Larsen et al. 2025).' },
      { short: 'Hoch', anchor: 'toe', side: 'r', status: 'single', text: 'Gleichmäßig auf die Zehenspitzen, ohne dass das Board seitlich ausschlägt.', src: ['S1'],
        explain: 'Spitzen-Plantarflexion 33,6 ± 7,8° (Larsen et al. 2025, festes Wadenheben, übertragen).' },
      { short: 'Ab', anchor: 'heel', side: 'l', status: 'single', text: 'Langsam wieder absenken, nicht fallen lassen.', src: ['S1'],
        explain: 'Das Tempo ist Konvention, angelehnt an das stehende Wadenheben (Larsen et al. 2025); auf dem Board nicht gemessen.' },
      { short: 'Wand', anchor: 'hand', side: 'l', status: 'convention', text: 'Hand an der Wand zur Sicherheit, nicht zum Hochziehen.', src: [],
        explain: 'Die Hand an der Wand ist Sicherheitskonvention; ob sie die Bewegung auf dem Board verändert, ist nicht untersucht.' }
    ],
    sources: {
      S1: { label: 'Larsen et al. 2025, Eur J Sport Sci', url: 'https://doi.org/10.1002/ejsc.70030', read: 'fulltext', note: 'festes Wadenheben, übertragen' }
    }
  },
  {
    ref: 'hip-circles', checkedAt: '2026-10-26', view: 'front', basis: 'convention',
    basisNote: 'Zum Hüftkreisen im Stand fand ich keine Studie mit Bewegungsdaten. Alles ist Zeichenkonvention: Stand hüftbreit, Hände an der Hüfte, das Becken wandert seitlich ≈ 12 cm insgesamt (±6 cm), die Füße bleiben stehen; die Gegenbewegung des Oberkörpers ist klein gezeichnet. In der Frontansicht sieht man nur die seitliche Hälfte des Kreises, die Bewegung nach vorn und hinten ist nicht sichtbar.',
    tempo: { basis: 'convention', note: 'Ein voller Kreis in etwa 3 s, Richtung nach der Hälfte der Zeit wechseln (Konvention).' },
    frames: [
      { label: 'Links', pose: { ...HCIRC.left, props: hcProps } },
      { label: 'Rechts', pose: { ...HCIRC.right, props: hcProps } }
    ],
    phases: [{ a: 0, b: 1, dur: 1.5, label: 'Nach rechts', kp: [0, 1] }, { a: 1, b: 0, dur: 1.5, label: 'Nach links', kp: [2] }],
    keyPoints: [
      { short: 'Stand', anchor: 'footL', side: 'l', status: 'convention', text: 'Hüftbreit stehen, Knie weich, Füße bleiben fest am Boden.', src: [],
        explain: 'Stand, Kniebeugung und Fußstellung sind Zeichenkonvention; ich habe keine Studie mit Bewegungsdaten dazu gelesen.' },
      { short: 'Kreis', anchor: 'pelvis', side: 'r', status: 'convention', text: 'Becken zeichnet einen großen, ruhigen Kreis: seitlich, vor, zur Seite, zurück.', src: [],
        explain: 'In der Frontansicht ist nur die seitliche Verschiebung sichtbar; die Bewegung nach vorn und hinten findet in der Tiefe statt und ist nicht zu sehen.' },
      { short: 'Richtung', anchor: 'chest', side: 'r', status: 'convention', text: 'Nach der Hälfte die Richtung wechseln, Oberkörper möglichst ruhig.', src: [],
        explain: 'Ablauf wie in der Übungsbeschreibung der Routine (Konvention).' }
    ],
    sources: {}
  }
];

// ---------- Szenen (Geräte) ----------
function trunkPoint(P, dx, dy) { // Punkt in Rumpfkoordinaten (dx nach vorn, dy nach oben) ab Schultergelenk
  const t = (P.angles.upper ?? P.angles.trunk) * Math.PI / 180, up = [Math.sin(t), -Math.cos(t)], fw = [Math.cos(t), Math.sin(t)]; // v2.13: oberer Rumpf, wenn gebogen
  const s = P.joints.shoulder;
  return [s[0] + fw[0] * dx + up[0] * dy, s[1] + fw[1] * dx + up[1] * dy];
}
function squatProps(off) {
  return (P) => { const bar = trunkPoint(P, off[0], off[1]); return { anchors: { bar }, scene: [plate(bar)] }; };
}
function handPlate(P) { const bar = P.joints.hand; return { anchors: { bar }, scene: [plate(bar)] }; }
function hipThrustProps(P) {
  const bar = trunkPoint(P, 22, -98);
  return { anchors: { bar }, scene: [{ type: 'rect', x: -320, y: -74, w: 144, h: 74, rx: 6 }, plate(bar)] };
}
function bssProps(P) {
  const hand = P.joints.hand;
  return { anchors: { hand }, scene: [{ type: 'rect', x: -185, y: -82, w: 70, h: 82, rx: 6 }, db(hand)] }; // v2.9: Kurzhantel in echter Größe
}
function lungeProps(P) { const hand = P.joints.hand; return { anchors: { hand }, scene: [db(hand)] }; } // v2.9: Kurzhantel in echter Größe
function calfProps(P) {
  // Schulterpolster-Maschine: Säule vor der Figur, Schlitten mit Polster (folgt den Schultern) und Griffe an der Säule.
  const s = P.joints.shoulder, pad = [s[0] - 6, s[1] - 14], col = 118, top = pad[1] - 64, hand = P.joints.hand;
  return { anchors: {}, scene: [
    { type: 'rect', x: 16, y: -STEP, w: 22, h: STEP, rx: 2, step: true },
    { type: 'line', from: [col, 0], to: [col, -410], w: 7 }, foot(col - 40, col + 40), // Säule, Standfuß
    { type: 'line', from: [col, top], to: [pad[0], top], w: 6 }, { type: 'line', from: [pad[0], top], to: [pad[0], pad[1]], w: 4 }, // Schlitten, Haltearm zum Polster
    { type: 'rect', x: pad[0] - 16, y: pad[1] - 4, w: 32, h: 10, rx: 4 }, // Schulterpolster
    { type: 'line', from: [col, hand[1]], to: [hand[0] + 2, hand[1]], w: 4 }, { type: 'line', from: [hand[0] - 10, hand[1]], to: [hand[0] + 10, hand[1]], w: 3 } // Griffarm, Griff
  ] };
}
function dipProps(P) {
  // Barren laufen von vorn nach hinten, in der Seitenansicht als Stangen mit Stütze vorn und hinten.
  const w = P.joints.wrist, y = w[1] + 2;
  return { anchors: { uarm: midpoint(P.joints.shoulder, P.joints.elbow) }, scene: [
    { type: 'line', from: [w[0] - 62, y], to: [w[0] + 62, y], w: 6 }, // Barren
    { type: 'line', from: [w[0] - 62, y], to: [w[0] - 62, 0], w: 6 }, { type: 'line', from: [w[0] + 62, y], to: [w[0] + 62, 0], w: 6 }, foot(w[0] - 92, w[0] + 92), // Stützen, Standfuß
    { type: 'bar', at: [w[0], y], r: 5 }
  ] };
}
function benchProps(P) {
  const bar = P.joints.hand;
  return { anchors: { bar }, scene: [{ type: 'rect', x: -95, y: -92, w: 225, h: 12, rx: 3 }, { type: 'line', from: [-60, -80], to: [-60, 0], w: 5 }, { type: 'line', from: [100, -80], to: [100, 0], w: 5 }, plate(bar)] };
}
function pushupProps(P) { return { anchors: {}, scene: [] }; }
function rowProps(P) {
  const hand = P.joints.hand, pulley = [240, -70];
  return { anchors: { hand, uarm: midpoint(P.joints.shoulder, P.joints.elbow) }, scene: [
    { type: 'rect', x: -34, y: -90, w: 68, h: 10, rx: 3 }, { type: 'line', from: [0, -80], to: [0, 0], w: 5 }, // Sitz
    { type: 'line', from: [166, -78], to: [190, -8], w: 5 }, // Fußplatte
    { type: 'line', from: [264, 0], to: [264, -100], w: 7 }, { type: 'line', from: [264, -70], to: [pulley[0], -70], w: 5 }, foot(110, 290), // Turm der Kabelrolle, Arm, Standfuß
    { type: 'line', from: hand, to: pulley, w: 1.5, dash: true }, { type: 'bar', at: hand, r: 4 }, { type: 'bar', at: pulley, r: 9 }
  ] };
}
// Frontansicht
function pullupProps(P) {
  return { anchors: { bar: [0, PU.bar] }, scene: behindInBack(P, [{ type: 'line', from: [-130, PU.bar], to: [130, PU.bar], w: 5 }, { type: 'bar', at: [-130, PU.bar], r: 5 }, { type: 'bar', at: [130, PU.bar], r: 5 }]) };
}
// v2.22.0: In der Rückansicht liegt die ganze Szene hinter der Figur (Stange, Kabel und Griffe vor dem Körper verschwinden hinter dem Rücken).
function behindInBack(P, sc) { return P.back ? sc.map((x) => ({ ...x, front: false, back: true })) : sc; }
function pulldownProps(P) {
  const hr = P.joints.handR, hl = P.joints.handL, y = (hr[1] + hl[1]) / 2;
  const sc = pulldownScene(hr, hl, y);
  return { anchors: { bar: [0, y] }, scene: P.back ? sc.map((x) => ({ ...x, front: false, back: true })) : sc }; // v2.20.0: von hinten liegt alles hinter der Figur
}
function pulldownScene(hr, hl, y) {
  return [
    { type: 'rect', x: -36, y: -100, w: 72, h: 10, rx: 3 }, { type: 'line', from: [0, -90], to: [0, 0], w: 5 }, foot(-64, 64), // Sitz, Standfuß
    { type: 'line', from: [-32, -376], to: [32, -376], w: 6 }, { type: 'bar', at: [0, -370], r: 6 }, // Träger und Umlenkrolle oben
    { type: 'line', from: [0, -370], to: [0, y - 4], w: 1.5, dash: true, front: true }, // Seilzug (v2.15.0: vor dem Gesicht, wie die Stange)
    // Oberschenkelpolster: zwei Polster auf den Oberschenkeln, an den Sitzkanten gehalten
    { type: 'rect', x: -34, y: -130, w: 28, h: 10, rx: 4, front: true }, { type: 'rect', x: 6, y: -130, w: 28, h: 10, rx: 4, front: true },
    { type: 'line', from: [-34, -125], to: [-34, -100], w: 4 }, { type: 'line', from: [34, -125], to: [34, -100], w: 4 },
    { type: 'line', from: [hl[0] - 14, y], to: [hr[0] + 14, y], w: 5, front: true }, { type: 'bar', at: [hr[0] + 14, y], r: 4 }, { type: 'bar', at: [hl[0] - 14, y], r: 4 }
  ];
}
function raiseProps(P) {
  return { anchors: {}, scene: [db(P.joints.handR, [1, 0], true), db(P.joints.handL, [1, 0], true)] }; // v2.14.1: echte Kurzhantel, Achse zeigt aus dem Bild (Daumen vorn / Neutralgriff)
}
// Langhantel in der Frontansicht (v2.9): Stange 2,2 m (± 225), Scheiben Ø 45 cm hochkant ab der Hülse (± 134), zwei je Seite.
// noBounds: die Karte richtet sich nach der Figur; Stangenenden und Scheiben dürfen über den Rand ragen.
function frontBarbell(y) {
  const sc = [{ type: 'line', from: [-225, y], to: [225, y], w: 5, front: true, noBounds: true }];
  for (const sg of [1, -1]) {
    sc.push({ type: 'rect', x: sg > 0 ? 134 : -146, y: y - PLATE, w: 12, h: 2 * PLATE, rx: 3, front: true, noBounds: true }, { type: 'rect', x: sg > 0 ? 148 : -158, y: y - PLATE, w: 10, h: 2 * PLATE, rx: 3, front: true, noBounds: true });
    sc.push({ type: 'rect', x: sg > 0 ? 128 : -132, y: y - 9, w: 4, h: 18, rx: 1, front: true, noBounds: true }); // Hülsenbund
  }
  return sc;
}
function sumoProps(P) {
  const y = (P.joints.shoulderR[1] + P.joints.shoulderL[1]) / 2 - 10; // Stange auf dem oberen Trapez, knapp über den Schultergelenken
  return { anchors: { bar: [0, y] }, scene: frontBarbell(y) };
}
// ---------- Szenen Runde 3.1 (v2.9) ----------
function slRdlProps(P) { const hand = P.joints.hand; return { anchors: { hand }, scene: [db(hand, [1, 0])] }; } // Kurzhantel in der Hand gegenüber dem Standbein
function bridgeProps(P) {
  const b = trunkPoint(P, 22, -98), bar = [b[0], Math.min(b[1], -PLATE)]; // Stange über dem Becken; unten stehen die Scheiben auf dem Boden
  return { anchors: { bar }, scene: [plate(bar)] };
}
function backExtProps(P) {
  const an = P.joints.ankle, sd = segDir(P, 'shank'), sn = segNrm(P, 'shank'), td = segDir(P, 'thigh'), tn = segNrm(P, 'thigh');
  const h = P.joints.hip, fd = segDir(P, 'foot');
  const sole = along(an, segNrm(P, 'foot'), -15); // Sohle unter dem Fuß
  const roller = along(along(an, sd, -14), sn, -12); // Fersenrolle hinten am unteren Schienbein (sd zeigt Knie → Knöchel)
  const padTop = along(along(h, td, 10), tn, -22), padLow = along(along(h, td, 70), tn, -22); // Polster vor dem Oberschenkel, Kante an der Hüfte
  const base = [padLow[0] + 10, 0];
  return { anchors: { pad: padTop }, scene: [
    { type: 'line', from: along(sole, fd, -10), to: along(sole, fd, 36), w: 6 }, // Fußplatte
    { type: 'bar', at: roller, r: 9 }, // Fersenrolle
    { type: 'line', from: padTop, to: padLow, w: 14 }, // Oberschenkelpolster
    { type: 'line', from: along(padLow, tn, -8), to: base, w: 6 }, { type: 'line', from: along(sole, fd, 10), to: [along(sole, fd, 10)[0], 0], w: 5 }, foot(along(sole, fd, 10)[0] - 30, base[0] + 30)
  ] };
}
function kickbackProps(P) {
  const t = KICK.tower, cuff = P.joints.ankle; // Manschette am arbeitenden (nahen) Bein
  return { anchors: { cuff }, scene: [
    { type: 'line', from: [t, 0], to: [t, -420], w: 8 }, foot(t - 40, t + 50), // Turm mit Standfuß
    { type: 'bar', at: [t - 8, KICK.pulley], r: 7 }, // untere Rolle
    { type: 'line', from: [t - 8, KICK.pulley], to: cuff, w: 1.5, dash: true, front: true }, // Seil zur Manschette
    { type: 'rect', x: cuff[0] - 7, y: cuff[1] - 6, w: 14, h: 12, rx: 4, front: true }, // Manschette
    { type: 'line', from: [t, P.joints.hand[1]], to: [P.joints.hand[0] - 4, P.joints.hand[1]], w: 4 } // Haltegriff
  ] };
}
function benchDbProps(P) {
  const hand = P.joints.hand;
  return { anchors: { hand }, scene: [{ type: 'rect', x: -95, y: -92, w: 225, h: 12, rx: 3 }, { type: 'line', from: [-60, -80], to: [-60, 0], w: 5 }, { type: 'line', from: [100, -80], to: [100, 0], w: 5 }, db(hand, [1, 0], true)] };
}
function inclineBarProps(P) {
  const h = P.joints.hip, top = along(along(h, segNrm(P, 'trunk'), -24), segDir(P, 'trunk'), -165), bar = P.joints.hand;
  return { anchors: { bar }, scene: [
    benchLine(P, 24, 170, -6), { type: 'line', from: [h[0] - 20, h[1] + 24], to: [h[0] + 50, h[1] + 24], w: 14 },
    { type: 'line', from: [h[0] + 10, h[1] + 30], to: [h[0] + 10, 0], w: 6 }, { type: 'line', from: top, to: [top[0], 0], w: 6 }, foot(h[0] - 20, h[0] + 40), foot(top[0] - 30, top[0] + 30), plate(bar)
  ] };
}
function declineProps(P) {
  const bar = P.joints.hand, h = P.joints.hip, kn = P.joints.knee, an = P.joints.ankle;
  const lo = along(along(h, segNrm(P, 'trunk'), -22), segDir(P, 'trunk'), -150); // Kopfende der Bank (unten)
  const hi = along(along(h, segNrm(P, 'trunk'), -22), segDir(P, 'trunk'), 14); // Hüftende
  const roller = along(along(an, segDir(P, 'shank'), -12), segNrm(P, 'shank'), 12); // Rolle vor dem Schienbein über dem Knöchel
  const kneePad = along(kn, segNrm(P, 'thigh'), -14);
  return { anchors: { bar }, scene: [
    { type: 'line', from: lo, to: hi, w: 14 }, { type: 'line', from: hi, to: kneePad, w: 10 }, // Bank und Beinteil
    { type: 'line', from: lo, to: [lo[0], 0], w: 6 }, { type: 'line', from: kneePad, to: [kneePad[0], 0], w: 6 }, foot(lo[0] - 30, kneePad[0] + 30),
    { type: 'line', from: kneePad, to: roller, w: 4 }, { type: 'bar', at: roller, r: 10 }, // Halter und Fußrolle
    plate(bar)
  ] };
}
function chestPressProps(P) {
  const h = P.joints.hip, hand = P.joints.hand, sh = P.joints.shoulder;
  const pivot = [sh[0] - 46, sh[1] - 60]; // Drehpunkt der Hebelarme hinter und über der Schulter (Konvention); Hebel läuft seitlich am Körper vorbei
  return { anchors: { hand }, scene: [
    { type: 'rect', x: h[0] - 30, y: h[1] + 2, w: 70, h: 12, rx: 4 }, benchLine(P, 26, 140, -8), // Sitz, Lehne
    { type: 'line', from: [h[0] - 10, h[1] + 14], to: [h[0] - 10, 0], w: 6 }, { type: 'line', from: [pivot[0], 0], to: pivot, w: 7 }, foot(h[0] - 70, h[0] + 30), // Sitzstütze (v2.15.0: unter dem Sitz statt daneben), Säule
    { type: 'line', from: pivot, to: [pivot[0] + 30, hand[1] - 2], w: 5 }, { type: 'line', from: [pivot[0] + 30, hand[1] - 2], to: [hand[0], hand[1] - 2], w: 5 }, // Hebelarm hinter dem Körper
    { type: 'line', from: [hand[0], hand[1] - 14], to: [hand[0], hand[1] + 10], w: 5, front: true } // Griff
  ] };
}
function smithProps(P) {
  const bar = trunkPoint(P, SMITH_BAR[0], SMITH_BAR[1]), x = SMITH.x;
  return { anchors: { bar }, scene: [
    { type: 'line', from: [x, 0], to: [x, -440], w: 6 }, foot(x - 70, x + 70), // Führungsschiene (beide Schienen decken sich von der Seite), Standfuß
    { type: 'line', from: [x - 70, -440], to: [x + 70, -440], w: 6 }, // Querträger oben
    { type: 'rect', x: x - 9, y: bar[1] - 14, w: 18, h: 28, rx: 3 }, // Schlitten an der Schiene
    { type: 'line', from: [x + 9, -250], to: [x + 22, -250], w: 4 }, // Sicherheitshaken (Konvention)
    plate([x, bar[1]])
  ] };
}
function hackProps(P) {
  const d = HACK_LINE.d, n = [-d[1], d[0]]; // d: Bahn nach oben-hinten, n: nach hinten-unten (hinter dem Rücken)
  const an = [0, -15 - HACK.plat], base = (k, b) => [an[0] + HACK_LINE.p[0] + d[0] * k + n[0] * b, an[1] + HACK_LINE.p[1] + d[1] * k + n[1] * b];
  const r0 = base(-60, -34), r1 = base(230, -34); // Schiene hinter der Rückenlehne (fest in der Welt)
  const sh = trunkPoint(P, 2, 12); // Schulterpolster auf der Schulter
  const pd = dir2(70), sole = [an[0] - pd[1] * 15, an[1] + pd[0] * 15]; // Sohle 15 unter dem Knöchel (senkrecht zum Fuß), Plattform in Fußrichtung
  return { anchors: { pad: sh }, scene: [
    { type: 'line', from: r0, to: r1, w: 8 }, { type: 'line', from: r0, to: [r0[0], 0], w: 6 }, { type: 'line', from: r1, to: [r1[0], 0], w: 6 }, foot(r1[0] - 30, 70), // Schiene, Stützen, Standfuß
    benchLine(P, 20, 128, 34), // Rückenpolster auf dem Schlitten
    { type: 'line', from: along(sh, n, 10), to: along(sh, n, 22), w: 5 }, { type: 'bar', at: sh, r: 9 }, // Halter und Schulterpolster
    { type: 'line', from: along(sole, pd, -70), to: along(sole, pd, 22), w: 8, front: true }, // Plattform (vorn 20° angehoben); Fuß im vorderen Teil (Clark et al. 2019)
    { type: 'line', from: along(sole, pd, 5), to: [along(sole, pd, 5)[0], 0], w: 6 }, { type: 'line', from: along(sole, pd, -70), to: r0, w: 5 } // Stütze, Verbindung zur Schiene
  ] };
}
function stepUpProps(P) {
  const L = P.joints.hand;
  return { anchors: { box: [42, -STEPUP.box / 2], dumbbell: L }, scene: [{ type: 'rect', x: -44, y: -STEPUP.box, w: 88, h: STEPUP.box, rx: 4 }, db(L)] };
}
function revLungeProps(P) { const hand = P.joints.hand; return { anchors: { hand }, scene: [db(hand)] }; }
function gobletProps(P) {
  const at = trunkPoint(P, GOBLET.at[0], GOBLET.at[1]), t = P.angles.trunk * Math.PI / 180;
  return { anchors: { dumbbell: at }, scene: [db(at, [Math.sin(t), -Math.cos(t)])] };
}
// ---------- Szenen der zweiten Runde (v2.1) ----------
const segDir = (P, seg) => P.F[seg].d; // Richtung eines Segments (Einheitsvektor)
const segNrm = (P, seg) => P.F[seg].n; // Normale (zeigt im Stand nach vorn)
const along = (p, d, k) => [p[0] + d[0] * k, p[1] + d[1] * k];
function benchLine(P, back, up, down) { // Lehne hinter dem Rumpf (back: Abstand hinter der Rumpfachse), von „down“ unter der Hüfte bis „up“ über ihr
  const d = segDir(P, 'trunk'), n = segNrm(P, 'trunk'), h = P.joints.hip; // d: Schulter → Hüfte
  const base = along(h, n, -back);
  return { type: 'line', from: along(base, d, -up), to: along(base, d, down), w: 14 };
}
function frontSquatProps(P) { const bar = trunkPoint(P, 12, -2); return { anchors: { bar }, scene: [plate(bar)] }; }
function legPressProps(P) {
  const an = P.joints.ankle, fd = segDir(P, 'foot'), fn = segNrm(P, 'foot');
  const sole = along(an, fn, -15), rail = [Math.SQRT1_2, -Math.SQRT1_2]; // Schienen 45° nach vorn-oben
  const pc = along(sole, fd, 12); // Plattenmitte
  return { anchors: { plate: along(pc, rail, 10) }, scene: [
    { type: 'line', from: along(pc, rail, -150), to: along(pc, rail, 90), w: 5 }, // Schiene
    { type: 'line', from: [pc[0] + 60, 0], to: along(pc, rail, 60), w: 5 }, // Stütze
    benchLine(P, 30, 150, 4), { type: 'line', from: along(along(P.joints.hip, segDir(P, 'trunk'), 16), segNrm(P, 'trunk'), -30), to: along(along(P.joints.hip, segDir(P, 'trunk'), 16), segNrm(P, 'trunk'), 44), w: 14 }, // Lehne, Sitz
    { type: 'line', from: [P.joints.hip[0] + 20, P.joints.hip[1] + 20], to: [P.joints.hip[0] + 20, 0], w: 5 }, foot(P.joints.hip[0] - 30, pc[0] + 80), // Standfuß
    { type: 'line', from: along(pc, fd, -34), to: along(pc, fd, 46), w: 8, front: true } // Fußplatte
  ] };
}
function legExtensionProps(P) {
  const an = P.joints.ankle, kn = P.joints.knee, sd = segDir(P, 'shank'), sn = segNrm(P, 'shank');
  const pad = along(along(an, sd, -8), sn, 19); // Mitte der Rolle: Schienbeinrand (≈ 8) + Rollenradius 11, knapp über dem Knöchel
  const h = P.joints.hip;
  return { anchors: { pad }, scene: [
    { type: 'rect', x: h[0] - 40, y: h[1] + 2, w: 90, h: 12, rx: 4 }, benchLine(P, 26, 120, -8), // Sitz, Lehne
    { type: 'line', from: [h[0] - 10, h[1] + 14], to: [h[0] - 10, 0], w: 6 }, { type: 'line', from: [h[0] - 50, 0], to: [h[0] + 40, 0], w: 4 },
    { type: 'line', from: kn, to: pad, w: 7, back: true }, { type: 'bar', at: pad, r: 11 } // gepolsterter Hebel ab Knieachse (seitlich, v2.15.0: hinter dem Bein), Rolle
  ] };
}
function legCurlProps(P) {
  const an = P.joints.ankle, kn = P.joints.knee, sd = segDir(P, 'shank'), sn = segNrm(P, 'shank');
  const pad = along(along(an, sd, -8), sn, -19); // Mitte der Rolle: Wadenrand (≈ 8) + Rollenradius 11, hinten an der Wade knapp über der Ferse
  const h = P.joints.hip, s = P.joints.shoulder;
  const seat = along(h, segDir(P, 'thigh'), 40);
  return { anchors: { pad }, scene: [
    { type: 'line', from: [s[0] + 40, h[1] + 20], to: [h[0] - 4, h[1] + 20], w: 14 }, // Polster Rumpf
    { type: 'line', from: along(h, segNrm(P, 'thigh'), 20), to: along(seat, segNrm(P, 'thigh'), 20), w: 14 }, // schräges Polster Oberschenkel
    { type: 'line', from: [h[0] + 20, h[1] + 27], to: [h[0] + 20, 0], w: 6 }, { type: 'line', from: [s[0] + 30, h[1] + 27], to: [s[0] + 30, 0], w: 6 },
    foot(Math.min(h[0] + 20, s[0] + 30) - 30, Math.max(h[0] + 20, s[0] + 30) + 30), // Standfuß
    { type: 'line', from: kn, to: pad, w: 7, back: true }, { type: 'bar', at: pad, r: 11 } // v2.15.0: Hebel seitlich, hinter dem Bein
  ] };
}
function ohpProps(P) { const bar = P.joints.hand; return { anchors: { bar }, scene: [plate(bar)] }; }
function shoulderPressProps(P) {
  const hand = P.joints.hand, h = P.joints.hip;
  return { anchors: { hand }, scene: [
    { type: 'rect', x: h[0] - 30, y: h[1] + 2, w: 64, h: 12, rx: 4 }, benchLine(P, 26, 130, -8),
    { type: 'line', from: [h[0], h[1] + 14], to: [h[0], 0], w: 6 }, foot(h[0] - 40, h[0] + 40), db(hand, [1, 0], true)
  ] };
}
function rowBarProps(P) { const bar = P.joints.hand; return { anchors: { bar, uarm: midpoint(P.joints.shoulder, P.joints.elbow) }, scene: [plate(bar)] }; }
function curlProps(P) { const hand = P.joints.hand; return { anchors: { hand, uarm: midpoint(P.joints.shoulder, P.joints.elbow) }, scene: [db(hand, [1, 0], true)] }; } // v2.14.1: echte Kurzhantel (Achse zeigt aus dem Bild)
function pushdownProps(P) {
  const hand = P.joints.hand, top = [100, -410];
  return { anchors: { hand, uarm: midpoint(P.joints.shoulder, P.joints.elbow) }, scene: [
    { type: 'line', from: [top[0] + 40, 0], to: [top[0] + 40, -420], w: 6 }, { type: 'line', from: [top[0] - 12, -420], to: [top[0] + 40, -420], w: 6 }, // Säule, Ausleger
    { type: 'line', from: top, to: hand, w: 1.5, dash: true }, { type: 'bar', at: top, r: 7 }, // Seil, Umlenkrolle
    { type: 'line', from: [hand[0] - 12, hand[1]], to: [hand[0] + 12, hand[1]], w: 5, front: true } // Griffstange
  ] };
}
function inclineProps(P) {
  const hand = P.joints.hand, h = P.joints.hip;
  const top = along(along(h, segNrm(P, 'trunk'), -24), segDir(P, 'trunk'), -165); // oberes Ende der Lehne
  return { anchors: { hand }, scene: [
    benchLine(P, 24, 170, -6), { type: 'line', from: [h[0] - 20, h[1] + 24], to: [h[0] + 50, h[1] + 24], w: 14 }, // Lehne, Sitz
    { type: 'line', from: [h[0] + 10, h[1] + 30], to: [h[0] + 10, 0], w: 6 }, { type: 'line', from: top, to: [top[0], 0], w: 6 }, foot(h[0] - 20, h[0] + 40), foot(top[0] - 30, top[0] + 30), db(hand, [1, 0], true)
  ] };
}
const foot = (x0, x1) => ({ type: 'line', from: [x0, 0], to: [x1, 0], w: 5 }); // Standfuß einer Maschine auf dem Boden
function midpoint(a, b) { return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; }

// ---------- Szenen Runde 4 (v2.10) ----------
function oneRowProps(P) {
  const hand = P.joints.hand, [x0, x1] = ONE_ROW.bench;
  return { anchors: { hand, uarm: midpoint(P.joints.shoulder, P.joints.elbow) }, scene: [
    { type: 'rect', x: x0, y: -92, w: x1 - x0, h: 12, rx: 3 }, { type: 'line', from: [x0 + 30, -80], to: [x0 + 30, 0], w: 5 }, { type: 'line', from: [x1 - 30, -80], to: [x1 - 30, 0], w: 5 }, // Flachbank
    db(hand, [1, 0]) // Neutralgriff: Griff läuft von vorn nach hinten
  ] };
}
// v2.15.0: kleinere Scheiben weiter vorn an der Stange – die 45-cm-Scheibe ragte oben in Brust und Oberschenkel. Werte so gewählt, dass der Rand
// über den ganzen Zyklus ≥ 2 Einheiten vor der Körperkontur bleibt (Test); Ø ≈ 30 cm entspricht kleinen Scheiben (Konvention).
const TBAR_PLATE = { r: 30, off: 40 };
function tbarProps(P) {
  const g = P.joints.hand, p = TBAR.pivot, u = unit2([g[0] - p[0], g[1] - p[1]]), L = Math.hypot(g[0] - p[0], g[1] - p[1]);
  const pl = along(p, u, L + TBAR_PLATE.off), end = along(p, u, L + TBAR_PLATE.off + 22);
  return { anchors: { hand: g, uarm: midpoint(P.joints.shoulder, P.joints.elbow) }, scene: [
    { type: 'rect', x: p[0] - 16, y: -12, w: 32, h: 12, rx: 3 }, { type: 'bar', at: p, r: 6 }, // Bodenplatte mit Drehpunkt (Landmine)
    { type: 'line', from: p, to: end, w: 5 }, // Stange
    { type: 'line', from: along(g, [u[1], -u[0]], -4), to: along(g, [u[1], -u[0]], 8), w: 4, front: true }, // Griff unter der Stange
    { ...plate(pl, TBAR_PLATE.r), back: true } // Scheiben in der Körpermitte: hinter dem nahen Arm
  ] };
}
function csrProps(P) {
  const g = P.joints.hand, p = CSR.pivot, h = P.joints.hip, d = segDir(P, 'trunk'), n = segNrm(P, 'trunk');
  const padTop = along(along(h, n, 36), d, -92), padLow = along(along(h, n, 36), d, -4); // Polster vor Brust und Bauch, oben frei für die Arme
  const sole = along(P.joints.ankle, segNrm(P, 'foot'), -15), fd = segDir(P, 'foot');
  const u = unit2([g[0] - p[0], g[1] - p[1]]), peg = along(p, u, 70);
  return { anchors: { hand: g, uarm: midpoint(P.joints.shoulder, P.joints.elbow) }, scene: [
    { type: 'line', from: along(sole, fd, -14), to: along(sole, fd, 40), w: 7 }, { type: 'line', from: along(sole, fd, 12), to: [along(sole, fd, 12)[0], 0], w: 5 }, // Fußplatte
    { type: 'line', from: padTop, to: padLow, w: 14 }, { type: 'line', from: along(padLow, n, 8), to: [along(padLow, n, 8)[0], 0], w: 6 }, // Brustpolster mit Stütze
    { type: 'line', from: [p[0], 0], to: p, w: 7 }, foot(Math.min(along(sole, fd, 12)[0], along(padLow, n, 8)[0]) - 30, p[0] + 40), // Säule mit Drehpunkt, Standfuß
    { type: 'line', from: p, to: g, w: 5 }, { type: 'bar', at: p, r: 7 }, plate(peg), // Hebel, Scheibe auf dem Hebel
    { type: 'line', from: [g[0] - 10, g[1]], to: [g[0] + 10, g[1]], w: 4, front: true } // Griff
  ] };
}
function mrowProps(P) {
  const g = P.joints.hand, p = MROW.pivot, h = P.joints.hip, s = P.joints.shoulder;
  const col = p[0] + 60, pad = [s[0] + 34, s[1] + 18];
  return { anchors: { hand: g, uarm: midpoint(P.joints.shoulder, P.joints.elbow) }, scene: [
    { type: 'rect', x: h[0] - 34, y: h[1] + 5, w: 70, h: 10, rx: 3 }, { type: 'line', from: [h[0], h[1] + 15], to: [h[0], 0], w: 5 }, // Sitz
    { type: 'rect', x: pad[0], y: pad[1] - 30, w: 12, h: 66, rx: 4 }, { type: 'line', from: [pad[0] + 12, pad[1] + 4], to: [col, pad[1] + 4], w: 5 }, // Brustpolster mit Halter
    { type: 'line', from: [col, 0], to: [col, p[1]], w: 8 }, { type: 'line', from: [col, p[1]], to: p, w: 6 }, foot(h[0] - 40, col + 40), // Säule, Ausleger
    { type: 'line', from: p, to: g, w: 5 }, { type: 'bar', at: p, r: 7 }, // Hebel ab Drehpunkt
    { type: 'line', from: [g[0], g[1] - 10], to: [g[0], g[1] + 10], w: 4, front: true } // senkrechter Griff (Neutralgriff)
  ] };
}
function invProps(P) {
  const b = INV.bar, post = b[0] - 46;
  return { anchors: { bar: b, hand: P.joints.hand }, scene: [
    { type: 'line', from: [post, 0], to: [post, -340], w: 7 }, foot(post - 40, post + 40), { type: 'line', from: [post, b[1] + 6], to: [b[0], b[1] + 6], w: 4 }, // Rackpfosten mit Ablage
    { type: 'bar', at: b, r: 5 }
  ] };
}

// ---------- Szenen Runde 5 (v2.11) ----------
function chinProps(P) {
  const b = [0, PU.bar];
  return { anchors: { bar: b, uarm: midpoint(P.joints.shoulder, P.joints.elbow) }, scene: [
    { type: 'line', from: [b[0], b[1]], to: [b[0] + 110, b[1]], w: 5 }, { type: 'line', from: [b[0] + 110, b[1] - 40], to: [b[0] + 110, b[1] + 40], w: 7 }, // Ausleger zur Wand
    { type: 'bar', at: b, r: 5 }
  ] };
}
function cgpProps(P) {
  const h = P.joints.hip, k = P.joints.knee, hand = P.joints.hand, s = P.joints.shoulder;
  const pulley = [CGP_PULLEY_X, -410], col = pulley[0] + 80; // v2.15.0: Rolle fest in der Welt (vorher an der Schulter – wanderte bei Rücklage mit)
  return { anchors: { hand, uarm: midpoint(P.joints.shoulder, P.joints.elbow) }, scene: [
    { type: 'rect', x: h[0] - 34, y: h[1] + 6, w: 72, h: 10, rx: 3 }, { type: 'line', from: [h[0], h[1] + 16], to: [h[0], 0], w: 5 }, foot(h[0] - 40, col + 40), // Sitz
    { type: 'bar', at: [k[0] - 18, k[1] - 24], r: 9 }, { type: 'line', from: [k[0] - 18, k[1] - 24], to: [col, k[1] - 24], w: 4 }, // Oberschenkelpolster mit Halter
    { type: 'line', from: [col, 0], to: [col, pulley[1] - 10], w: 8 }, { type: 'line', from: [col, pulley[1] - 10], to: [pulley[0], pulley[1] - 10], w: 6 }, { type: 'bar', at: pulley, r: 8 }, // Turm, Ausleger, Rolle
    { type: 'line', from: pulley, to: hand, w: 1.5, dash: true }, // Seil
    { type: 'line', from: [hand[0] - 4, hand[1] - 12], to: [hand[0] + 4, hand[1] + 8], w: 4, front: true } // Neutralgriff
  ] };
}
function sapProps(P) {
  const hand = P.joints.hand, t = SAP.tower, p = SAP.pulley;
  return { anchors: { hand, uarm: midpoint(P.joints.shoulder, P.joints.elbow) }, scene: [
    { type: 'line', from: [t, 0], to: [t, p[1] - 14], w: 8 }, foot(t - 40, t + 40), { type: 'bar', at: p, r: 8 }, // Turm mit oberer Rolle
    { type: 'line', from: p, to: hand, w: 1.5, dash: true }, // Seil
    { type: 'line', from: [hand[0] - 3, hand[1] - 9], to: [hand[0] + 3, hand[1] + 9], w: 5, front: true } // kurze Stange (Ende)
  ] };
}
function rpdProps(P) {
  const hr = P.joints.handR, hl = P.joints.handL, top = RPD.seat - 250, pel = P.joints.pelvis;
  return { anchors: {}, scene: [
    { type: 'rect', x: -38, y: pel[1] + 6, w: 76, h: 10, rx: 3 }, { type: 'line', from: [0, pel[1] + 16], to: [0, 0], w: 6 }, foot(-70, 70), // Sitz, Stütze
    { type: 'line', from: [-52, top], to: [52, top], w: 6 }, // Querträger über dem Kopf mit den Drehachsen
    { type: 'line', from: [10, top], to: [hr[0], top], w: 4 }, { type: 'line', from: [hr[0], top], to: [hr[0], hr[1] - 10], w: 4 }, // Hebel rechts (waagerecht, dann senkrecht zum Griff)
    { type: 'line', from: [-10, top], to: [hl[0], top], w: 4 }, { type: 'line', from: [hl[0], top], to: [hl[0], hl[1] - 10], w: 4 },
    { type: 'line', from: [hr[0], hr[1] - 12], to: [hr[0], hr[1] + 10], w: 5, front: true }, { type: 'line', from: [hl[0], hl[1] - 12], to: [hl[0], hl[1] + 10], w: 5, front: true } // senkrechte Griffe (Neutralgriff)
  ] };
}

// ---------- Szenen Runde 6 (v2.11) ----------
const uarmMid = (P) => midpoint(P.joints.shoulder, P.joints.elbow);
function ezCurlProps(P) { const g = gripOf(P); return { anchors: { bar: g, uarm: uarmMid(P) }, scene: [plate(g, CURL_PLATE)] }; }
function hammerProps(P) { const g = gripOf(P); return { anchors: { hand: g, uarm: uarmMid(P) }, scene: [db(g, segNrm(P, 'farm'))] }; } // Neutralgriff: Hantelachse quer zum Unterarm in der Bildebene
function inclineCurlProps(P) {
  const g = gripOf(P), h = P.joints.hip;
  const top = along(along(h, segNrm(P, 'trunk'), -24), segDir(P, 'trunk'), -165);
  return { anchors: { hand: g, uarm: uarmMid(P) }, scene: [
    benchLine(P, 24, 170, -6), { type: 'line', from: [h[0] - 20, h[1] + 24], to: [h[0] + 50, h[1] + 24], w: 14 }, // Lehne 45°, Sitz
    { type: 'line', from: [h[0] + 10, h[1] + 30], to: [h[0] + 10, 0], w: 6 }, { type: 'line', from: top, to: [top[0], 0], w: 6, back: true }, foot(h[0] - 20, h[0] + 40), foot(top[0] - 30, top[0] + 30),
    db(g, [1, 0], true)
  ] };
}
function preacherProps(P) {
  const g = gripOf(P), s = P.joints.shoulder, e = P.joints.elbow, h = P.joints.hip, u = segDir(P, 'uarm');
  let n = segNrm(P, 'uarm'); if (n[1] < 0) n = [-n[0], -n[1]]; // Unterseite des Oberarms
  const a = along(along(s, u, 18), n, 20), b = along(along(e, u, 12), n, 20), m = midpoint(a, b);
  return { anchors: { pad: m, hand: g, uarm: uarmMid(P) }, scene: [
    { type: 'line', from: a, to: b, w: 12, front: true }, // Pult direkt unter dem Oberarm
    { type: 'line', from: [m[0], m[1] + 6], to: [m[0], 0], w: 6, back: true }, foot(m[0] - 45, m[0] + 45), // Stütze (hinter den Beinen)
    { type: 'line', from: [h[0] - 26, h[1] + 22], to: [h[0] + 28, h[1] + 22], w: 12 }, { type: 'line', from: [h[0], h[1] + 28], to: [h[0], 0], w: 6, back: true }, // Sitz
    db(g, [1, 0], true)
  ] };
}
function bayesianProps(P) {
  const g = gripOf(P), t = BAY.tower, p = BAY.pulley, d = segNrm(P, 'farm');
  return { anchors: { hand: g, uarm: uarmMid(P) }, scene: [
    { type: 'line', from: [t, 0], to: [t, -300], w: 8 }, foot(t - 40, t + 40), { type: 'bar', at: p, r: 7 }, // Turm mit verstellbarer Rolle auf Hüfthöhe
    { type: 'line', from: p, to: g, w: 1.5, dash: true }, // Seil
    { type: 'line', from: along(g, d, -8), to: along(g, d, 8), w: 5, front: true } // Einhandgriff
  ] };
}
function concentrationProps(P) {
  const g = gripOf(P), h = P.joints.hip;
  return { anchors: { hand: g, uarm: uarmMid(P) }, scene: [
    { type: 'rect', x: h[0] - 70, y: h[1] + 14, w: 110, h: 10, rx: 3 }, { type: 'line', from: [h[0] - 50, h[1] + 24], to: [h[0] - 50, 0], w: 5 }, { type: 'line', from: [h[0] + 22, h[1] + 24], to: [h[0] + 22, 0], w: 5, back: true }, // Flachbank
    db(g, [1, 0], true)
  ] };
}

// ---------- Szenen Runde 7 (v2.11) ----------
function frontRaiseProps(P) {
  const g = gripOf(P), h = P.joints.hip;
  return { anchors: { hand: g, uarm: uarmMid(P) }, scene: [
    { type: 'rect', x: h[0] - 55, y: h[1] + 14, w: 95, h: 10, rx: 3 }, { type: 'line', from: [h[0] - 40, h[1] + 24], to: [h[0] - 40, 0], w: 5 }, { type: 'line', from: [h[0] + 26, h[1] + 24], to: [h[0] + 26, 0], w: 5, back: true }, // Flachbank
    db(g, [1, 0], true)
  ] };
}
function cableLateralProps(P) {
  const hr = P.joints.handR, w = P.joints.wristR, g = [(hr[0] + w[0]) / 2, (hr[1] + w[1]) / 2], t = CLR.tower, p = [t + 8, CLR.pulleyY];
  return { anchors: {}, scene: [
    { type: 'line', from: [t, 0], to: [t, -300], w: 8 }, foot(t - 40, t + 40), { type: 'bar', at: p, r: 7 }, // Turm, Rolle auf Handhöhe
    { type: 'line', from: p, to: g, w: 1.5, dash: true, front: true }, // Seil vor dem Körper zur Gegenseite
    { type: 'rect', x: g[0] - 5, y: g[1] - 8, w: 10, h: 16, rx: 3, front: true } // Einhandgriff
  ] };
}
function uprightRowProps(P) {
  const w = P.joints.wristR, hr = P.joints.handR, y = (w[1] + hr[1]) / 2;
  return { anchors: { bar: [0, y] }, scene: frontBarbell(y) };
}
function machinePressProps(P) {
  const hand = P.joints.hand, h = P.joints.hip, pv = MSP.pivot;
  return { anchors: { hand }, scene: [
    { type: 'rect', x: h[0] - 30, y: h[1] + 2, w: 64, h: 12, rx: 4 }, benchLine(P, 26, 140, -8), // Sitz, Lehne 75°
    { type: 'line', from: [h[0], h[1] + 14], to: [h[0], 0], w: 6 }, foot(h[0] - 50, h[0] + 60),
    { type: 'line', from: [pv[0], pv[1]], to: [pv[0], 0], w: 8, back: true }, foot(pv[0] - 40, pv[0] + 40), { type: 'bar', at: pv, r: 7 }, // Säule mit Drehachse
    { type: 'line', from: pv, to: hand, w: 5, back: true }, // Hebelarm (seitlich neben dem Kopf, daher hinter der Figur)
    { type: 'line', from: [hand[0] - 3, hand[1] - 9], to: [hand[0] + 3, hand[1] + 9], w: 6, front: true } // Griff
  ] };
}

// ---------- Szenen Runde 8 (v2.12) ----------
function overheadCableProps(P) {
  const g = gripOf(P), t = OHX.tower, p = OHX.pulley, d = segNrm(P, 'farm');
  return { anchors: { hand: g, uarm: uarmMid(P) }, scene: [
    { type: 'line', from: [t, 0], to: [t, -330], w: 8 }, foot(t - 40, t + 40), { type: 'bar', at: p, r: 7 }, // Turm hinter der Figur, Rolle auf Hüfthöhe
    { type: 'line', from: p, to: g, w: 1.5, dash: true }, // Seil
    { type: 'line', from: along(g, d, -8), to: along(g, d, 8), w: 5, front: true } // Einhandgriff
  ] };
}
function overheadDbProps(P) {
  const g = gripOf(P), h = P.joints.hip;
  return { anchors: { hand: g, uarm: uarmMid(P) }, scene: [
    { type: 'rect', x: h[0] - 30, y: h[1] + 14, w: 64, h: 10, rx: 3 }, benchLine(P, 24, 105, -14), // Sitz, Lehne
    { type: 'line', from: [h[0], h[1] + 24], to: [h[0], 0], w: 6 }, foot(h[0] - 45, h[0] + 45),
    db([g[0], g[1] + DB.len / 2 - DB.hw / 2 - 23], [0, 1]) // eine Hantel, beidhändig unter dem oberen Kopf gehalten: hängt senkrecht; v2.15.0: der obere Kopf sitzt in den Handflächen und verdeckt die Fingerspitzen (vorher ragte die Hand über den Kopf)
  ] };
}
// ---------- Szenen Runde 10 (v2.13) ----------
// Matte fest unter dem liegenden Körper (Hüfte bei x = 0 bzw. Schulter bei FLOOR.sh); Sit-up zusätzlich ein Fußhalter (Rolle über dem Rist).
function matProps(P) { return { anchors: {}, scene: [{ type: 'rect', x: FLOOR.sh[0] - 70, y: -MAT, w: 400, h: MAT, rx: 3 }] }; }
function situpProps(P) {
  const an = P.joints.ankle, roll = [an[0] + 14, an[1] - 13];
  return { anchors: { roll }, scene: [{ type: 'rect', x: FLOOR.sh[0] - 70, y: -MAT, w: 400, h: MAT, rx: 3 }, { type: 'line', from: [roll[0], roll[1]], to: [roll[0], -MAT], w: 4 }, { type: 'bar', at: roll, r: 8 }] };
}
function skullProps(P) {
  const g = gripOf(P);
  return { anchors: { bar: g, uarm: uarmMid(P) }, scene: [
    { type: 'rect', x: -95, y: -92, w: 225, h: 12, rx: 3 }, { type: 'line', from: [-60, -80], to: [-60, 0], w: 5 }, { type: 'line', from: [100, -80], to: [100, 0], w: 5 }, // Flachbank
    plate(g, CURL_PLATE) // SZ-Stange mit kleinen Scheiben (Konvention)
  ] };
}
function kickbackDbProps(P) {
  const g = gripOf(P), [x0, x1] = ONE_ROW.bench;
  return { anchors: { hand: g, uarm: uarmMid(P) }, scene: [
    { type: 'rect', x: x0, y: -92, w: x1 - x0, h: 12, rx: 3 }, { type: 'line', from: [x0 + 30, -80], to: [x0 + 30, 0], w: 5 }, { type: 'line', from: [x1 - 30, -80], to: [x1 - 30, 0], w: 5 }, // Flachbank
    db(g, [1, 0], true) // Neutralgriff: Hantelachse zeigt aus dem Bild
  ] };
}
function benchDipProps(P) {
  const w = BDIP.W;
  return { anchors: { uarm: uarmMid(P), bench: [w[0] - 50, -92] }, scene: [
    { type: 'rect', x: w[0] - 150, y: -92, w: 156, h: 12, rx: 3 }, { type: 'line', from: [w[0] - 130, -80], to: [w[0] - 130, 0], w: 5 }, { type: 'line', from: [w[0] - 18, -80], to: [w[0] - 18, 0], w: 5, back: true } // Flachbank hinter der Figur
  ] };
}
function dipMachineProps(P) {
  const hand = P.joints.hand, h = P.joints.hip, pv = DIPM.pivot;
  return { anchors: { hand, uarm: uarmMid(P) }, scene: [
    { type: 'rect', x: h[0] - 30, y: h[1] + 2, w: 64, h: 12, rx: 4 }, benchLine(P, 26, 120, -8), // Sitz, Lehne
    { type: 'line', from: [h[0], h[1] + 14], to: [h[0], 0], w: 6 }, foot(h[0] - 50, h[0] + 60),
    { type: 'line', from: [pv[0], pv[1]], to: [pv[0], 0], w: 8, back: true }, foot(pv[0] - 40, pv[0] + 40), { type: 'bar', at: pv, r: 7 }, // Säule mit Drehachse
    { type: 'line', from: pv, to: hand, w: 5, back: true }, // Hebelarm (seitlich neben dem Körper, daher hinter der Figur)
    { type: 'line', from: [hand[0] - 9, hand[1]], to: [hand[0] + 9, hand[1]], w: 6, front: true } // Griff
  ] };
}

// ---------- Szenen Runde 9 (v2.12) ----------
function crossoverProps(high) {
  return (P) => {
    const hr = P.joints.handR, hl = P.joints.handL, t = XOV.tower, y = high ? XOV.high : XOV.low, px = t - 10;
    const grip = (h) => ({ type: 'rect', x: h[0] - 5, y: h[1] - 7, w: 10, h: 14, rx: 3, front: true });
    return { anchors: {}, scene: [
      { type: 'line', from: [t, 0], to: [t, -380], w: 8 }, foot(t - 30, t + 30), { type: 'line', from: [-t, 0], to: [-t, -380], w: 8 }, foot(-t - 30, -t + 30), // zwei Türme
      { type: 'bar', at: [px, y], r: 7 }, { type: 'bar', at: [-px, y], r: 7 }, // Rollen
      { type: 'line', from: [px, y], to: hr, w: 1.5, dash: true }, { type: 'line', from: [-px, y], to: hl, w: 1.5, dash: true }, // Seile
      grip(hr), grip(hl)
    ] };
  };
}
// Kurzhantel-Fliegende im Blick von oben (Figur um −90° gedreht, Kopf links): Bank als Rechteck unter Kopf, Rumpf und Gesäß.
function flyDbProps(P) {
  const J = P.joints, hR = J.handR, hL = J.handL, x0 = J.head[0] - 8, x1 = J.pelvis[0] + 40, y = J.pelvis[1];
  const g = (h, w) => [(h[0] + w[0]) / 2, (h[1] + w[1]) / 2];
  return { anchors: { bench: [x1 - 30, y + 30] }, scene: [
    { type: 'rect', x: x0, y: y - 28, w: x1 - x0, h: 56, rx: 4 }, // Flachbank von oben
    db(g(hR, J.wristR), [1, 0]), db(g(hL, J.wristL), [1, 0]) // Neutralgriff: Hantelachse längs zum Körper
  ] };
}

// Butterfly mit Armpolstern (Frontansicht): dieselbe Maschine wie der Reverse Butterfly (RPD), Unterarme senkrecht an den Polstern.
function pecDeckProps(P) {
  const J = P.joints, top = RPD.seat - 250, pel = J.pelvis;
  const pad = (e, w) => ({ type: 'line', from: [e[0], e[1] + 4], to: [w[0], w[1] - 4], w: 12, front: true }); // Polster am Unterarm
  return { anchors: { pad: [(J.elbowR[0] + J.wristR[0]) / 2, (J.elbowR[1] + J.wristR[1]) / 2] }, scene: [
    { type: 'rect', x: -38, y: pel[1] + 6, w: 76, h: 10, rx: 3 }, { type: 'line', from: [0, pel[1] + 16], to: [0, 0], w: 6 }, foot(-70, 70), // Sitz, Stütze
    { type: 'line', from: [-52, top], to: [52, top], w: 6 }, // Querträger mit den Drehachsen
    { type: 'line', from: [10, top], to: [J.wristR[0], top], w: 4 }, { type: 'line', from: [J.wristR[0], top], to: [J.wristR[0], J.wristR[1] - 6], w: 4 }, // Hebel rechts
    { type: 'line', from: [-10, top], to: [J.wristL[0], top], w: 4 }, { type: 'line', from: [J.wristL[0], top], to: [J.wristL[0], J.wristL[1] - 6], w: 4 },
    pad(J.elbowR, J.wristR), pad(J.elbowL, J.wristL)
  ] };
}

// ---------- Szenen Runde 15 (v2.20) ----------
// Multipresse auf der Schrägbank: Schräglehne und Sitz wie beim Schrägbankdrücken, Führungsschiene senkrecht durch die Stange (SMI.x).
function smithInclineProps(P) {
  const h = P.joints.hip, top = along(along(h, segNrm(P, 'trunk'), -24), segDir(P, 'trunk'), -165), bar = P.joints.hand, x = SMI.x;
  return { anchors: { bar }, scene: [
    benchLine(P, 24, 170, -6), { type: 'line', from: [h[0] - 20, h[1] + 24], to: [h[0] + 50, h[1] + 24], w: 14 }, // Lehne 30°, Sitz
    { type: 'line', from: [h[0] + 10, h[1] + 30], to: [h[0] + 10, 0], w: 6 }, { type: 'line', from: top, to: [top[0], 0], w: 6 }, foot(h[0] - 20, h[0] + 40), foot(top[0] - 30, top[0] + 30),
    { type: 'line', from: [x, 0], to: [x, -460], w: 6, back: true }, foot(x - 70, x + 70), { type: 'line', from: [x - 70, -460], to: [x + 70, -460], w: 6, back: true }, // Führungsschiene, Querträger
    { type: 'rect', x: x - 9, y: bar[1] - 14, w: 18, h: 28, rx: 3, back: true }, // Schlitten
    plate([x, bar[1]])
  ] };
}
// Schräge Brustpresse: Sitz und Lehne wie an der Brustpresse; Hebelarm vom Drehpunkt (IMP.pivot) hinter dem Sitz zum Griff, hinter dem Körper.
function inclinePressProps(P) {
  const h = P.joints.hip, hand = P.joints.hand, pv = IMP.pivot;
  return { anchors: { hand }, scene: [
    { type: 'rect', x: h[0] - 30, y: h[1] + 2, w: 70, h: 12, rx: 4 }, benchLine(P, 26, 150, -8), // Sitz, Lehne
    { type: 'line', from: [h[0] - 10, h[1] + 14], to: [h[0] - 10, 0], w: 6 }, foot(h[0] - 70, h[0] + 30),
    { type: 'line', from: pv, to: [pv[0], 0], w: 8, back: true }, foot(pv[0] - 40, pv[0] + 40), { type: 'bar', at: pv, r: 7, back: true }, // Fuß mit Drehachse
    { type: 'line', from: pv, to: hand, w: 5, back: true }, // Hebelarm hinter dem Körper
    { type: 'line', from: along(hand, segNrm(P, 'farm'), -10), to: along(hand, segNrm(P, 'farm'), 10), w: 5, front: true } // Griff quer zum Unterarm
  ] };
}
// Seitheben an der Maschine (Frontansicht): Sitz, Drehachsen hinter den Schultern, Hebel außen am Arm, Polster am Oberarm (gebeugt) oder Unterarm (gestreckt).
function machineLateralProps(straight) {
  return (P) => {
    const J = P.joints, pel = J.pelvis, sc = [];
    sc.push({ type: 'rect', x: -38, y: pel[1] + 6, w: 76, h: 10, rx: 3 }, { type: 'line', from: [0, pel[1] + 16], to: [0, 0], w: 6 }, foot(-70, 70)); // Sitz, Stütze
    for (const s of ['R', 'L']) {
      const sh = J['shoulder' + s], el = J['elbow' + s], wr = J['wrist' + s], sg = s === 'R' ? 1 : -1;
      const u = [el[0] - sh[0], el[1] - sh[1]], l = Math.hypot(u[0], u[1]), d = [u[0] / l, u[1] / l];
      let n = [d[1], -d[0]]; if (n[1] > 0 || (Math.abs(n[1]) < 1e-6 && n[0] * sg < 0)) n = [-n[0], -n[1]]; // Außenseite des Arms (oben/außen)
      const padAt = straight ? along(along(el, d, 30), n, 12) : along(along(sh, d, l - 14), n, 12);
      sc.push({ type: 'bar', at: sh, r: 6, back: true }, { type: 'line', from: along(sh, n, 12), to: padAt, w: 4, back: true }); // Drehachse, Hebel außen am Arm
      sc.push({ type: 'line', from: along(padAt, d, -14), to: along(padAt, d, 14), w: 11, front: true }); // Polster
      if (!straight) sc.push({ type: 'rect', x: wr[0] - 5, y: wr[1] - 2, w: 10, h: 14, rx: 3, front: true }); // Griff vor dem Körper
    }
    return { anchors: { pad: J.elbowR }, scene: sc };
  };
}
// Reverse Fly am Kabel: Türme links und rechts, Rollen auf Schulterhöhe; das Kabel des rechten Arms kommt vom linken Turm (über Kreuz vor dem Körper).
function cableReverseFlyProps(P) {
  const J = P.joints, y = (J.shoulderR[1] + J.shoulderL[1]) / 2, t = XOV.tower, g = (h, w) => [(h[0] + w[0]) / 2, (h[1] + w[1]) / 2];
  const gR = g(J.handR, J.wristR), gL = g(J.handL, J.wristL), pR = [t - 10, y], pL = [-t + 10, y];
  return { anchors: { cable: midpoint(gR, pL) }, scene: behindInBack(P, [
    { type: 'line', from: [t, 0], to: [t, -360], w: 8 }, foot(t - 40, t + 40), { type: 'line', from: [-t, 0], to: [-t, -360], w: 8 }, foot(-t - 40, -t + 40), // Türme
    { type: 'bar', at: pR, r: 7 }, { type: 'bar', at: pL, r: 7 }, // Rollen auf Schulterhöhe
    { type: 'line', from: pL, to: gR, w: 1.5, dash: true, front: true }, { type: 'line', from: pR, to: gL, w: 1.5, dash: true, front: true }, // Kabel über Kreuz
    { type: 'rect', x: gR[0] - 5, y: gR[1] - 8, w: 10, h: 16, rx: 3, front: true }, { type: 'rect', x: gL[0] - 5, y: gL[1] - 8, w: 10, h: 16, rx: 3, front: true } // Einhandgriffe
  ]) };
}
// Y-Raise: Schrägbank mit Brustauflage vor dem Rumpf (parallel zum Rumpf), Stütze zum Boden; Kurzhantel in der Hand, Achse aus dem Bild (Daumen oben).
function yRaiseProps(P) {
  const h = P.joints.hip, n = segNrm(P, 'trunk'), d = segDir(P, 'trunk'); // d: Schulter → Hüfte
  const lo = along(along(h, n, 30), d, 12), hi = along(along(h, n, 30), d, -96); // Polster vor Brust und Bauch, oberes Ende unter der Achsel
  const g = gripOf(P);
  return { anchors: { pad: midpoint(lo, hi), hand: g }, scene: [
    { type: 'line', from: lo, to: hi, w: 14 }, // Polster
    { type: 'line', from: along(lo, n, 8), to: [along(lo, n, 8)[0], 0], w: 6 }, foot(along(lo, n, 8)[0] - 40, along(lo, n, 8)[0] + 40), // Stütze
    db(g, [1, 0], true)
  ] };
}
// Face Pull: Turm vor der Figur, Rolle auf Kopfhöhe, Seil zu den Händen (Seilgriff mit Endstück).
function facePullProps(P) {
  const g = gripOf(P), t = FP.tower, p = FP.pulley;
  return { anchors: { hand: g, rope: midpoint(g, p) }, scene: [
    { type: 'line', from: [t, 0], to: [t, -420], w: 8 }, foot(t - 40, t + 40), { type: 'bar', at: p, r: 7 }, // Turm, Rolle
    { type: 'line', from: p, to: g, w: 3, front: true }, { type: 'bar', at: g, r: 4 } // Seil, Endstück in der Hand
  ] };
}

// ---------- Szenen Runde 16 (v2.21) ----------
function seatedCurlProps(P) {
  const h = P.joints.hip, kn = P.joints.knee, an = P.joints.ankle, td = segDir(P, 'thigh'), tn = segNrm(P, 'thigh'), sd = segDir(P, 'shank'), sn = segNrm(P, 'shank');
  const thighPad = along(along(kn, td, -18), tn, 16); // oben auf dem Oberschenkel, knapp vor dem Knie
  const roll = along(along(an, sd, -12), sn, -18); // hinten am Unterschenkel über der Ferse
  return { anchors: { pad: roll, thighPad }, scene: [
    { type: 'line', from: [h[0] - 26, h[1] + 20], to: [kn[0] - 20, h[1] + 20], w: 14 }, // Sitz
    { type: 'line', from: [h[0] - 30, h[1] + 16], to: [h[0] - 44, h[1] - 120], w: 14 }, // Lehne (leicht zurück)
    { type: 'line', from: [h[0] - 10, h[1] + 27], to: [h[0] - 10, 0], w: 6 }, foot(h[0] - 60, kn[0] + 40),
    { type: 'line', from: along(thighPad, td, -14), to: along(thighPad, td, 14), w: 12, front: true }, // Oberschenkelpolster
    { type: 'line', from: [kn[0], kn[1]], to: [kn[0] + 4, 0], w: 6, back: true }, { type: 'bar', at: kn, r: 6, back: true }, // Säule mit Drehachse auf Kniehöhe
    { type: 'line', from: kn, to: roll, w: 7, back: true }, { type: 'bar', at: roll, r: 11 }, // Hebel hinter dem Bein, Rolle
    { type: 'line', from: [SLC2.hand[0] - 8, SLC2.hand[1] + 4], to: [SLC2.hand[0] + 8, SLC2.hand[1] + 4], w: 4 } // Griff
  ] };
}
function nordicProps(P) {
  const an = P.joints.ankle, kn = P.joints.knee, sd = segDir(P, 'shank'), sn = segNrm(P, 'shank');
  const roll = along(along(an, sd, -10), sn, 15); // Rolle oben auf dem Unterschenkel über dem Knöchel
  return { anchors: { roll, pad: [kn[0] - 30, -14] }, scene: [
    { type: 'rect', x: kn[0] - 112, y: -14, w: 130, h: 14, rx: 4 }, // Kniepolster
    { type: 'line', from: roll, to: [roll[0] - 6, 0], w: 6, back: true }, { type: 'bar', at: roll, r: 8 }, // Halter, Rolle
    { type: 'rect', x: kn[0] + 20, y: -4, w: 190, h: 4, rx: 2 } // Matte zum Abfangen
  ] };
}
function rheProps(P) {
  const h = P.joints.hip, s = P.joints.shoulder, an = P.joints.ankle, sd = segDir(P, 'shank'), sn = segNrm(P, 'shank');
  const strap = along(along(an, sd, -12), sn, -11); // Schlaufe hinten über dem Knöchel
  return { anchors: { strap, pad: [s[0] - 30, RHE.hip[1] + 24] }, scene: [
    { type: 'line', from: [h[0] + 4, RHE.hip[1] + 36], to: [s[0] + 34, RHE.hip[1] + 36], w: 14 }, // Polster unter Rumpf und Becken
    { type: 'line', from: [s[0] + 10, RHE.hip[1] + 43], to: [s[0] + 10, 0], w: 7 }, { type: 'line', from: [h[0] + 30, RHE.hip[1] + 43], to: [h[0] + 30, 0], w: 7 }, foot(h[0] - 10, s[0] + 60),
    { type: 'line', from: [RHE.hand[0], RHE.hand[1] - 4], to: [RHE.hand[0], 0], w: 5 }, { type: 'line', from: [RHE.hand[0] - 8, RHE.hand[1]], to: [RHE.hand[0] + 8, RHE.hand[1]], w: 4 }, // Griffstange
    { type: 'bar', at: h, r: 6, back: true }, { type: 'line', from: h, to: strap, w: 6, back: true }, // Pendel mit Drehachse am Hüftgelenk
    { type: 'rect', x: strap[0] - 7, y: strap[1] - 6, w: 14, h: 12, rx: 4, front: true }
  ] };
}

function wristCurlProps(P) {
  const h = P.joints.hip, g = gripOf(P);
  return { anchors: { hand: g }, scene: [
    { type: 'line', from: [h[0] - 40, h[1] + 22], to: [h[0] + 40, h[1] + 22], w: 12 }, { type: 'line', from: [h[0] - 30, h[1] + 28], to: [h[0] - 30, 0], w: 5 }, { type: 'line', from: [h[0] + 30, h[1] + 28], to: [h[0] + 30, 0], w: 5, back: true }, // Flachbank
    { ...db(g, [1, 0], true), underHand: true } // Hantelachse quer zum Betrachter (Handfläche oben/unten); Faust darüber gezeichnet, damit die Handgelenkbewegung sichtbar bleibt (Konvention)
  ] };
}
function farmerProps(P) { return { anchors: { hand: P.joints.hand }, scene: [db(gripOf(P), [1, 0])] }; } // Neutralgriff, Hantelachse längs
function beltSquatProps(P) {
  const h = P.joints.hip, an = P.joints.ankle, belt = trunkPoint(P, 20, -100), chainLow = [an[0] + 2, -BSQ.PL + 6];
  return { anchors: { belt }, scene: [
    { type: 'rect', x: an[0] - 28, y: -BSQ.PL, w: 76, h: BSQ.PL, rx: 3 }, // Podest unter den Füßen
    { type: 'line', from: [chainLow[0], -6], to: [chainLow[0] + 150, -6], w: 7, back: true }, { type: 'bar', at: [chainLow[0] + 150, -6], r: 6, back: true }, // Hebel mit Drehpunkt vorn
    { type: 'line', from: belt, to: [belt[0], -BSQ.PL], w: 2, dash: true, front: true }, // Kette vom Gurt senkrecht nach unten
    { type: 'rect', x: belt[0] - 6, y: belt[1] - 5, w: 12, h: 10, rx: 3, front: true }, // Gurtschnalle
    { type: 'line', from: [BSQ.hand[0], BSQ.hand[1] + 6], to: [BSQ.hand[0] + 10, 0], w: 5 }, { type: 'line', from: [BSQ.hand[0] - 10, BSQ.hand[1]], to: [BSQ.hand[0] + 10, BSQ.hand[1]], w: 4 } // Griffstange
  ] };
}
function sissyProps(P) {
  return { anchors: { post: [SSQ.post, -150] }, scene: [
    { type: 'line', from: [SSQ.post, 0], to: [SSQ.post, -300], w: 7, back: true }, foot(SSQ.post - 30, SSQ.post + 30) // Pfosten zum Festhalten (seitlich, hinter der Figur)
  ] };
}

export function animationFor(ref) { return ANIMATIONS.find((a) => a.ref === ref) || null; }

// ---------- Szenen v3.6.0 ----------
function dpuProps(P) { const x = P.joints.wrist[0] + 2; return { anchors: {}, scene: [{ type: 'rect', x: x, y: -420, w: 10, h: 420, rx: 2 }, foot(x - 20, x + 30)] }; }
function chairProps(P) {
  const hx = CHSQ.hip[0], kx = CHSQ.knee[0], sy = CHSQ.seatY;
  return { anchors: {}, scene: [{ type: 'rect', x: hx - 30, y: sy, w: kx - hx + 36, h: 6, rx: 3 }, { type: 'line', from: [hx - 24, sy + 6], to: [hx - 24, 0], w: 5 }, { type: 'line', from: [kx + 2, sy + 6], to: [kx + 2, 0], w: 5 }, { type: 'line', from: [hx - 30, sy], to: [hx - 30, sy - 70], w: 5 }] };
}
function balProps(P) {
  const x0 = 30 - 44, y = -BAL.axisR * 2;
  return { anchors: {}, scene: [{ type: 'rect', x: x0, y: y - BAL.h, w: BAL.w, h: BAL.h, rx: 3 }, { type: 'rect', x: 30 - BAL.axisR - 4, y: -BAL.axisR * 2, w: BAL.axisR * 2, h: BAL.axisR * 2, rx: BAL.axisR },
    { type: 'line', from: [BAL.hand[0] + 14, 0], to: [BAL.hand[0] + 14, -420], w: 8 }, { type: 'line', from: [P.joints.hand[0], P.joints.hand[1]], to: [BAL.hand[0] + 10, P.joints.hand[1]], w: 3 }] };
}
function hcProps() { return { anchors: {}, scene: [{ type: 'line', from: [-70, 0], to: [70, 0], w: 3 }] }; }

// ---------- Szenen Runde 11 (v2.16) ----------
function plankProps(P) { return { anchors: {}, scene: [{ type: 'rect', x: PLANK.mat[0], y: -MAT, w: PLANK.mat[1] - PLANK.mat[0], h: MAT, rx: 3 }] }; }
function feProps(P) { return { anchors: {}, scene: [{ type: 'rect', x: FEPU.toeX - 34, y: -FEPU.BOX, w: 62, h: FEPU.BOX, rx: 4 }] }; }
function sidePlankProps(P) { return { anchors: {}, scene: [{ type: 'rect', x: SIDEP.E[0] - 60, y: -MAT, w: SIDEP.AW[0] - SIDEP.E[0] + 110, h: MAT, rx: 3, noBounds: true }] }; }
function copenProps(P) {
  const [kx] = COPEN.KR, [ax] = COPEN.AR, y = -COPEN.HB;
  return { anchors: {}, scene: [
    { type: 'rect', x: -230, y: -MAT, w: 300, h: MAT, rx: 3, noBounds: true }, // Matte unter Unterarm und Becken
    { type: 'rect', x: kx - 30, y, w: ax - kx + 66, h: 10, rx: 3 }, { type: 'line', from: [kx - 12, y + 10], to: [kx - 12, 0], w: 5 }, { type: 'line', from: [ax + 22, y + 10], to: [ax + 22, 0], w: 5 } // Bank
  ] };
}
function lsitProps(P) {
  const [x] = LSIT.HAND, y = -LSIT.HP;
  return { anchors: {}, scene: [{ type: 'line', from: [x - 24, y], to: [x + 24, y], w: 6, front: true }, { type: 'line', from: [x - 20, y], to: [x - 26, 0], w: 5 }, { type: 'line', from: [x + 20, y], to: [x + 26, 0], w: 5 }] };
}

// ---------- Szenen Runde 12 (v2.17) ----------
function hlrProps(P) {
  const b = [0, HLR.BAR];
  return { anchors: { bar: b, uarm: uarmMid(P) }, scene: [
    { type: 'line', from: [b[0], b[1]], to: [b[0] - 120, b[1]], w: 5 }, { type: 'line', from: [b[0] - 120, b[1] - 30], to: [b[0] - 120, 0], w: 7 }, foot(-170, -70), // Ausleger, Säule hinter der Figur
    { type: 'bar', at: b, r: 5 }
  ] };
}
function captProps(P) {
  const E = CAPT.E, px = CAPT.padX, py = E[1] + 9, post = px - 22;
  return { anchors: { pad: [E[0] + 24, py] }, scene: [
    { type: 'line', from: [post, E[1] - 110], to: [post, 0], w: 8 }, foot(post - 40, E[0] + 90), // Rahmen hinter dem Rücken
    { type: 'rect', x: px - 12, y: E[1] - 90, w: 12, h: 115, rx: 4 }, // Rückenpolster (endet über dem Gesäß)
    { type: 'line', from: [post, py + 6], to: [E[0] + 66, py + 6], w: 5 }, // Armstütze
    { type: 'rect', x: E[0] - 12, y: py - 4, w: 74, h: 9, rx: 4 }, // Unterarmpolster
    { type: 'line', from: [E[0] + 66, py + 6], to: [E[0] + 66, py - 14], w: 5, front: true } // Griff
  ] };
}
function ccrProps(P) {
  const p = CCR.pulley, col = p[0] + 34, hand = P.joints.hand;
  return { anchors: { hand }, scene: [
    { type: 'line', from: [col, 0], to: [col, p[1] - 12], w: 8 }, { type: 'line', from: [col, p[1] - 12], to: [p[0], p[1] - 12], w: 6 }, foot(col - 40, col + 40), // Turm, Ausleger
    { type: 'bar', at: p, r: 8 }, { type: 'line', from: p, to: hand, w: 1.5, dash: true }, // obere Rolle, Seil
    { type: 'line', from: [hand[0] - 2, hand[1] - 10], to: [hand[0] + 2, hand[1] + 8], w: 4, front: true } // Seilende in der Hand
  ] };
}
function mcrProps(P) {
  const h = MCR.hip, an = P.joints.ankle, pv = MCR.pivot, pad = trunkPoint(P, 36, -34);
  const up = [Math.sin((P.angles.upper ?? P.angles.trunk) * Math.PI / 180), -Math.cos((P.angles.upper ?? P.angles.trunk) * Math.PI / 180)];
  return { anchors: { pad }, scene: [
    { type: 'rect', x: h[0] - 34, y: h[1] + 6, w: 72, h: 10, rx: 3 }, { type: 'line', from: [h[0], h[1] + 16], to: [h[0], 0], w: 6 }, foot(h[0] - 50, an[0] + 40), // Sitz
    { type: 'line', from: [h[0] + 8, -40], to: [an[0] - 4, -40], w: 4 }, { type: 'bar', at: [an[0] + 13, an[1] - 4], r: 8 }, { type: 'line', from: [an[0] - 4, -40], to: [an[0] + 13, an[1] - 4], w: 4 }, // Fußrolle
    { type: 'line', from: [pv[0] - 26, pv[1] - 30], to: [pv[0] - 26, 0], w: 8, back: true }, { type: 'line', from: [pv[0] - 26, pv[1]], to: pv, w: 6, back: true }, { type: 'bar', at: pv, r: 7, back: true }, // Säule mit Drehachse (seitlich neben dem Rumpf, daher hinter der Figur)
    { type: 'line', from: pv, to: pad, w: 5, back: true }, // Hebelarm seitlich neben dem Rumpf
    { type: 'line', from: along(pad, up, -24), to: along(pad, up, 22), w: 12 } // Brustpolster
  ] };
}
const gripFront = (P) => { const J = P.joints; return [(J.handR[0] + J.wristR[0] + J.handL[0] + J.wristL[0]) / 4, (J.handR[1] + J.wristR[1] + J.handL[1] + J.wristL[1]) / 4]; }; // Mitte beider Hände
function wchProps(P) {
  const g = gripFront(P), t = WCH.tower, p = [t - 10, WCH.pulleyY];
  return { anchors: {}, scene: [
    { type: 'line', from: [t, 0], to: [t, WCH.pulleyY - 20], w: 8 }, foot(t - 40, t + 40), { type: 'bar', at: p, r: 7 }, // Turm, obere Rolle
    { type: 'line', from: p, to: g, w: 1.5, dash: true, front: true }, // Seil
    { type: 'rect', x: g[0] - 6, y: g[1] - 8, w: 12, h: 16, rx: 3, front: true } // Griff (beide Hände)
  ] };
}
function palProps(P) {
  const g = gripFront(P), t = PAL.tower, p = [t - 10, PAL.pulleyY];
  return { anchors: {}, scene: [
    { type: 'line', from: [t, 0], to: [t, -380], w: 8 }, foot(t - 40, t + 40), { type: 'bar', at: p, r: 7 }, // Turm, Rolle auf Höhe der gestreckten Hände
    { type: 'line', from: p, to: g, w: 1.5, dash: true, front: true }, // Seil von der Seite
    { type: 'rect', x: g[0] - 6, y: g[1] - 8, w: 12, h: 16, rx: 3, front: true } // Griff (beide Hände)
  ] };
}

// ---------- Szenen Runde 13 (v2.18) ----------
function rollProps(P) {
  const w = P.joints.wrist, sh = P.joints.shoulder, d = [w[0] - sh[0], w[1] - sh[1]], l = Math.hypot(d[0], d[1]) || 1, ax = [w[0] + d[0] / l * 20, w[1] + d[1] / l * 20]; // Achse auf der Linie Schulter–Handgelenk
  return { anchors: { wheel: ax }, scene: [
    { type: 'bar', at: ax, r: 18, back: true }, { type: 'bar', at: ax, r: 5 }, // Rad (von der Seite, hinter der Hand), Nabe
    { type: 'rect', x: -150, y: -MAT, w: 420, h: MAT, rx: 3, noBounds: true } // Matte unter den Knien
  ] };
}
function hfxProps(P) {
  const t = HFX.tower, cuff = P.joints.ankle;
  return { anchors: { cuff }, scene: [
    { type: 'line', from: [t, 0], to: [t, -420], w: 8 }, foot(t - 50, t + 40), { type: 'bar', at: [t + 8, HFX.pulley], r: 7 }, // Turm hinter der Figur, untere Rolle
    { type: 'line', from: [t + 8, HFX.pulley], to: cuff, w: 1.5, dash: true, front: true }, // Seil zur Manschette
    { type: 'rect', x: cuff[0] - 7, y: cuff[1] - 6, w: 14, h: 12, rx: 4, front: true } // Manschette
  ] };
}
function sbdProps(P) { return { anchors: {}, scene: [db(P.joints.handR, [1, 0], true)] }; } // Kurzhantel im Neutralgriff, Achse zeigt aus dem Bild
function rtwProps(P) { return { anchors: {}, scene: [{ type: 'rect', x: -120, y: -MAT, w: 240, h: MAT, rx: 3 }] }; } // Matte

// ---------- Szenen Runde 14 (v2.19) ----------
function scrProps(P) {
  const h = SCR.hip, t = SCR.toe, K = P.joints.knee, d = segDir(P, 'thigh'), n = segNrm(P, 'thigh'), pad = along(along(K, d, -16), n, 24), col = t[0] + 50;
  return { anchors: { pad }, scene: [
    { type: 'rect', x: t[0] - 24, y: -SCR.BLK, w: 36, h: SCR.BLK, rx: 2 }, // Block unter dem Vorfuß
    { type: 'rect', x: h[0] - 42, y: h[1] + 15, w: 80, h: 10, rx: 3 }, { type: 'line', from: [h[0] - 4, h[1] + 25], to: [h[0] - 4, 0], w: 6 }, foot(h[0] - 50, col + 30), // Sitz, Stütze, Standfuß
    { type: 'line', from: [col, 0], to: [col, pad[1] - 4], w: 7 }, { type: 'line', from: [col, pad[1] - 4], to: pad, w: 5 }, // Säule vor den Füßen, Hebelarm zum Polster
    { type: 'rect', x: pad[0] - 18, y: pad[1] - 6, w: 36, h: 12, rx: 5, front: true } // Polster auf den Oberschenkeln
  ] };
}
function lpcProps(P) {
  const t = P.joints.toe, rail = [Math.SQRT1_2, -Math.SQRT1_2], pd = [-Math.SQRT1_2, -Math.SQRT1_2]; // Schienen 45° nach vorn-oben, Platte senkrecht dazu
  const pc = along(along(t, pd, 30), rail, 5); // Ballen an der unteren Plattenkante
  return { anchors: { plate: along(pc, rail, 10) }, scene: [
    { type: 'line', from: along(pc, rail, -150), to: along(pc, rail, 90), w: 5 }, // Schiene
    { type: 'line', from: [pc[0] + 60, 0], to: along(pc, rail, 60), w: 5 }, // Stütze
    benchLine(P, 30, 150, 4), { type: 'line', from: along(along(P.joints.hip, segDir(P, 'trunk'), 16), segNrm(P, 'trunk'), -30), to: along(along(P.joints.hip, segDir(P, 'trunk'), 16), segNrm(P, 'trunk'), 44), w: 14 }, // Lehne, Sitz
    { type: 'line', from: [P.joints.hip[0] + 20, P.joints.hip[1] + 20], to: [P.joints.hip[0] + 20, 0], w: 5 }, foot(P.joints.hip[0] - 30, pc[0] + 80), // Standfuß
    { type: 'line', from: along(pc, pd, -34), to: along(pc, pd, 46), w: 8, front: true } // Fußplatte
  ] };
}
function slcProps(P) { return { anchors: {}, scene: [{ type: 'rect', x: 16, y: -STEP, w: 22, h: STEP, rx: 2, step: true }, { type: 'rect', x: SLC.wall, y: -430, w: 12, h: 430, rx: 1, noBounds: true }] }; } // Stufe, Wand
function hipmProps(inner) { return (P) => {
  const J = P.joints, py = J.pelvis[1], sc = [
    { type: 'rect', x: -50, y: py - 118, w: 100, h: 112, rx: 8 }, // Rückenpolster
    { type: 'rect', x: -62, y: py + 2, w: 124, h: 12, rx: 4 }, { type: 'line', from: [0, py + 14], to: [0, 0], w: 8 }, foot(-70, 70) // Sitz, Säule
  ];
  for (const [s, sg] of [['R', 1], ['L', -1]]) {
    const k = J['knee' + s], a = J['ankle' + s], px = k[0] + sg * (inner ? -19 : 19);
    sc.push({ type: 'line', from: [px, k[1] + 10], to: [a[0] + sg * (inner ? -6 : 6), a[1] + 18], w: 5 }); // Hebel vom Polster zur Fußstütze
    sc.push({ type: 'line', from: [a[0] - 16, a[1] + 18], to: [a[0] + 16, a[1] + 18], w: 5 }); // Fußstütze
    sc.push({ type: 'rect', x: px - 6, y: k[1] - 26, w: 12, h: 44, rx: 5, front: true }); // Polster an der Knie-Außenseite (Abduktion) bzw. -Innenseite (Adduktion)
  }
  return { anchors: {}, scene: sc };
}; }
function chipProps(side) { return (P) => {
  const J = P.joints, sg = side === 'R' ? 1 : -1, t = sg * 120, pu = [t - sg * 8, -20], cuff = J.ankleR, hand = J['wrist' + side];
  return { anchors: { cuff }, scene: [
    { type: 'line', from: [t, 0], to: [t, -420], w: 8 }, foot(t - 40, t + 40), { type: 'bar', at: pu, r: 7 }, // Turm, untere Rolle
    { type: 'line', from: [t, hand[1]], to: [hand[0] + sg * 4, hand[1]], w: 4 }, // Haltegriff am Turm
    { type: 'line', from: pu, to: cuff, w: 1.5, dash: true, front: true }, // Seil zur Manschette (bei der Abduktion vor dem Standbein vorbei)
    { type: 'rect', x: cuff[0] - 9, y: cuff[1] - 6, w: 18, h: 12, rx: 4, front: true } // Manschette am rechten Knöchel
  ] };
}; }
function sideMatProps(P) { return { anchors: {}, scene: [{ type: 'rect', x: -300, y: -MAT, w: 540, h: MAT, rx: 3, noBounds: true }] }; }
function clamProps(P) {
  const J = P.joints, at = (s) => [J['hip' + s][0] + (J['knee' + s][0] - J['hip' + s][0]) * 0.8, J['hip' + s][1] + (J['knee' + s][1] - J['hip' + s][1]) * 0.8];
  return { anchors: { band: at('R') }, scene: [{ type: 'rect', x: -300, y: -MAT, w: 540, h: MAT, rx: 3, noBounds: true }, { type: 'line', from: at('R'), to: at('L'), w: 4, front: true }] }; // Matte, Mini-Band über den Knien
}

export function framesOf(anim, variant) {
  const fr = Array.isArray(anim.frames) ? anim.frames : anim.frames[variant || anim.variants[0].key];
  if (anim.view === 'back') return fr.map((f) => ({ ...f, pose: { view: 'front', back: true, ...f.pose } })); // v2.20.0: Rückansicht = Frontfigur, von hinten gezeichnet
  return anim.view === 'front' ? fr.map((f) => ({ ...f, pose: { view: 'front', ...f.pose } })) : fr;
}
export { LEN };


// ---------- Mobility: Anpassung an „ohne Gewicht“ (angehängt von tools/sync-anim.mjs) ----------
// Kernpunkte, die nur Hanteln, Zusatzgewicht oder Muskelaufbau betreffen, entfallen; Hinweisbilder (kp-Indizes der Phasen) rücken nach.
// Wo nur ein Wort „Hanteln“ vorkommt, wird es durch „Arme“ ersetzt; die Quellenaussage bleibt unverändert.
const MOBILITY_DROP = {
  'shoulder-press-dumbbell': [0, 3],
  'dumbbell-curl': [4],
  'dumbbell-triceps-kickback': [1, 3]
};
const MOBILITY_TEXT = {
  'shoulder-press-dumbbell': [['Hanteln hochdrücken, bis die Ellbogen gestreckt sind; Hände über den Schultern.', 'Arme hochdrücken, bis die Ellbogen gestreckt sind; Hände über den Schultern.']]
};
for (const a of ANIMATIONS) {
  for (const [from, to] of MOBILITY_TEXT[a.ref] || []) {
    const kp = a.keyPoints.find((k) => k.text === from);
    if (!kp) throw new Error(`Mobility-Anpassung: Text nicht gefunden (${a.ref})`);
    kp.text = to;
  }
  const drop = MOBILITY_DROP[a.ref];
  if (!drop) continue;
  const map = new Map(); let n = 0;
  a.keyPoints.forEach((_, i) => { if (!drop.includes(i)) map.set(i, n++); });
  a.keyPoints = a.keyPoints.filter((_, i) => !drop.includes(i));
  for (const ph of a.phases) if (Array.isArray(ph.kp)) ph.kp = ph.kp.filter((i) => map.has(i)).map((i) => map.get(i));
}
