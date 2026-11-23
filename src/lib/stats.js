// I progressi: settimane di fila, tempo allenato, andamento, obiettivi della settimana, carichi.

import { addDays, mondayOf, fmtShort, parse, WEEKDAYS } from './dates.js';
import { nameKey, workSeconds } from './model.js';

const sum = (list, f) => list.reduce((a, x) => a + f(x), 0);

/** Da quante settimane di fila ti alleni. La settimana in corso non spezza la fila se è ancora vuota. */
export function weekStreak(sessions, today) {
  const weeks = new Set(sessions.map((s) => mondayOf(s.date)));
  let week = mondayOf(today);
  if (!weeks.has(week)) week = addDays(week, -7);
  let n = 0;
  while (weeks.has(week)) {
    n++;
    week = addDays(week, -7);
  }
  return n;
}

export function totals(sessions) {
  return { seconds: sum(sessions, (s) => s.seconds), count: sessions.length };
}

/** I sette giorni della settimana di `today`, con le sedute di ognuno. */
export function weekDays(sessions, today) {
  const monday = mondayOf(today);
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(monday, i);
    const list = sessions.filter((s) => s.date === date);
    return { date, n: Number(date.slice(8)), name: WEEKDAYS[i], today: date === today, done: list.length > 0, seconds: sum(list, (s) => s.seconds) };
  });
}

export function sessionsThisWeek(sessions, today) {
  const monday = mondayOf(today);
  return sessions.filter((s) => s.date >= monday && s.date <= addDays(monday, 6));
}

/**
 * L'andamento: un punto per giorno («week», «month») o per settimana («quarter»).
 * Ogni punto: { from, to, label, seconds, count }.
 */
export function series(sessions, today, scale = 'week') {
  const points = [];
  if (scale === 'quarter') {
    const monday = mondayOf(today);
    for (let k = 12; k >= 0; k--) {
      const from = addDays(monday, -7 * k);
      points.push({ from, to: addDays(from, 6), label: k === 0 ? 'Questa settimana' : `Settimana del ${fmtShort(from)}` });
    }
  } else {
    const days = scale === 'month' ? 30 : 7;
    for (let k = days - 1; k >= 0; k--) {
      const from = addDays(today, -k);
      const name = WEEKDAYS[(parse(from).getDay() + 6) % 7];
      points.push({ from, to: from, label: k === 0 ? 'Oggi' : `${name[0].toUpperCase()}${name.slice(1)} ${fmtShort(from)}` });
    }
  }
  for (const p of points) {
    const list = sessions.filter((s) => s.date >= p.from && s.date <= p.to);
    p.seconds = sum(list, (s) => s.seconds);
    p.count = list.length;
  }
  return points;
}

/**
 * Gli obiettivi della settimana, esercizio per esercizio: il volume di una seduta per le volte a
 * settimana della routine. A tempo si contano i secondi (per lato, se l'esercizio ha due lati); a
 * ripetizioni le serie.
 */
export function weeklyGoals(routine, sessions, today) {
  if (!routine) return [];
  const week = sessionsThisWeek(sessions, today);
  return routine.exercises.map((ex) => {
    const items = week.flatMap((s) => s.items ?? []).filter((x) => nameKey(x.name) === nameKey(ex.name));
    const sides = ex.sides ? 2 : 1;
    if (ex.kind === 'time') {
      return { id: ex.id, name: ex.name, cat: ex.cat, unit: 'time', perSide: ex.sides, target: (workSeconds(ex) / sides) * routine.perWeek, have: sum(items, (x) => x.seconds) / sides };
    }
    return { id: ex.id, name: ex.name, cat: ex.cat, unit: 'sets', perSide: ex.sides, target: ex.sets * routine.perWeek, have: sum(items, (x) => x.sets) / sides };
  });
}

/** I carichi registrati, esercizio per esercizio, dal più recente: l'ultimo, quello prima, il più alto. */
export function loadHistory(sessions) {
  const map = new Map();
  for (const s of [...sessions].sort((a, b) => (a.at ?? 0) - (b.at ?? 0))) {
    for (const x of s.items ?? []) {
      if (x.load == null) continue;
      const k = nameKey(x.name);
      if (!map.has(k)) map.set(k, { name: x.name, cat: x.cat, points: [] });
      map.get(k).points.push({ date: s.date, load: x.load });
    }
  }
  return [...map.values()]
    .map((e) => ({ ...e, last: e.points.at(-1).load, prev: e.points.at(-2)?.load ?? null, best: Math.max(...e.points.map((p) => p.load)) }))
    .sort((a, b) => (a.points.at(-1).date < b.points.at(-1).date ? 1 : -1));
}

/** L'ultimo carico usato per un esercizio, o null. */
export function lastLoad(sessions, name) {
  return loadHistory(sessions).find((e) => nameKey(e.name) === nameKey(name))?.last ?? null;
}
