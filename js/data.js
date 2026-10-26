// Übungen und Programm der Mobilitäts-App. Nur ruhige Bewegungen ohne Gewicht.
// Dosen: reps = Wiederholungen, time = Sekunden. Zählt nicht als Krafttraining.
export const EXERCISES = {
  'biceps-curl': { name: 'Bizeps-Curl ohne Gewicht', cue: 'Ellbogen am Körper, Hände langsam zur Schulter beugen und senken.', anim: 'dumbbell-curl' },
  'shoulder-press': { name: 'Schulterdrücken ohne Gewicht', cue: 'Hände auf Schulterhöhe, Arme langsam nach oben strecken. Auch im Sitzen.', anim: 'shoulder-press-dumbbell' },
  'lateral-raise': { name: 'Seitheben ohne Gewicht', cue: 'Arme seitlich bis Schulterhöhe heben, langsam senken. Auch im Sitzen.', anim: 'lateral-raise-dumbbell' },
  'chair-squat': { name: 'Kniebeuge auf den Stuhl', cue: 'Stuhl hinter dir, Gesäß nach hinten, kurz antippen, wieder aufstehen.', gear: 'Stuhl', anim: 'chair-squat' },
  'lunge': { name: 'Ausfallschritt', cue: 'Abwechselnd links und rechts nach hinten treten, bei Bedarf festhalten.', anim: 'dumbbell-reverse-lunge' },
  'crunch': { name: 'Crunch (Rumpfbeuge)', cue: 'Rückenlage, Knie gebeugt, Schultern langsam etwas anheben und senken.', gear: 'Matte', anim: 'floor-crunch' },
  'hip-circles': { name: 'Hüftkreisen', cue: 'Hände in die Hüfte, große Kreise, Richtung nach der Hälfte wechseln.', anim: 'hip-circles' },
  'calf-raise': { name: 'Balanceboard-Wadenheben', cue: 'Auf dem Board, Hand an der Wand, langsam auf die Zehen und ab.', gear: 'Balanceboard', anim: 'balance-board-calf-raise' },
  'triceps-back': { name: 'Trizeps nach hinten ohne Gewicht', cue: 'Oberkörper leicht vor, Arme gestreckt nach hinten führen, kurz halten.', anim: 'dumbbell-triceps-kickback' },
  'door-push-up': { name: 'Türrahmen-Push-up', cue: 'Hände am Türrahmen auf Brusthöhe, Körper gerade nach vorn kippen.', gear: 'Türrahmen', anim: 'door-frame-push-up' },
  'wrist-curl': { name: 'Unterarm-Curl ohne Gewicht', cue: 'Unterarme auf den Oberschenkeln, Handflächen oben: Hände heben und senken.', anim: 'wrist-curl' },
  'reverse-wrist-curl': { name: 'Umgekehrter Unterarm-Curl ohne Gewicht', cue: 'Wie Unterarm-Curl, Handrücken oben: Hände langsam heben und senken.', anim: 'reverse-wrist-curl' },
  'front-raise': { name: 'Frontheben ohne Gewicht', cue: 'Arme gestreckt nach vorn bis Schulterhöhe heben, langsam senken.', anim: 'dumbbell-front-raise' }
};

const R = (ref, reps = 20) => ({ ref, dose: { mode: 'reps', reps } });
const T = (ref, seconds) => ({ ref, dose: { mode: 'time', seconds } });

// Ausgangsprogramm: je 20 Wiederholungen, Hüftkreisen 1 min; Standardpause 10 s (zusammen rund 15 min).
export const BASE_REST = 10;
export const PROGRAM = [
  R('biceps-curl'), R('shoulder-press'), R('lateral-raise'), R('chair-squat'), R('lunge'), R('crunch'), T('hip-circles', 60),
  R('calf-raise'), R('triceps-back'), R('door-push-up'), R('wrist-curl'), R('reverse-wrist-curl'), R('front-raise')
];

export const HINTS = [
  'Ruhige Bewegungen ohne Gewicht, im Stehen oder Sitzen.',
  'Nur so weit bewegen, wie es angenehm ist – nicht in den Schmerz. Bei Schmerzen aufhören.',
  'Das ist kein Krafttraining und ersetzt keine ärztliche oder physiotherapeutische Anleitung.'
];
