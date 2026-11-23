// Importa una routine da un testo incollato (una tabella copiata da un foglio o da una chat, un elenco
// con una riga per esercizio) o da un file JSON esportato dall'app.
//
// Il volume di ogni esercizio si scrive come viene naturale:
//   2 x 8 rep lente            due serie da otto ripetizioni
//   3 x 5 (4-2-4), 2–4 kg      tre serie da cinque, a ritmo, con un carico
//   5 cicli (3:20)             cinque cicli, 3:20 in tutto: 40 secondi l'uno
//   5 cicli da 40 s per lato   lo stesso, per ogni lato
//   1 min per lato             un minuto a sinistra e uno a destra
//   3 x 30 s                   tre cicli da 30 secondi

import { normalizeExercise, normalizeRoutine, workSeconds } from './model.js';

const SIDES = /\b(?:per|a|ogni|each|per\s+ogni)\s+(?:lato|gamba|braccio|parte|side|leg|arm)\b|\/\s*lato\b/i;
const TIME_UNIT = '(min(?:ut[oi])?|m|′|\'|s(?:ec(?:ond[oi])?)?|″|"|\'\')';

/** «3:20», «1 min», «40 s», «1 min 30 s» in secondi; null se non è una durata. */
export function parseDuration(text) {
  const t = String(text).trim().toLowerCase();
  let m = t.match(/(\d+):(\d{2})/);
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  let total = 0;
  let found = false;
  const re = new RegExp(`(\\d+(?:[.,]\\d+)?)\\s*${TIME_UNIT}(?![a-z])`, 'g');
  while ((m = re.exec(t))) {
    const n = Number(m[1].replace(',', '.'));
    total += /^(min|m$|′|'$)/.test(m[2]) && !/^(''|″)/.test(m[2]) ? n * 60 : n;
    found = true;
  }
  return found ? Math.round(total) : null;
}

/** Il volume scritto a parole diventa i campi dell'esercizio; null se non si capisce. */
export function parseVolume(text) {
  let t = String(text ?? '')
    .replace(/[×✕*]/g, 'x')
    .replace(/[’`]/g, "'")
    .trim();
  if (!t) return null;
  const out = { sides: SIDES.test(t) };
  t = t.replace(new RegExp(SIDES.source, 'gi'), ' ');

  // Il ritmo: tre numeri con i trattini, «(4-2-4)» o «ritmo 4-2-4».
  const tempo = t.match(/(?:tempo|ritmo)?\s*\(?\b(\d{1,2})\s*-\s*(\d{1,2})\s*-\s*(\d{1,2})\b\)?/i);
  if (tempo) {
    out.tempo = tempo.slice(1, 4).map(Number);
    t = t.replace(tempo[0], ' ');
  }

  // Il carico: «2–4 kg», «5 kg», «10 lb».
  const load = t.match(/(\d+(?:[.,]\d+)?)(?:\s*[–-]\s*(\d+(?:[.,]\d+)?))?\s*(kg|lb)\b/i);
  if (load) {
    out.load = `${load[1]}${load[2] ? `–${load[2]}` : ''} ${load[3].toLowerCase()}`;
    t = t.replace(load[0], ' ');
  }

  const low = t.toLowerCase();
  let m;

  // «5 cicli (3:20)»: il tempo fra parentesi è il totale. «5 cicli da 40 s»: è quello di un ciclo.
  if ((m = low.match(/(\d+)\s*(?:cicl[io]|giri|round|rounds|volte)/))) {
    const sets = Number(m[1]);
    const rest = low.replace(m[0], ' ');
    const inPar = rest.match(/\(([^)]*)\)/);
    const total = inPar ? parseDuration(inPar[1]) : null;
    const each = total == null ? parseDuration(rest) : null;
    return { ...out, kind: 'time', sets, seconds: total != null ? Math.max(1, Math.round(total / sets)) : (each ?? 30), tempo: undefined };
  }

  // «3 x 30 s» (a tempo) oppure «2 x 8» (ripetizioni).
  if ((m = low.match(new RegExp(`(\\d+)\\s*x\\s*(\\d+(?::\\d{2})?)\\s*${TIME_UNIT}?(?![a-z])`)))) {
    const sets = Number(m[1]);
    const timed = m[3] || m[2].includes(':');
    if (timed) return { ...out, kind: 'time', sets, seconds: parseDuration(m[2] + (m[3] ?? '')) ?? 30, tempo: undefined };
    return { ...out, kind: 'reps', sets, reps: Number(m[2]), note: noteOf(low.replace(m[0], ' ')) };
  }

  // Solo una durata: «1 min», «45 s», «3:20».
  const seconds = parseDuration(low);
  if (seconds != null) return { ...out, kind: 'time', sets: 1, seconds, tempo: undefined };

  // Solo le ripetizioni: «10 rep», «12 ripetizioni».
  if ((m = low.match(/(\d+)\s*(?:rep|rip)/)) || (m = low.match(/^\D*(\d+)\D*$/))) {
    return { ...out, kind: 'reps', sets: 1, reps: Number(m[1]), note: noteOf(low.replace(m[0], ' ')) };
  }
  return null;
}

// Quello che resta dopo i numeri («rep lente» → «lente») è una nota per chi si allena.
function noteOf(rest) {
  return rest
    .replace(/\b(?:rep(?:s|etitions)?|rip(?:etizioni)?|serie|set|sets)\b/g, ' ')
    .replace(/[(),;·]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const GUESS = [
  ['allungamento', /stretch|allung|apertura|stipite|butcher|piccione|pigeon|pancake|spaccat|split/i],
  ['attivazione', /lift[- ]?off|attiv|bridge|ponte|clamshell|band|elastico/i],
  ['forza', /curl|squat|push|press|deadlift|stacco|row|pull|trazion|piegament|affond|lunge/i],
  ['core', /plank|hollow|crunch|addominal|dead ?bug|bird ?dog/i],
  ['mobilita', /switch|open book|rotaz|mobil|cat|circ|90\/90|cars\b/i],
  ['cardio', /corsa|run|jump|salt|burpee|skip|corda/i],
  ['recupero', /respir|breath|rilass|savasana/i]
];

/** La categoria si indovina dal nome; se no, gli esercizi a tempo sono allungamenti e gli altri forza. */
export function guessCat(name, kind) {
  return GUESS.find(([, re]) => re.test(name))?.[0] ?? (kind === 'time' ? 'allungamento' : 'forza');
}

function cells(line) {
  let parts;
  if (line.includes('\t')) parts = line.split('\t');
  else if (line.includes('|')) parts = line.split('|');
  else if (line.includes(';')) parts = line.split(';');
  else parts = line.split(/\s{2,}/);
  parts = parts.map((c) => c.trim()).filter((c, i, all) => c || (i > 0 && i < all.length - 1));
  // Una riga sola, senza colonne: «Frog Stretch: 5 cicli (3:20)», «Squat 3x10», «- Plank – 45 s».
  if (parts.length === 1) {
    const text = parts[0].replace(/^\s*(?:[-•*]|\d+[.)])\s+/, '');
    const m = text.match(/^(.*?)\s*(?:[:–—]|\s-\s)\s*(\d.*)$/) ?? text.match(/^(\D*?[a-zà-ù)])\s+(\d.*)$/i);
    if (m) return [m[1].trim(), m[2].trim()];
    return [text];
  }
  return parts;
}

const HEADER = /^(?:esercizi[oa]?|exercise|nome|name|volume|#|n\.?|totale)/i;

/**
 * Un testo incollato diventa una routine.
 * @returns {{ routine: object | null, skipped: string[] }} le righe non capite stanno in `skipped`.
 */
export function parseRoutine(input, fallbackName = 'Routine importata') {
  const text = String(input ?? '').trim();
  if (!text) return { routine: null, skipped: [] };

  if (text[0] === '{' || text[0] === '[') {
    try {
      const data = JSON.parse(text);
      const raw = Array.isArray(data) ? { exercises: data } : (data.routine ?? data.routines?.[0] ?? data);
      if (!Array.isArray(raw?.exercises) || !raw.exercises.length) return { routine: null, skipped: ['Nel file non c’è una routine'] };
      // Chi importa riceve una copia: gli identificativi si rifanno.
      return { routine: normalizeRoutine({ ...raw, id: null, name: raw.name || fallbackName, exercises: raw.exercises.map((e) => ({ ...e, id: null })) }), skipped: [] };
    } catch {
      return { routine: null, skipped: ['Il file non si legge: non è un JSON valido'] };
    }
  }

  const exercises = [];
  const skipped = [];
  let name = '';
  let perWeek = null;

  for (const line of text.split(/\r?\n/)) {
    if (!line.trim() || /^[\s|:-]+$/.test(line)) continue;
    let row = cells(line);
    // La prima colonna, se è solo un numero, è la posizione.
    if (row.length > 1 && /^\d+[.)]?$/.test(row[0])) row = row.slice(1);
    if (row.every((c) => HEADER.test(c))) continue;
    const [title, volume, weekly] = row;
    const parsed = volume ? parseVolume(volume) : null;
    if (!title || !parsed) {
      // Un titolo da solo, prima di tutti gli esercizi, è il nome della routine.
      if (!exercises.length && !name && row.length === 1 && !/\d/.test(title) && !HEADER.test(title)) name = title.replace(/^#+\s*/, '');
      else skipped.push(line.trim());
      continue;
    }
    const ex = normalizeExercise({ ...parsed, name: title, cat: guessCat(title, parsed.kind) });
    exercises.push(ex);

    // «Totale settimanale 10 min» con 3:20 a seduta: tre volte a settimana.
    if (perWeek == null && weekly && ex.kind === 'time') {
      const week = parseDuration(weekly);
      const once = SIDES.test(weekly) ? workSeconds(ex) / (ex.sides ? 2 : 1) : workSeconds(ex);
      const n = week ? Math.round(week / once) : 0;
      if (n >= 1 && n <= 14) perWeek = n;
    }
  }

  if (!exercises.length) return { routine: null, skipped };
  return { routine: normalizeRoutine({ name: name || fallbackName, perWeek: perWeek ?? 3, exercises }), skipped };
}

/** La routine come file da condividere: la stessa forma che `parseRoutine` rilegge. */
export function exportRoutine(routine) {
  const { name, perWeek, exercises } = routine;
  return { app: 'training-timer', version: 1, routine: { name, perWeek, exercises: exercises.map(({ id, ...e }) => e) } };
}
