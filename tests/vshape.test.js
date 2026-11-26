import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { expand, routineSeconds, summarize, sessionOf, volumeText, blocksOf, normalizeRoutine } from '../src/lib/model.js';
import { parseRoutine, parseVolume, exportRoutine } from '../src/lib/importer.js';
import { seedRoutine, vshapeRoutine, addHow, addVshape } from '../src/lib/seed.js';
import { activity, repHistory, lastReps, weeklyGoals, timeOf } from '../src/lib/stats.js';

const routine = vshapeRoutine();
const steps = expand(routine);
const works = steps.filter((s) => s.kind === 'work');
const nameOf = (s) => routine.exercises[s.ex].name;

describe('il circuito V-shape', () => {
  it('è una routine di ipertrofia, due volte a settimana, da 35-40 minuti', () => {
    expect(routine).toMatchObject({ name: 'Circuito V-shape al parchetto', type: 'ipertrofia', perWeek: 2 });
    expect(routine.exercises).toHaveLength(9);
    const minutes = routineSeconds(routine) / 60;
    expect(minutes).toBeGreaterThanOrEqual(35);
    expect(minutes).toBeLessThanOrEqual(40.5);
    expect(routine.exercises.every((e) => e.how)).toBe(true);
  });

  it('i blocchi: riscaldamento, circuito A (4 giri), circuito B (3 giri), chiusura', () => {
    expect(blocksOf(routine).map((b) => [b.name, b.rounds ?? null, b.items.length])).toEqual([
      ['Riscaldamento', null, 3],
      ['Circuito A', 4, 2],
      ['Circuito B', 3, 3],
      ['Chiusura', null, 1]
    ]);
    expect(routine.exercises.map(volumeText)).toEqual(['2 × 30 s', '2 × 8', '1 × 10', '4 × 6–10', '4 × 8–12', '3 × 8–12', '3 × 15–20', '3 × 10–15', '2 × 45 s']);
  });

  it('nei circuiti gli esercizi si alternano, giro per giro', () => {
    const a = works.filter((s) => routine.exercises[s.ex].block === 'Circuito A');
    expect(a.map((s) => [nameOf(s).split(' ')[0], s.round])).toEqual([
      ['Trazioni', 1], ['Dips', 1], ['Trazioni', 2], ['Dips', 2], ['Trazioni', 3], ['Dips', 3], ['Trazioni', 4], ['Dips', 4]
    ]);
    expect(a[0]).toMatchObject({ mode: 'manual', reps: 6, repsMax: 10, rounds: 4, seconds: null });
    const b = works.filter((s) => routine.exercises[s.ex].block === 'Circuito B');
    expect(b).toHaveLength(9);
    expect(b.slice(0, 4).map((s) => s.ex)).toEqual([5, 6, 7, 5]);
  });

  it('si recupera 60 secondi fra un esercizio e l’altro e 90 a fine giro (45 e 90 nel circuito B)', () => {
    const restAfter = (step) => steps[step.id + 1];
    const [pull1, dips1] = works.filter((s) => s.round === 1 && routine.exercises[s.ex].block === 'Circuito A');
    expect(restAfter(pull1)).toMatchObject({ kind: 'rest', seconds: 60, label: 'Pausa' });
    expect(restAfter(dips1)).toMatchObject({ kind: 'rest', seconds: 90, label: 'Fine del giro 1' });
    const lastA = works.filter((s) => routine.exercises[s.ex].block === 'Circuito A').at(-1);
    expect(restAfter(lastA)).toMatchObject({ seconds: 90, label: 'Pausa' });
    const [chin] = works.filter((s) => routine.exercises[s.ex].block === 'Circuito B');
    expect(restAfter(chin)).toMatchObject({ seconds: 45 });
  });

  it('le serie a tempo staccate hanno la pausa in mezzo', () => {
    const hang = steps.filter((s) => s.kind === 'work' && s.ex === 0);
    expect(hang).toMatchObject([{ mode: 'time', seconds: 30, set: 1, sets: 2, cycles: 1 }, { seconds: 30, set: 2 }]);
    expect(steps[hang[0].id + 1]).toMatchObject({ kind: 'rest', seconds: 30 });
  });
});

