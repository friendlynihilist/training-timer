// Importa una routine da un testo incollato (una tabella copiata da un foglio o da una chat, un elenco
// con una riga per esercizio) o da un file JSON esportato dall'app.
//
// Il volume di ogni esercizio si scrive come viene naturale:
//   2 x 8 rep lente            due serie da otto ripetizioni
//   3 x 5 (4-2-4), 2–4 kg      tre serie da cinque, a ritmo, con un carico
//   5 cicli (3:20)             cinque cicli, 3:20 in tutto: 40 secondi l'uno
//   5 cicli da 40 s per lato   lo stesso, per ogni lato
//   5 cicli PNF                cinque cicli a fasi: posizione, spingi, tira, rilassa
//   1 min per lato             un minuto a sinistra e uno a destra
//   3 x 30 s                   tre cicli da 30 secondi, di fila
//   2 serie x 30 secondi       due serie da 30 secondi, con la pausa in mezzo
//   6-10 ripetizioni           una forbice: a ogni serie si segna quante se ne fanno
//
// Si legge anche una scheda scritta a blocchi, come le scrive un allenatore o una chat:
//   Nome: Circuito al parchetto
//   Frequenza: 2 volte a settimana
//   BLOCCO 2: Circuito A (4 giri)
//   Recupero: 60 secondi tra un esercizio e l'altro, 90 secondi a fine giro.
//   4. Trazioni presa prona
//      - 6-10 ripetizioni
//      - Spiegazione: palmi in avanti…

import { normalizeExercise, normalizeRoutine, workSeconds, pnfPhases, TYPES } from './model.js';

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

  // «2 serie x 30 secondi»: dette «serie», quelle a tempo si fanno staccate, con la pausa in mezzo.
  const series = /\b(?:serie|sets?)\b/i.test(t);
  t = t.replace(/(\d+)\s*(?:serie|sets?)\s*(?:x|da|di)?\s*(?=\d)/i, '$1 x ');

  // Una forbice, «6-10 ripetizioni» o «30-45 secondi»: a ripetizioni restano minimo e massimo, a
  // tempo vale il massimo (e la forbice resta scritta nella nota).
  const range = t.match(/(\d+)\s*[–-]\s*(\d+)/);
  if (range && Number(range[2]) > Number(range[1])) {
    const timed = new RegExp(`^\\s*${TIME_UNIT}(?![a-z])`, 'i').test(t.slice(range.index + range[0].length));
    t = t.replace(range[0], timed ? range[2] : range[1]);
    if (timed) out.note = `${range[1]}–${range[2]} s`;
    else out.repsMax = Number(range[2]);
  }

  const low = t.toLowerCase();
  let m;

  // «5 cicli (3:20)»: il tempo fra parentesi è il totale. «5 cicli da 40 s»: è quello di un ciclo.
  if ((m = low.match(/(\d+)\s*(?:cicl[io]|giri|round|rounds|volte)/))) {
    const sets = Number(m[1]);
    // «PNF»: ogni ciclo ha le sue quattro fasi, e dura quanto la loro somma.
    if (/\bpnf\b/.test(low)) return { ...out, kind: 'time', sets, phases: pnfPhases(), tempo: undefined };
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
    if (timed) return { ...out, kind: 'time', sets, apart: series, seconds: parseDuration(m[2] + (m[3] ?? '')) ?? 30, tempo: undefined };
    return { ...out, kind: 'reps', sets, reps: Number(m[2]), note: noteOf(low.replace(m[0], ' ')) };
  }

  // Solo una durata: «1 min», «45 s», «3:20».
  const seconds = parseDuration(low);
  if (seconds != null) return { ...out, kind: 'time', sets: 1, seconds, tempo: undefined };

  // Solo le ripetizioni: «10 rep», «12 ripetizioni».
  if ((m = low.match(/(\d+)\s*(?:rep|rip)[a-z]*/)) || (m = low.match(/^\D*(\d+)\D*$/))) {
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

// ── La scheda a blocchi ────────────────────────────────────────────────────

const BLOCK = /^(?:blocco|block|parte)\s*\d*\s*[:.–-]\s*(.+)$/i;
const FIELD = /^(nome|frequenza|durata(?:\s+stimata)?|attrezzatura|tipo|obiettivo|note(?:\s+generali)?)\s*:\s*(.*)$/i;
const REST = /^(?:recuper[oi]|pausa|riposo)\s*:\s*(.*)$/i;
const HOW = /^(?:spiegazione|descrizione|esecuzione|come si fa)\s*:\s*(.*)$/i;
const BULLET = /^[-•*]\s*(.+)$/;
const NUMBERED = /^\d+[.)]\s+(.+)$/;

