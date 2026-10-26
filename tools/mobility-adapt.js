
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
