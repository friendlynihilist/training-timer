// La routine con cui l'app parte la prima volta: otto esercizi di mobilità, tre volte a settimana.

import { normalizeRoutine } from './model.js';

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
      { name: 'Frog Stretch', cat: 'allungamento', kind: 'time', sets: 5, seconds: 40 },
      { name: 'Couch Stretch', cat: 'allungamento', kind: 'time', sets: 5, seconds: 40, sides: true },
      { name: 'Seated Hip Flexor Lift-offs', cat: 'attivazione', kind: 'reps', sets: 2, reps: 8, sides: true },
      { name: 'Apertura allo stipite', cat: 'allungamento', kind: 'time', sets: 5, seconds: 40, sides: true },
      { name: 'Open Book', cat: 'mobilita', kind: 'time', sets: 1, seconds: 60, sides: true },
      { name: 'Butcher’s Block', cat: 'allungamento', kind: 'time', sets: 5, seconds: 40 }
    ]
  });
}
