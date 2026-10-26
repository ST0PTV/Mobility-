// Erzeugt von tools/sync-anim.mjs – nicht von Hand ändern.
export const POOL = {
  "dumbbell-curl": {
    "name": "Bizepscurls",
    "muscles": {
      "primary": [
        "biceps"
      ],
      "secondary": [
        "forearms"
      ]
    }
  },
  "shoulder-press-dumbbell": {
    "name": "Schulterdrücken",
    "muscles": {
      "primary": [
        "front-delts"
      ],
      "secondary": [
        "side-delts",
        "triceps"
      ]
    }
  },
  "lateral-raise-dumbbell": {
    "name": "Seitheben",
    "muscles": {
      "primary": [
        "side-delts"
      ],
      "secondary": [
        "rear-delts",
        "upper-back",
        "front-delts"
      ]
    }
  },
  "dumbbell-reverse-lunge": {
    "name": "Ausfallschritte rückwärts",
    "muscles": {
      "primary": [
        "quads",
        "glutes"
      ],
      "secondary": [
        "adductors",
        "abductors",
        "hamstrings"
      ]
    }
  },
  "floor-crunch": {
    "name": "Crunch (Boden)",
    "muscles": {
      "primary": [
        "abs"
      ],
      "secondary": [
        "obliques"
      ]
    }
  },
  "dumbbell-triceps-kickback": {
    "name": "Kurzhantel-Kickback",
    "muscles": {
      "primary": [
        "triceps"
      ],
      "secondary": [
        "rear-delts"
      ]
    }
  },
  "wrist-curl": {
    "name": "Handgelenkcurls",
    "muscles": {
      "primary": [
        "forearms"
      ],
      "secondary": []
    }
  },
  "reverse-wrist-curl": {
    "name": "Reverse Handgelenkcurls",
    "muscles": {
      "primary": [
        "forearms"
      ],
      "secondary": []
    }
  },
  "dumbbell-front-raise": {
    "name": "Frontheben",
    "muscles": {
      "primary": [
        "front-delts"
      ],
      "secondary": [
        "chest",
        "upper-back"
      ]
    }
  }
};
export const poolEntry = (ref) => POOL[ref] || null;
export const MUSCLES = {
  "chest": "Brust",
  "front-delts": "Vordere Schulter",
  "side-delts": "Seitliche Schulter",
  "rear-delts": "Hintere Schulter",
  "lats": "Latissimus",
  "upper-back": "Oberer Rücken / Trapez",
  "lower-back": "Unterer Rücken",
  "biceps": "Bizeps",
  "triceps": "Trizeps",
  "forearms": "Unterarme",
  "abs": "Bauch",
  "obliques": "Seitliche Bauchmuskeln",
  "glutes": "Gesäß",
  "quads": "Quadrizeps",
  "hamstrings": "Beinbeuger",
  "adductors": "Adduktoren",
  "abductors": "Abduktoren",
  "calves": "Waden",
  "hip-flexors": "Hüftbeuger"
};
