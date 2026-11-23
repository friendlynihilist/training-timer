// La routine con cui l'app parte la prima volta: otto esercizi di mobilità, tre volte a settimana.

import { normalizeRoutine, nameKey, pnfPhases } from './model.js';

/** Le indicazioni della rana, fase per fase. */
const FROG = [
  'A quattro zampe, ginocchia larghe, tibie parallele, piedi in linea con le ginocchia. Bacino indietro fino a sentire tensione all’interno coscia: 7 su 10.',
  'Premi le ginocchia verso il pavimento come per avvicinarle, senza muoverle davvero. Adduttori al 60-70% della forza.',
  'Rilascia e contrai i glutei come per allargare ancora le ginocchia; intanto lascia scendere il bacino indietro e in basso.',
  'Espira a fondo e resta nella nuova posizione, più bassa.'
];

/** Gli esercizi a cicli della routine di partenza, tutti PNF. */
const PNF_NAMES = { 'frog stretch': FROG, 'couch stretch': [], 'apertura allo stipite': [], 'butcher’s block': [] };

/**
 * Chi aveva già la routine di partenza, salvata prima che esistessero le fasi (versione 0.1), se la
 * ritrova con i cicli PNF. Tocca solo quei quattro esercizi, e solo se sono ancora a cicli semplici.
 */
export function addPnf(routines) {
  for (const r of routines) {
    for (const e of r.exercises) {
      const cues = PNF_NAMES[nameKey(e.name).replace("'", '’')];
      if (cues && e.kind === 'time' && e.sets > 1 && !e.phases) {
        e.phases = pnfPhases(cues);
        e.seconds = e.phases.reduce((a, p) => a + p.seconds, 0);
      }
    }
  }
  return routines;
}

export const SEED_TEXT = `#\tEsercizio\tVolume per seduta\tTotale settimanale
1\t90/90 Hip Switches\t2 x 8 rep lente\tinvariato
2\tJefferson Curl\t3 x 5 (4-2-4), 2–4 kg\tinvariato
3\tFrog Stretch\t5 cicli (3:20)\t10 min
4\tCouch Stretch\t5 cicli per lato (3:20 per lato)\t10 min per lato
5\tSeated Hip Flexor Lift-offs\t2 x 8 per gamba\tinvariato
6\tApertura allo stipite\t5 cicli per lato (3:20 per lato)\t10 min per lato
7\tOpen Book\t1 min per lato\tinvariato
8\tButcher's Block\t5 cicli (3:20)\t10 min`;

export function seedRoutine() {
  return normalizeRoutine({
    name: 'Mobilità',
    perWeek: 3,
    exercises: [
      { name: '90/90 Hip Switches', cat: 'mobilita', kind: 'reps', sets: 2, reps: 8, note: 'lente' },
      { name: 'Jefferson Curl', cat: 'forza', kind: 'reps', sets: 3, reps: 5, tempo: [4, 2, 4], load: '2–4 kg' },
      { name: 'Frog Stretch', cat: 'allungamento', kind: 'time', sets: 5, phases: pnfPhases(FROG) },
      { name: 'Couch Stretch', cat: 'allungamento', kind: 'time', sets: 5, phases: pnfPhases(), sides: true },
      { name: 'Seated Hip Flexor Lift-offs', cat: 'attivazione', kind: 'reps', sets: 2, reps: 8, sides: true },
      { name: 'Apertura allo stipite', cat: 'allungamento', kind: 'time', sets: 5, phases: pnfPhases(), sides: true },
      { name: 'Open Book', cat: 'mobilita', kind: 'time', sets: 1, seconds: 60, sides: true },
      { name: 'Butcher’s Block', cat: 'allungamento', kind: 'time', sets: 5, phases: pnfPhases() }
    ]
  });
}
