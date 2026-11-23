// Date come stringhe AAAA-MM-GG, nel fuso del dispositivo.

const pad = (n) => String(n).padStart(2, '0');

export const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayISO = () => iso(new Date());

/** A mezzogiorno, così i cambi d'ora non spostano il giorno. */
export function parse(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
}

export function addDays(s, n) {
  const d = parse(s);
  d.setDate(d.getDate() + n);
  return iso(d);
}

export function mondayOf(s) {
  return addDays(s, -((parse(s).getDay() + 6) % 7));
}

export const WEEKDAYS_MIN = ['L', 'M', 'M', 'G', 'V', 'S', 'D'];
export const WEEKDAYS = ['lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato', 'domenica'];

const long = new Intl.DateTimeFormat('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
const short = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short' });
const month = new Intl.DateTimeFormat('it-IT', { month: 'long', year: 'numeric' });

export const fmtLong = (s) => long.format(parse(s));
export const fmtShort = (s) => short.format(parse(s)).replace('.', '');
export const fmtMonth = (y, m) => month.format(new Date(y, m, 1, 12));

export function fmtRelative(s, today = todayISO()) {
  if (s === today) return 'oggi';
  if (s === addDays(today, -1)) return 'ieri';
  return fmtShort(s);
}
