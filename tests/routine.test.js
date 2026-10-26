// Tests der Ablauf-Logik (Node): node tests/routine.test.js
import assert from 'node:assert/strict';
import { PROGRAM, BASE_MINUTES, EXERCISES } from '../js/data.js';
import { totalSeconds, workSeconds, minuteRange, restSeconds, nextMinutes, steps, remainingSeconds, doseText, gearList, itemSeconds, MIN_REST, MAX_REST } from '../js/routine.js';

let n = 0;
const test = (name, fn) => { fn(); n++; console.log(`ok   ${name}`); };

test('Programm: 13 Übungen, alle Referenzen vorhanden', () => {
  assert.equal(PROGRAM.length, 13);
  assert.ok(PROGRAM.every((e) => EXERCISES[e.ref]));
});
test('Wiederholungen bleiben bei jeder Dauer fest: 20 je Übung, Hüftkreisen 60 s', () => {
  for (let m = 15; m <= 45; m += 5) {
    const st = steps(PROGRAM, m).filter((x) => x.kind === 'exercise');
    assert.equal(st.length, 13);
    assert.ok(st.every((x) => (x.item.dose.mode === 'reps' ? x.item.dose.reps === 20 : x.item.dose.seconds === 60)), `Dauer ${m}`);
  }
});
test('Dauer ändert die Pause: 15 min → 10 s, länger → längere Pause, nie außerhalb der Grenzen', () => {
  assert.equal(restSeconds(PROGRAM, 15), 10);
  assert.ok(restSeconds(PROGRAM, 30) > restSeconds(PROGRAM, 20));
  for (let m = 15; m <= 45; m += 5) assert.ok(restSeconds(PROGRAM, m) >= MIN_REST && restSeconds(PROGRAM, m) <= MAX_REST);
});
test('Gesamtdauer trifft die Wunschdauer (±1 Minute) im ganzen Bereich', () => {
  const [lo, hi] = minuteRange(PROGRAM);
  assert.deepEqual([lo, hi], [15, 45]);
  for (let m = lo; m <= hi; m += 5) assert.ok(Math.abs(totalSeconds(PROGRAM, m) - m * 60) <= 60, `${m} -> ${totalSeconds(PROGRAM, m) / 60}`);
});
test('Ausgangsdauer: Arbeit 13 min, Standard 15 min', () => {
  assert.equal(workSeconds(PROGRAM), 780);
  assert.equal(BASE_MINUTES, 15);
});
test('Dauer-Schritte: 5 min, Grenzen 15 und 45, unveränderte Werte an der Grenze', () => {
  assert.equal(nextMinutes(PROGRAM, 15, 1), 20); assert.equal(nextMinutes(PROGRAM, 20, -1), 15);
  assert.equal(nextMinutes(PROGRAM, 15, -1), 15); assert.equal(nextMinutes(PROGRAM, 45, 1), 45);
  assert.equal(nextMinutes(PROGRAM, 12, 1), 15); assert.equal(nextMinutes(PROGRAM, 17, -1), 15);
});
test('Schritte: Übung, Pause, Übung …; 13 Übungen und 12 Pausen', () => {
  const st = steps(PROGRAM, 15);
  assert.equal(st.length, 25);
  assert.ok(st.every((x, i) => x.kind === (i % 2 === 0 ? 'exercise' : 'rest')));
  assert.equal(st[1].item.name, st[2].item.name); // Pause zeigt die nächste Übung
});
test('Restzeit ab Beginn = Gesamtdauer; sinkt mit der verstrichenen Zeit', () => {
  const st = steps(PROGRAM, 20);
  assert.equal(Math.round(remainingSeconds(st, 0)), Math.round(totalSeconds(PROGRAM, 20)));
  assert.ok(remainingSeconds(st, 12, 30) < remainingSeconds(st, 12, 0));
  assert.equal(doseText({ mode: 'reps', reps: 20 }), '20×');
  assert.equal(doseText({ mode: 'time', seconds: 60 }), '1:00');
  assert.equal(itemSeconds({ mode: 'reps', reps: 20 }), 60);
});
test('Geräteliste ohne Doppelte', () => {
  assert.deepEqual(gearList(PROGRAM).sort(), ['Balanceboard', 'Matte', 'Stuhl', 'Türrahmen']);
});
console.log(`\n${n} Tests bestanden.`);