describe('le ripetizioni segnate', () => {
  const pulls = works.filter((s) => s.ex === 3);
  const draft = (reps, done = pulls) => ({
    date: '2026-11-24', routineId: routine.id, name: routine.name, type: routine.type, exercises: routine.exercises, steps, i: steps.length,
    spent: Object.fromEntries(done.map((s) => [s.id, 25])), done: Object.fromEntries(done.map((s) => [s.id, true])), reps, rested: 600, loads: {}
  });
  it('restano nel diario serie per serie, con la forbice', () => {
    const reps = Object.fromEntries(pulls.map((s, k) => [s.id, [8, 7, 6, 6][k]]));
    const [item] = summarize(routine.exercises, steps, draft(reps).spent, draft(reps).done, {}, reps);
    expect(item).toMatchObject({ name: 'Trazioni presa prona', sets: 4, of: 4, reps: 27, each: [8, 7, 6, 6], range: [6, 10] });
    const session = sessionOf(draft(reps));
    expect(session).toMatchObject({ type: 'ipertrofia', seconds: 100, total: 700 });
    expect(timeOf(session)).toBe(700);
  });
  it('senza segnarle valgono quelle previste; gli esercizi senza forbice non le tengono', () => {
    const scap = works.filter((s) => s.ex === 1);
    const d = draft({}, [...scap, pulls[0]]);
    const items = summarize(routine.exercises, steps, d.spent, d.done, {}, {});
    expect(items[0]).toMatchObject({ name: 'Scapular pull-up', reps: 16 });
    expect(items[0].each).toBeUndefined();
    expect(items[1]).toMatchObject({ reps: 6, each: [6] });
  });
  it('nei progressi: l’ultima volta, quella prima, e l’avviso quando sei al massimo', () => {
    const item = (each, of = 4) => ({ name: 'Trazioni presa prona', cat: 'forza', kind: 'reps', sets: each.length, of, each, range: [6, 10] });
    const s = (date, each, at) => ({ id: date, date, at, seconds: 100, items: [item(each)] });
    const [h] = repHistory([s('2026-11-20', [8, 7, 6, 6], 1), s('2026-11-24', [9, 8, 7, 6], 2)]);
    expect(h).toMatchObject({ name: 'Trazioni presa prona', range: [6, 10], top: false });
    expect(h.last).toMatchObject({ each: [9, 8, 7, 6], total: 30 });
    expect(h.prev.total).toBe(27);
    expect(lastReps([s('2026-11-24', [9, 8, 7, 6], 2)], 'trazioni presa prona')).toEqual([9, 8, 7, 6]);
    expect(repHistory([s('2026-11-24', [10, 10, 10, 10], 1)])[0].top).toBe(true);
    // Al massimo ma con un giro in meno: non è ancora il momento.
    expect(repHistory([s('2026-11-24', [10, 10, 10], 1)])[0].top).toBe(false);
  });
  it('gli obiettivi della settimana contano i giri: 4 a seduta, 8 a settimana', () => {
    const goals = Object.fromEntries(weeklyGoals(routine, [], '2026-11-25').map((g) => [g.name, g]));
    expect(goals['Trazioni presa prona']).toMatchObject({ unit: 'sets', target: 8 });
    expect(goals['Dead hang']).toMatchObject({ unit: 'time', target: 120 });
  });
});

describe('i minuti per tipo di routine', () => {
  it('mobilità e ipertrofia si contano separate, giorno per giorno', () => {
    const list = [
      { date: '2026-11-25', seconds: 600, total: 1800, type: 'mobilita' },
      { date: '2026-11-25', seconds: 900, total: 2400, type: 'ipertrofia' },
      { date: '2026-11-24', seconds: 300, type: 'mobilita' },
      { date: '2026-11-23', seconds: 120 }
    ];
    const week = activity(list, 'day', 7, '2026-11-25');
    expect(week.at(-1)).toMatchObject({ minutes: 70, days: 1, by: { mobilita: 30, ipertrofia: 40, altro: 0 } });
    // Le sedute più vecchie hanno solo il tempo di lavoro; senza tipo vanno in «altro».
    expect(week.at(-2).by).toEqual({ mobilita: 5, ipertrofia: 0, altro: 0 });
    expect(week.at(-3).by.altro).toBe(2);
  });
});