/** È una scheda a blocchi? Basta un «BLOCCO 1:» o una «Spiegazione:» sotto un esercizio. */
const isOutline = (text) => /^\s*(?:blocco|block)\s*\d*\s*[:.–-]/im.test(text) || /^\s*[-•*]\s*(?:spiegazione|descrizione)\s*:/im.test(text);

/** «45-60 secondi» → 45: di una forbice di recupero si prende il minimo. */
const restSeconds = (text) => parseDuration(text.replace(/(\d+)\s*[–-]\s*\d+/, '$1'));
const capital = (t) => t.charAt(0).toUpperCase() + t.slice(1);

function parseOutline(text, fallbackName) {
  const exercises = [];
  const skipped = [];
  const notes = [];
  let name = '';
  let perWeek = null;
  let type = null;
  let block = null; // { name, circuit, rounds, rest, roundRest }
  let ex = null;
  let inNotes = false;

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    let m;

    if ((m = line.match(BLOCK))) {
      const rounds = m[1].match(/(\d+)\s*gir[io]/i);
      const title = m[1].replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
      block = { name: title, circuit: Boolean(rounds) || /circuit/i.test(title), rounds: rounds ? Number(rounds[1]) : null, rest: null, roundRest: null };
      ex = null;
      inNotes = false;
      continue;
    }
    if ((m = line.match(FIELD))) {
      const [field, value] = [m[1].toLowerCase(), m[2].trim()];
      inNotes = field.startsWith('note');
      if (field === 'nome') name = value;
      else if (field === 'frequenza') {
        const n = value.match(/(\d+)\s*(?:volt[ae]|x|giorni)/i);
        if (n) perWeek = Number(n[1]);
        notes.push(capital(value));
      } else if (field === 'tipo' || field === 'obiettivo') type = TYPES.find((t) => value.toLowerCase().includes(t.name.toLowerCase()) || value.toLowerCase().includes(t.id))?.id ?? null;
      else if (field.startsWith('durata')) notes.push(`Durata: ${value}`);
      else if (field === 'attrezzatura') notes.push(`Attrezzatura: ${value}`);
      else if (value) notes.push(value);
      ex = null;
      continue;
    }
    if (block && !ex?.volume && (m = line.match(REST))) {
      for (const part of m[1].split(/[,;]/)) {
        const sec = restSeconds(part);
        if (sec == null) continue;
        if (/fine\s+(?:del\s+)?giro|tra\s+(?:un\s+giro|i\s+giri)/i.test(part)) block.roundRest = sec;
        else block.rest = sec;
      }
      continue;
    }
    if ((m = line.match(NUMBERED))) {
      // Il volume può stare sulla stessa riga del nome («4. Squat 3x10») o nelle righe sotto.
      const [title, volume] = cells(m[1]);
      ex = { name: title, volume: volume ? parseVolume(volume) : null, how: '', notes: [], block };
      exercises.push(ex);
      inNotes = false;
      continue;
    }
    if ((m = line.match(BULLET))) {
      const item = m[1].trim();
      if (inNotes && !ex) notes.push(item);
      else if (!ex) skipped.push(line);
      else if ((m = item.match(HOW))) ex.how = capital(m[1].trim());
      else if ((m = item.match(REST))) ex.rest = restSeconds(m[1]);
      else if (!ex.volume && (ex.volume = parseVolume(item))) continue;
      else ex.notes.push(item);
      continue;
    }
    // Le intestazioni tutte maiuscole («DATI DEL WORKOUT») non dicono niente; il resto si segnala.
    if (line !== line.toUpperCase()) skipped.push(line);
  }

  const done = [];
  for (const e of exercises) {
    if (!e.volume) {
      skipped.push(e.name);
      continue;
    }
    const b = e.block;
    const kind = e.volume.kind;
    done.push(
      normalizeExercise({
        ...e.volume,
        name: e.name,
        cat: guessCat(e.name, kind),
        how: e.how,
        note: [e.volume.note, ...e.notes].filter(Boolean).join(' · '),
        block: b?.name ?? '',
        // In un circuito ogni esercizio fa una serie per giro.
        ...(b?.circuit ? { circuit: true, sets: b.rounds ?? e.volume.sets, roundRest: b.roundRest } : {}),
        rest: e.rest ?? b?.rest ?? null
      })
    );
  }
  if (!done.length) return { routine: null, skipped };
  return { routine: normalizeRoutine({ name: name || fallbackName, type, perWeek: perWeek ?? 3, note: notes.join('\n'), exercises: done }), skipped };
}

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

  if (isOutline(text)) return parseOutline(text, fallbackName);

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
  const { name, type, perWeek, note, exercises } = routine;
  return { app: 'training-timer', version: 1, routine: { name, type, perWeek, note, exercises: exercises.map(({ id, ...e }) => e) } };
}
