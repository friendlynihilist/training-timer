// I progressi: settimane di fila, tempo allenato, andamento, obiettivi della settimana, carichi.

import { addDays, mondayOf, WEEKDAYS } from './dates.js';
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
  return { seconds: sum(sessions, (s) => s.seconds), count: sessions.length, days: new Set(sessions.map((s) => s.date)).size };
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
 * I tre periodi del grafico dell'andamento, dal più stretto al più largo: una settimana e un mese
 * si guardano giorno per giorno, tre mesi settimana per settimana.
 */
export const PERIODS = [
  { id: 'settimana', unit: 'day', n: 7 },
  { id: 'mese', unit: 'day', n: 30 },
  { id: 'tre-mesi', unit: 'week', n: 13 }
];

/** I minuti da mostrare: arrotondati, ma mai zero se hai fatto qualcosa. */
export const minutes = (seconds) => (seconds > 0 ? Math.max(1, Math.round(seconds / 60)) : 0);

/**
 * Il lavoro degli ultimi `n` giorni (`unit` 'day') o delle ultime `n` settimane, da lunedì a
 * domenica (`unit` 'week'), il più recente in fondo. Conta tutto quello che è nel diario, sedute
 * intere e pezzi: ogni punto ha `from` e `to` (date comprese), `seconds`, `minutes`, `count` (le
 * sedute) e `days` (i giorni in cui ti sei allenato).
 */
export function activity(sessions, unit, n, today) {
  const out = [];
  for (let k = n - 1; k >= 0; k--) {
    const from = unit === 'day' ? addDays(today, -k) : addDays(mondayOf(today), -7 * k);
    out.push({ from, to: unit === 'day' ? from : addDays(from, 6), seconds: 0, count: 0, dates: new Set() });
  }
  for (const s of sessions) {
    const p = out.find((x) => s.date >= x.from && s.date <= x.to);
    if (!p) continue;
    p.seconds += s.seconds;
    p.count++;
    p.dates.add(s.date);
  }
  return out.map(({ dates, ...p }) => ({ ...p, minutes: minutes(p.seconds), days: dates.size }));
}

/** In quanti giorni di questa settimana ti sei allenato. */
export function daysThisWeek(sessions, today) {
  return new Set(sessionsThisWeek(sessions, today).map((s) => s.date)).size;
}

/**
 * Da dove riprendere una routine fatta a pezzi (oggi la parte bassa, domani l'alta): l'indice del
 * primo esercizio dopo l'ultimo finito nell'ultima seduta di questa routine, se è degli ultimi sette
 * giorni. Null se l'ultima volta sei arrivato in fondo, o se non c'è niente da riprendere.
 */
export function resumePoint(routine, sessions, today) {
  if (!routine) return null;
  const since = addDays(today, -6);
  const last = sessions.filter((s) => s.routineId === routine.id && s.date >= since).sort((a, b) => (a.at ?? 0) - (b.at ?? 0)).at(-1);
  if (!last) return null;
  const finished = new Set((last.items ?? []).filter((x) => x.sets >= (x.of ?? 1)).map((x) => nameKey(x.name)));
  const at = routine.exercises.findLastIndex((e) => finished.has(nameKey(e.name)));
  return at >= 0 && at < routine.exercises.length - 1 ? at + 1 : null;
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
