import { describe, it, expect } from 'vitest';
import { expand, routineSeconds, exerciseSpans, summarize, volumeText, fmtClock, fmtDur, workSeconds, normalizeExercise } from '../src/lib/model.js';
import { seedRoutine } from '../src/lib/seed.js';

const routine = seedRoutine();
const steps = expand(routine);

describe('expand', () => {
  it('comincia con il conto alla rovescia e mette 15 secondi fra un esercizio e l’altro', () => {
    expect(steps[0]).toMatchObject({ kind: 'rest', why: 'lead', seconds: 5 });
    // Fra l'ultimo passo di un esercizio e il primo del successivo c'è sempre una pausa da 15.
    for (let i = 1; i < steps.length; i++) {
      const a = steps[i - 1];
      const b = steps[i];
      if (a.kind === 'work' && b.kind === 'work') throw new Error('due passi di lavoro attaccati');
      if (b.kind === 'work' && a.kind === 'rest' && a.why === 'rest') expect(a.seconds).toBe(15);
    }
    const between = steps.filter((s, i) => s.why === 'rest' && steps[i - 1].ex !== s.ex);
    expect(between).toHaveLength(routine.exercises.length - 1);
  });

  it('le ripetizioni senza ritmo finiscono quando lo dici tu', () => {
    const hip = steps.filter((s) => s.kind === 'work' && s.ex === 0);
    expect(hip).toHaveLength(2);
    expect(hip[0]).toMatchObject({ mode: 'manual', seconds: null, reps: 8, set: 1, sets: 2 });
  });

  it('il ritmo 4-2-4 dà il tempo alla serie: cinque ripetizioni, 50 secondi', () => {
    const curl = steps.filter((s) => s.kind === 'work' && s.ex === 1);
    expect(curl).toHaveLength(3);
    expect(curl[0]).toMatchObject({ mode: 'tempo', seconds: 50 });
  });

  it('cinque cicli da 40 secondi sono un passo solo da 3:20', () => {
    const frog = steps.filter((s) => s.kind === 'work' && s.ex === 2);
    expect(frog).toEqual([expect.objectContaining({ mode: 'time', cycles: 5, cycle: 40, seconds: 200, side: null })]);
  });

  it('per lato: prima sinistra, cambio, poi destra', () => {
    const i = steps.findIndex((s) => s.kind === 'work' && s.ex === 3);
    expect(steps.slice(i, i + 3).map((s) => [s.kind, s.side ?? s.why, s.seconds])).toEqual([
      ['work', 'sx', 200],
      ['rest', 'side', 5],
      ['work', 'dx', 200]
    ]);
  });

  it('ripetizioni per gamba: sinistra e destra in ogni serie', () => {
    const lift = steps.filter((s) => s.kind === 'work' && s.ex === 4);
    expect(lift.map((s) => `${s.set}${s.side}`)).toEqual(['1sx', '1dx', '2sx', '2dx']);
  });

  it('senza pause, i passi di lavoro si toccano', () => {
    const bare = expand(routine, { rest: 0, switchRest: 0, lead: 0 });
    expect(bare.every((s) => s.kind === 'work')).toBe(true);
  });
});

describe('durate', () => {
  it('il volume per seduta è quello della tabella', () => {
    const by = Object.fromEntries(routine.exercises.map((e) => [e.name, workSeconds(e)]));
    expect(by['Frog Stretch']).toBe(200);
    expect(by['Couch Stretch']).toBe(400);
    expect(by['Open Book']).toBe(120);
    expect(by['Jefferson Curl']).toBe(150);
  });

  it('la routine dura la somma dei passi, e gli esercizi più le pause fra loro fanno il totale', () => {
    const total = routineSeconds(routine);
    expect(total).toBe(1857);
    const spans = exerciseSpans(routine);
    expect(spans[3]).toBe(405);
    expect(spans.reduce((a, b) => a + b, 0) + 5 + 7 * 15).toBe(total);
  });
});

describe('summarize', () => {
  it('conta solo quello che hai fatto', () => {
    const frog = steps.find((s) => s.ex === 2 && s.kind === 'work');
    const curl = steps.filter((s) => s.ex === 1 && s.kind === 'work');
    const spent = { [frog.id]: 200, [curl[0].id]: 50, [curl[1].id]: 20 };
    const done = { [frog.id]: true, [curl[0].id]: true };
    const items = summarize(routine.exercises, steps, spent, done, { 1: 4 });
    expect(items).toEqual([
      expect.objectContaining({ name: 'Jefferson Curl', seconds: 70, sets: 1, of: 3, reps: 5, load: 4 }),
      expect.objectContaining({ name: 'Frog Stretch', seconds: 200, sets: 1, of: 1, load: null })
    ]);
  });
});

describe('testi', () => {
  it('volume', () => {
    expect(routine.exercises.map(volumeText)).toEqual([
      '2 × 8',
      '3 × 5 · ritmo 4-2-4 · 2–4 kg',
      '5 cicli da 40 s',
      '5 cicli da 40 s per lato',
      '2 × 8 per lato',
      '5 cicli da 40 s per lato',
      '1 min per lato',
      '5 cicli da 40 s'
    ]);
  });
  it('tempi', () => {
    expect(fmtClock(200)).toBe('3:20');
    expect(fmtClock(0.2)).toBe('0:01');
    expect(fmtDur(200)).toBe('3:20');
    expect(fmtDur(40)).toBe('40 s');
    expect(fmtDur(120)).toBe('2 min');
  });
  it('un esercizio rotto torna a posto', () => {
    expect(normalizeExercise({ name: '  ', sets: 'x', kind: 'boh', tempo: [0, 0, 0] })).toMatchObject({ name: 'Esercizio', kind: 'time', sets: 1, seconds: 30, tempo: null, cat: 'altro' });
  });
});
