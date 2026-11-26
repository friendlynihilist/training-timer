import { describe, it, expect } from 'vitest';
import { parseRoutine, parseVolume, parseDuration, exportRoutine } from '../src/lib/importer.js';
import { seedRoutine, SEED_TEXT, addPnf } from '../src/lib/seed.js';

// La tabella non dice che i cicli sono PNF né come si fanno gli esercizi: il confronto con la routine
// di partenza lascia fuori fasi, durata del ciclo e spiegazioni.
const bare = (r) => r.exercises.map(({ id, cat, name, phases, seconds, how, ...e }) => ({ ...e, name: name.replace('’', "'") }));

describe('parseDuration', () => {
  it.each([
    ['3:20', 200],
    ['1 min', 60],
    ['40 s', 40],
    ['45"', 45],
    ['2 minuti', 120],
    ['1 min 30 s', 90],
    ['90 sec', 90],
    ['invariato', null]
  ])('%s', (text, sec) => expect(parseDuration(text)).toBe(sec));
});

describe('parseVolume', () => {
  it.each([
    ['2 x 8 rep lente', { kind: 'reps', sets: 2, reps: 8, note: 'lente', sides: false }],
    ['3 x 5 (4-2-4), 2–4 kg', { kind: 'reps', sets: 3, reps: 5, tempo: [4, 2, 4], load: '2–4 kg' }],
    ['5 cicli (3:20)', { kind: 'time', sets: 5, seconds: 40, sides: false }],
    ['5 cicli per lato (3:20 per lato)', { kind: 'time', sets: 5, seconds: 40, sides: true }],
    ['2 x 8 per gamba', { kind: 'reps', sets: 2, reps: 8, sides: true }],
    ['1 min per lato', { kind: 'time', sets: 1, seconds: 60, sides: true }],
    ['3 x 30 s', { kind: 'time', sets: 3, seconds: 30 }],
    ['3×10', { kind: 'reps', sets: 3, reps: 10 }],
    ['4 cicli da 45 s', { kind: 'time', sets: 4, seconds: 45 }],
    ['5 cicli PNF per lato', { kind: 'time', sets: 5, sides: true, phases: [{ name: 'Posizione', seconds: 10 }, { name: 'Spingi', seconds: 6 }, { name: 'Tira', seconds: 5 }, { name: 'Rilassa', seconds: 20 }] }],
    ['12 rep', { kind: 'reps', sets: 1, reps: 12 }],
    ['3 x 8 con 10 kg', { kind: 'reps', sets: 3, reps: 8, load: '10 kg' }]
  ])('%s', (text, want) => expect(parseVolume(text)).toMatchObject(want));

  it('quello che non è un volume non diventa un esercizio', () => {
    expect(parseVolume('invariato')).toBeNull();
    expect(parseVolume('')).toBeNull();
  });
});

describe('parseRoutine', () => {
  it('la tabella incollata dà la routine di partenza, tre volte a settimana', () => {
    const { routine, skipped } = parseRoutine(SEED_TEXT);
    expect(skipped).toEqual([]);
    expect(routine.perWeek).toBe(3);
    expect(bare(routine)).toEqual(bare(seedRoutine()));
    expect(routine.exercises[2]).toMatchObject({ seconds: 40, phases: null });
  });

  it('«PNF» nel volume dà i cicli a fasi, da 41 secondi', () => {
    const { routine } = parseRoutine('Frog Stretch\t5 cicli PNF\nPlank\t3 x 45 s');
    expect(routine.exercises[0]).toMatchObject({ kind: 'time', sets: 5, seconds: 41 });
    expect(routine.exercises[0].phases).toHaveLength(4);
    expect(routine.exercises[1].phases).toBeNull();
  });

  it('la routine di partenza salvata senza fasi le riceve, senza toccare il resto', () => {
    const { routine } = parseRoutine(SEED_TEXT + '\nPlank\t3 x 45 s');
    addPnf([routine]);
    expect(routine.exercises.map((e) => (e.phases ? e.seconds : null))).toEqual([null, null, 41, 41, null, 41, null, 41, null]);
    expect(routine.exercises[2].phases[0].cue).toMatch(/quattro zampe/);
    expect(routine.exercises[3].phases[1].cue).toMatch(/contro il muro/);
    expect(routine.exercises.at(-1)).toMatchObject({ name: 'Plank', sets: 3, seconds: 45 });
  });

  it('indovina le categorie dal nome', () => {
    const { routine } = parseRoutine(SEED_TEXT);
    expect(routine.exercises.map((e) => e.cat)).toEqual(seedRoutine().exercises.map((e) => e.cat));
  });

  it('una tabella markdown, con il titolo sopra', () => {
    const { routine, skipped } = parseRoutine(`Gambe
| Esercizio | Volume |
|---|---|
| Squat | 3 x 10, 40 kg |
| Plank | 3 x 45 s |`);
    expect(skipped).toEqual([]);
    expect(routine.name).toBe('Gambe');
    expect(routine.exercises).toMatchObject([
      { name: 'Squat', kind: 'reps', sets: 3, reps: 10, load: '40 kg', cat: 'forza' },
      { name: 'Plank', kind: 'time', sets: 3, seconds: 45, cat: 'core' }
    ]);
  });

  it('un elenco semplice, una riga per esercizio', () => {
    const { routine, skipped } = parseRoutine(`- Frog Stretch: 5 cicli (3:20)
- Squat 3x10
3. Open Book – 1 min per lato
riga senza senso 12 34 qui`);
    expect(routine.exercises.map((e) => [e.name, e.kind, e.sets])).toEqual([
      ['Frog Stretch', 'time', 5],
      ['Squat', 'reps', 3],
      ['Open Book', 'time', 1]
    ]);
    expect(skipped).toHaveLength(1);
  });

  it('rilegge quello che esporta, con identificativi nuovi', () => {
    const seed = seedRoutine();
    const { routine } = parseRoutine(JSON.stringify(exportRoutine(seed)));
    expect(routine.name).toBe('Mobilità');
    expect(routine.id).not.toBe(seed.id);
    expect(routine.exercises.map(({ id, ...e }) => e)).toEqual(seed.exercises.map(({ id, ...e }) => e));
  });

  it('un testo vuoto o un JSON rotto non danno una routine', () => {
    expect(parseRoutine('').routine).toBeNull();
    expect(parseRoutine('{ rotto').routine).toBeNull();
    expect(parseRoutine('solo parole\naltre parole').routine).toBeNull();
  });
});
