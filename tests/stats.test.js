import { describe, it, expect } from 'vitest';
import { weekStreak, weekDays, series, weeklyGoals, loadHistory, lastLoad, totals } from '../src/lib/stats.js';
import { seedRoutine } from '../src/lib/seed.js';

// Lunedì 23 novembre 2026.
const today = '2026-11-25';
const s = (date, seconds = 1500, items = [], at = Date.parse(date)) => ({ id: date + at, date, at, seconds, items });

describe('weekStreak', () => {
  it('conta le settimane di fila, e questa non la spezza se è ancora vuota', () => {
    expect(weekStreak([], today)).toBe(0);
    expect(weekStreak([s('2026-11-24')], today)).toBe(1);
    expect(weekStreak([s('2026-11-18'), s('2026-11-10')], today)).toBe(2);
    expect(weekStreak([s('2026-11-24'), s('2026-11-18'), s('2026-11-03')], today)).toBe(2);
    expect(weekStreak([s('2026-11-03')], today)).toBe(0);
  });
});

describe('weekDays e series', () => {
  it('la settimana va da lunedì a domenica', () => {
    const days = weekDays([s('2026-11-23'), s('2026-11-25', 600)], today);
    expect(days.map((d) => d.date)[0]).toBe('2026-11-23');
    expect(days.map((d) => d.done)).toEqual([true, false, true, false, false, false, false]);
    expect(days[2]).toMatchObject({ today: true, seconds: 600 });
  });
  it('un punto per giorno o per settimana', () => {
    const list = [s('2026-11-25', 600), s('2026-11-16', 1200), s('2026-11-17', 300)];
    expect(series(list, today, 'week')).toHaveLength(7);
    expect(series(list, today, 'week').at(-1)).toMatchObject({ label: 'Oggi', seconds: 600, count: 1 });
    expect(series(list, today, 'month')).toHaveLength(30);
    const q = series(list, today, 'quarter');
    expect(q).toHaveLength(13);
    expect(q.at(-2)).toMatchObject({ from: '2026-11-16', seconds: 1500, count: 2 });
    expect(totals(list)).toEqual({ seconds: 2100, count: 3 });
  });
});

describe('weeklyGoals', () => {
  const routine = seedRoutine();
  it('gli obiettivi sono il volume di una seduta per tre: 3:25 a seduta, 10:15 a settimana', () => {
    const goals = Object.fromEntries(weeklyGoals(routine, [], today).map((g) => [g.name, g]));
    expect(goals['Frog Stretch']).toMatchObject({ unit: 'time', target: 615, have: 0, perSide: false });
    expect(goals['Couch Stretch']).toMatchObject({ unit: 'time', target: 615, perSide: true });
    expect(goals['Jefferson Curl']).toMatchObject({ unit: 'sets', target: 9 });
    expect(goals['Seated Hip Flexor Lift-offs']).toMatchObject({ unit: 'sets', target: 6, perSide: true });
  });
  it('contano solo le sedute di questa settimana', () => {
    const items = [
      { name: 'frog stretch', seconds: 200, sets: 1 },
      { name: 'Couch Stretch', seconds: 400, sets: 2 },
      { name: 'Seated Hip Flexor Lift-offs', seconds: 120, sets: 4 }
    ];
    const goals = Object.fromEntries(weeklyGoals(routine, [s('2026-11-23', 900, items), s('2026-11-24', 900, items), s('2026-11-20', 900, items)], today).map((g) => [g.name, g]));
    expect(goals['Frog Stretch'].have).toBe(400);
    expect(goals['Couch Stretch'].have).toBe(400);
    expect(goals['Seated Hip Flexor Lift-offs'].have).toBe(4);
  });
});

describe('carichi', () => {
  it('l’ultimo, quello prima e il più alto', () => {
    const list = [
      s('2026-11-10', 900, [{ name: 'Jefferson Curl', cat: 'forza', load: 2 }]),
      s('2026-11-24', 900, [{ name: 'Jefferson Curl', cat: 'forza', load: 3 }]),
      s('2026-11-17', 900, [{ name: 'Jefferson Curl', cat: 'forza', load: 4 }, { name: 'Frog Stretch', load: null }])
    ];
    expect(loadHistory(list)).toEqual([expect.objectContaining({ name: 'Jefferson Curl', last: 3, prev: 4, best: 4 })]);
    expect(lastLoad(list, 'jefferson curl')).toBe(3);
    expect(lastLoad(list, 'Squat')).toBeNull();
  });
});
