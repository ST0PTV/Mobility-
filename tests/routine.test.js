// Tests der Ablauf-Logik (Node): node tests/routine.test.js
import assert from 'node:assert/strict';
import { PROGRAM, EXERCISES } from '../js/data.js';
import { workSeconds, steps, doseText, gearList, itemSeconds, fmtClock, orderProgram, moveRef } from '../js/routine.js';

let n = 0;
const test = (name, fn) => { fn(); n++; console.log(`ok   ${name}`); };
const refs = PROGRAM.map((e) => e.ref);

test('Programm: 13 Übungen, alle Referenzen vorhanden', () => {
  assert.equal(PROGRAM.length, 13);
  assert.ok(PROGRAM.every((e) => EXERCISES[e.ref]));
});
test('Schritte: 13 Übungen, 20 Wiederholungen bzw. Hüftkreisen 60 s, keine Pausen', () => {
  const st = steps(PROGRAM);
  assert.equal(st.length, 13);
  assert.ok(st.every((x) => x.kind === 'exercise' && !('restBefore' in x)));
  assert.ok(st.every((x) => (x.item.dose.mode === 'reps' ? x.item.dose.reps === 20 : x.item.dose.seconds === 60)));
});
test('Übungszeit: 12 × 60 s + 60 s = 780 s (3 s je Wiederholung)', () => {
  assert.equal(workSeconds(PROGRAM), 780);
  assert.equal(itemSeconds({ mode: 'reps', reps: 20 }), 60);
  assert.equal(doseText({ mode: 'reps', reps: 20 }), '20×');
  assert.equal(doseText({ mode: 'time', seconds: 60 }), '1:00');
  assert.equal(fmtClock(75), '1:15');
});
test('Reihenfolge: leer = Grundreihenfolge; gespeicherte zuerst; Unbekanntes und Doppeltes ignoriert; Fehlendes hinten', () => {
  assert.deepEqual(orderProgram(PROGRAM, []).map((e) => e.ref), refs);
  assert.deepEqual(orderProgram(PROGRAM, null).map((e) => e.ref), refs);
  const o = orderProgram(PROGRAM, ['lunge', 'gibt-es-nicht', 'lunge', 'crunch']).map((e) => e.ref);
  assert.deepEqual(o.slice(0, 2), ['lunge', 'crunch']);
  assert.equal(o.length, 13);
  assert.equal(new Set(o).size, 13);
});
test('Verschieben: hoch/runter tauscht Nachbarn, an den Enden unverändert, Eingabe bleibt unverändert', () => {
  const r = ['a', 'b', 'c'];
  assert.deepEqual(moveRef(r, 1, -1), ['b', 'a', 'c']);
  assert.deepEqual(moveRef(r, 1, 1), ['a', 'c', 'b']);
  assert.deepEqual(moveRef(r, 0, -1), ['a', 'b', 'c']);
  assert.deepEqual(moveRef(r, 2, 1), ['a', 'b', 'c']);
  assert.deepEqual(r, ['a', 'b', 'c']);
});
test('Schritte folgen der gewählten Reihenfolge', () => {
  const o = orderProgram(PROGRAM, moveRef(refs, 6, -1));
  assert.equal(steps(o)[5].item.ref, 'hip-circles');
  assert.equal(steps(o)[6].item.ref, 'crunch');
});
test('Geräteliste ohne Doppelte', () => {
  assert.deepEqual(gearList(PROGRAM).sort(), ['Balanceboard', 'Matte', 'Stuhl', 'Türrahmen']);
});
console.log(`\n${n} Tests bestanden.`);
