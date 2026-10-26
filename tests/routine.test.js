// Tests der Ablauf-Logik (Node): node tests/routine.test.js
import assert from 'node:assert/strict';
import { PROGRAM, BASE_REST, EXERCISES } from '../js/data.js';
import { totalSeconds, workSeconds, nextRest, fmtRest, steps, remainingSeconds, doseText, gearList, itemSeconds, MAX_REST } from '../js/routine.js';

let n = 0;
const test = (name, fn) => { fn(); n++; console.log(`ok   ${name}`); };

test('Programm: 13 Übungen, alle Referenzen vorhanden', () => {
  assert.equal(PROGRAM.length, 13);
  assert.ok(PROGRAM.every((e) => EXERCISES[e.ref]));
});
test('Wiederholungen bleiben bei jeder Pause fest: 20 je Übung, Hüftkreisen 60 s', () => {
  for (const r of [0, 10, 60, 180]) {
    const st = steps(PROGRAM, r);
    assert.equal(st.length, 13);
    assert.ok(st.every((x) => (x.item.dose.mode === 'reps' ? x.item.dose.reps === 20 : x.item.dose.seconds === 60)), `Pause ${r}`);
  }
});
test('Gesamtzeit = Übungszeit + Pause × 12; Standardpause 10 s ergibt 15 min', () => {
  assert.equal(workSeconds(PROGRAM), 780);
  assert.equal(BASE_REST, 10);
  assert.equal(totalSeconds(PROGRAM, 10), 780 + 120);
  assert.equal(totalSeconds(PROGRAM, 0), 780);
  assert.equal(totalSeconds(PROGRAM, 180), 780 + 12 * 180);
});
test('Pausenschritte: 5 s bis 60 s, danach 15 s; Grenzen 0 und 180 s bleiben', () => {
  assert.equal(nextRest(10, 1), 15); assert.equal(nextRest(10, -1), 5); assert.equal(nextRest(5, -1), 0);
  assert.equal(nextRest(0, -1), 0); assert.equal(nextRest(180, 1), 180);
  assert.equal(nextRest(55, 1), 60); assert.equal(nextRest(60, 1), 75); assert.equal(nextRest(75, -1), 60); assert.equal(nextRest(60, -1), 55);
  assert.equal(nextRest(165, 1), 180);
  let c = 0, v = 0; while (v < MAX_REST) { v = nextRest(v, 1); c++; assert.ok(c < 60); }
});
test('Pausentext: keine, Sekunden, Minuten', () => {
  assert.equal(fmtRest(0), 'keine'); assert.equal(fmtRest(40), '40 s'); assert.equal(fmtRest(60), '1 min'); assert.equal(fmtRest(75), '1 min 15 s');
});
test('Schritte: 13 Übungen, Pause (restBefore) nur ab der zweiten Übung', () => {
  const st = steps(PROGRAM, 25);
  assert.equal(st.length, 13);
  assert.ok(st.every((x) => x.kind === 'exercise'));
  assert.equal(st[0].restBefore, 0);
  assert.ok(st.slice(1).every((x) => x.restBefore === 25));
});
test('Restzeit ab Beginn = Gesamtzeit; sinkt mit verstrichener Zeit; laufende Pause zählt mit', () => {
  const st = steps(PROGRAM, 20);
  assert.equal(Math.round(remainingSeconds(st, 0)), totalSeconds(PROGRAM, 20));
  assert.ok(remainingSeconds(st, 6, 30) < remainingSeconds(st, 6, 0));
  assert.equal(remainingSeconds(st, 3, 0, 12), remainingSeconds(st, 3, 0, 0) + 12);
  assert.equal(doseText({ mode: 'reps', reps: 20 }), '20×');
  assert.equal(doseText({ mode: 'time', seconds: 60 }), '1:00');
  assert.equal(itemSeconds({ mode: 'reps', reps: 20 }), 60);
});
test('Geräteliste ohne Doppelte', () => {
  assert.deepEqual(gearList(PROGRAM).sort(), ['Balanceboard', 'Matte', 'Stuhl', 'Türrahmen']);
});
console.log(`\n${n} Tests bestanden.`);