describe('importare una scheda a blocchi', () => {
  const text = readFileSync(new URL('./fixtures/vshape.txt', import.meta.url), 'utf8');
  it('la scheda incollata dà lo stesso circuito', () => {
    const { routine: r, skipped } = parseRoutine(text);
    expect(skipped).toEqual([]);
    expect(r).toMatchObject({ name: 'Circuito V-shape al parchetto', type: 'ipertrofia', perWeek: 2 });
    expect(r.note).toMatch(/sbarra, parallele, elastico/);
    expect(r.note).toMatch(/prima del cedimento/);
    expect(r.exercises.map((e) => e.name)).toEqual(routine.exercises.map((e) => e.name));
    expect(r.exercises.map(volumeText)).toEqual(routine.exercises.map(volumeText));
    expect(blocksOf(r).map((b) => [b.name, b.rounds ?? null])).toEqual(blocksOf(routine).map((b) => [b.name, b.rounds ?? null]));
    expect(r.exercises[3]).toMatchObject({ circuit: true, rest: 60, roundRest: 90, reps: 6, repsMax: 10, note: '' });
    expect(r.exercises[5]).toMatchObject({ rest: 45, roundRest: 90 });
    expect(r.exercises[8]).toMatchObject({ kind: 'time', apart: true, seconds: 45, note: '30–45 s' });
    expect(r.exercises[3].how).toMatch(/^Palmi in avanti/);
  });
  it('forbici e serie a tempo nel volume', () => {
    expect(parseVolume('6-10 ripetizioni')).toMatchObject({ kind: 'reps', sets: 1, reps: 6, repsMax: 10 });
    expect(parseVolume('3 x 8-12')).toMatchObject({ kind: 'reps', sets: 3, reps: 8, repsMax: 12 });
    expect(parseVolume('2 serie x 30 secondi')).toMatchObject({ kind: 'time', sets: 2, seconds: 30, apart: true });
    expect(parseVolume('3 x 30 s')).toMatchObject({ kind: 'time', sets: 3, seconds: 30, apart: false });
    expect(parseVolume('3 x 5 (4-2-4), 2–4 kg')).toMatchObject({ reps: 5, tempo: [4, 2, 4], load: '2–4 kg' });
    expect(parseVolume('3 x 5 (4-2-4), 2–4 kg').repsMax).toBeUndefined();
  });
  it('esportata e reimportata resta uguale', () => {
    const back = parseRoutine(JSON.stringify(exportRoutine(routine))).routine;
    const bare = (r) => ({ ...r, id: null, exercises: r.exercises.map((e) => ({ ...e, id: null })) });
    expect(bare(back)).toEqual(bare(routine));
  });
});

describe('chi ha già l’app', () => {
  it('trova le spiegazioni negli esercizi di mobilità, senza perdere quello che ha scritto', () => {
    const old = normalizeRoutine({ ...seedRoutine(), exercises: seedRoutine().exercises.map((e) => ({ ...e, how: '' })) });
    old.exercises[0].how = 'La mia';
    old.exercises[3].phases[1].cue = 'Contrai il muscolo che si allunga, senza muoverti: 60-70% della forza.';
    const [r] = addHow([old]);
    expect(r.exercises[0].how).toBe('La mia');
    expect(r.exercises.slice(1).every((e) => e.how.length > 40)).toBe(true);
    expect(r.exercises[3].phases[0].cue).toMatch(/contro il muro/);
    // Un'indicazione cambiata a mano ferma l'aggiornamento di quell'esercizio.
    expect(r.exercises[3].phases[1].cue).toMatch(/Contrai il muscolo/);
  });
  it('riceve il circuito V-shape, o lo ritrova corretto se c’era già', () => {
    const mob = seedRoutine();
    expect(addVshape([mob]).map((r) => r.name)).toEqual(['Mobilità', 'Circuito V-shape al parchetto']);
    const broken = normalizeRoutine({ name: 'Circuito V-shape al parchetto', exercises: [{ name: 'Dead hang' }] });
    const out = addVshape([mob, broken]);
    expect(out).toHaveLength(2);
    expect(out[1]).toMatchObject({ id: broken.id, type: 'ipertrofia' });
    expect(out[1].exercises).toHaveLength(9);
  });
});
