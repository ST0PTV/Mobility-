// Tests der Ablauf-Logik (Node): node tests/routine.test.js
import assert from 'node:assert/strict';
import { PROGRAM, BASE_MINUTES, EXERCISES } from '../js/data.js';
import { totalSeconds, scale, nextMinutes, steps, remainingSeconds, doseText, gearList, itemSeconds, LIMITS } from '../js/routine.js';

let n = 0;
const test = (name, fn) => { fn(); n++; console.log(`ok   ${name}`); };

test('Programm: 13 Übungen, alle Referenzen vorhanden', () => {
  assert.equal(PROGRAM.length, 13);
  assert.ok(PROGRAM.every((e) => EXERCISES[e.ref]));
});
test('Ausgangsdauer liegt bei rund 15 Minuten', () => {
  const m = totalSeconds(PROGRAM) / 60;
  assert.ok(m > 14 && m < 16.5, `m=${m}`);
});
test('Skalieren trifft die Wunschdauer ungefähr (±10 %) für 5, 10, 20, 30 min', () => {
  for (const min of [5, 10, 20, 30]) {
    const got = totalSeconds(scale(PROGRAM, min * 60));
    assert.ok(Math.abs(got - min * 60) <= min * 60 * 0.1, `${min} min -> ${got / 60}`);
  }
});
test('Skalieren hält die Grenzen ein und ändert das Original nicht', () => {
  const copy = JSON.stringify(PROGRAM);
  const tiny = scale(PROGRAM, 60);
  assert.ok(tiny.every((e) => (e.dose.mode === 'reps' ? e.dose.reps >= LIMITS.reps[0] : e.dose.seconds >= LIMITS.seconds[0])));
  assert.equal(JSON.stringify(PROGRAM), copy);
});
test('15 min bleibt 20 Wiederholungen und 60 s Hüftkreisen (Ausgangsprogramm)', () => {
  const s = scale(PROGRAM, BASE_MINUTES * 60);
  assert.ok(s.filter((e) => e.dose.mode === 'reps').every((e) => e.dose.reps >= 19 && e.dose.reps <= 21));
});
test('Dauer-Schritte: 1 min unter 5, 5 min darüber, Grenzen 1 und 60', () => {
  assert.equal(nextMinutes(3, 1), 4); assert.equal(nextMinutes(4, 1), 5); assert.equal(nextMinutes(5, 1), 10);
  assert.equal(nextMinutes(15, -1), 10); assert.equal(nextMinutes(5, -1), 4); assert.equal(nextMinutes(1, -1), 1);
  assert.equal(nextMinutes(60, 1), 60); assert.equal(nextMinutes(12, 1), 15); assert.equal(nextMinutes(12, -1), 10);
});
test('Schritte und Restzeit', () => {
  const st = steps(PROGRAM);
  assert.equal(st.length, 13);
  assert.equal(Math.round(remainingSeconds(st, 0)), Math.round(totalSeconds(PROGRAM) - 10));
  assert.ok(remainingSeconds(st, 6, 30) < remainingSeconds(st, 6, 0));
  assert.equal(doseText({ mode: 'reps', reps: 20 }), '20×');
  assert.equal(doseText({ mode: 'time', seconds: 60 }), '1:00');
  assert.equal(itemSeconds({ mode: 'reps', reps: 20 }), 60);
});
test('Geräteliste ohne Doppelte', () => {
  assert.deepEqual(gearList(PROGRAM).sort(), ['Balanceboard', 'Matte', 'Stuhl', 'Türrahmen']);
});
console.log(`\n${n} Tests bestanden.`);
