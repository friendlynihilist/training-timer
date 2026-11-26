// Il modello: una routine è una fila di esercizi (i blocchi), ognuno a tempo o a ripetizioni.
// Da qui escono i passi della sessione dal vivo, con le pause in mezzo, e le durate.

export const CATS = [
  { id: 'mobilita', name: 'Mobilità' },
  { id: 'allungamento', name: 'Allungamento' },
  { id: 'forza', name: 'Forza' },
  { id: 'attivazione', name: 'Attivazione' },
  { id: 'core', name: 'Core' },
  { id: 'cardio', name: 'Cardio' },
  { id: 'recupero', name: 'Recupero' },
  { id: 'altro', name: 'Altro' }
];
export const CAT = Object.fromEntries(CATS.map((c) => [c.id, c]));

/** A cosa serve una routine: lo si legge sempre sulla sua scheda, e nei progressi ha il suo colore. */
export const TYPES = [
  { id: 'mobilita', name: 'Mobilità' },
  { id: 'ipertrofia', name: 'Ipertrofia' },
  { id: 'altro', name: 'Altro' }
];
export const TYPE = Object.fromEntries(TYPES.map((t) => [t.id, t]));

export const SIDE = { sx: 'Sinistra', dx: 'Destra' };
/** Le tre fasi di una ripetizione a ritmo (4-2-4: quattro secondi a scendere, due fermo, quattro a salire). */
export const PHASES = ['Scendi', 'Tieni', 'Sali'];

/**
 * Le quattro fasi di un ciclo PNF (contrai, rilascia, vai più a fondo): è il modello da cui parte ogni
 * esercizio «a fasi». Nomi, secondi e indicazioni si cambiano poi esercizio per esercizio.
 */
export const PNF = [
  { name: 'Posizione', seconds: 10, cue: 'Entra nella posizione, fino a sentire tensione: 7 su 10.' },
  { name: 'Spingi', seconds: 6, cue: 'Contrai il muscolo che si allunga, senza muoverti: 60-70% della forza.' },
  { name: 'Tira', seconds: 5, cue: 'Rilascia e contrai il muscolo opposto, andando un po’ più a fondo.' },
  { name: 'Rilassa', seconds: 20, cue: 'Espira a fondo e resta nella nuova posizione.' }
];
export const pnfPhases = (cues = []) => PNF.map((p, i) => ({ ...p, cue: cues[i] ?? p.cue }));

/** Quanto dura, a occhio, una ripetizione senza ritmo: serve solo a stimare la durata. */
export const REP_SECONDS = 4;

/** Pausa fra un esercizio e l'altro (e fra le serie), cambio di lato, conto alla rovescia iniziale. */
export const DEFAULTS = { rest: 15, switchRest: 5, lead: 5 };

export function newId() {
  return globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36);
}

const int = (v, min, max, fallback) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

/** Un esercizio con tutti i campi a posto, qualunque cosa arrivi (un import, una copia vecchia). */
export function normalizeExercise(raw = {}) {
  const kind = raw.kind === 'reps' ? 'reps' : 'time';
  const tempo =
    kind === 'reps' && Array.isArray(raw.tempo) && raw.tempo.length === 3
      ? raw.tempo.map((n) => int(n, 0, 30, 0))
      : null;
  // Le fasi di un ciclo (solo a tempo): ognuna con nome, secondi e un'indicazione da leggere mentre la fai.
  const phases =
    kind === 'time' && Array.isArray(raw.phases) && raw.phases.length
      ? raw.phases.slice(0, 8).map((p, i) => ({ name: String(p?.name ?? '').trim() || `Fase ${i + 1}`, seconds: int(p?.seconds, 1, 600, 10), cue: String(p?.cue ?? '').trim() }))
      : null;
  const reps = int(raw.reps, 1, 500, 10);
  const repsMax = kind === 'reps' && raw.repsMax != null ? int(raw.repsMax, 1, 500, 0) : 0;
  const pause = (v) => (v == null || v === '' ? null : int(v, 0, 900, null));
  const block = String(raw.block ?? '').trim().slice(0, 40);
  return {
    id: raw.id || newId(),
    name: String(raw.name ?? '').trim() || 'Esercizio',
    cat: CAT[raw.cat] ? raw.cat : 'altro',
    kind,
    sets: int(raw.sets, 1, 50, 1),
    // Con le fasi, il ciclo dura quanto la loro somma.
    seconds: phases ? phases.reduce((a, p) => a + p.seconds, 0) : int(raw.seconds, 1, 3600, 30),
    phases,
    // A tempo: le serie si fanno staccate, con la pausa in mezzo, invece che di fila come i cicli.
    apart: kind === 'time' && Boolean(raw.apart),
    reps,
    // Una forbice di ripetizioni («6–10»): `reps` è il minimo, `repsMax` il massimo. Null se il numero è uno solo.
    repsMax: repsMax > reps && !tempo?.some((n) => n > 0) ? repsMax : null,
    tempo: tempo && tempo.some((n) => n > 0) ? tempo : null,
    sides: Boolean(raw.sides),
    load: String(raw.load ?? '').trim(),
    note: String(raw.note ?? '').trim(),
    // Come si fa l'esercizio: si legge prima di cominciarlo.
    how: String(raw.how ?? '').trim().slice(0, 800),
    // La pausa dopo ogni serie di questo esercizio; null = quella delle Impostazioni.
    rest: pause(raw.rest),
    // Il blocco della routine a cui appartiene («Riscaldamento», «Circuito A»). Gli esercizi vicini
    // con lo stesso blocco e `circuit` si alternano: una serie per uno a ogni giro, e a fine giro
    // la pausa `roundRest`.
    block,
    circuit: Boolean(raw.circuit) && Boolean(block),
    roundRest: pause(raw.roundRest)
  };
}

const MOBILITY = /mobil|stretch|allung|yoga|scioglim/i;
const HYPERTROPHY = /ipertrof|v-?shape|massa|bodybuilding|hypertroph/i;

/** A cosa serve una routine, se nessuno l'ha detto: dal nome, o dalle categorie dei suoi esercizi. */
export function guessType(raw = {}) {
  const name = String(raw.name ?? '');
  if (HYPERTROPHY.test(name)) return 'ipertrofia';
  if (MOBILITY.test(name)) return 'mobilita';
  const list = Array.isArray(raw.exercises) ? raw.exercises : [];
  const soft = list.filter((e) => ['mobilita', 'allungamento', 'attivazione', 'recupero'].includes(e.cat)).length;
  return list.length && soft * 2 > list.length ? 'mobilita' : 'altro';
}

export function normalizeRoutine(raw = {}) {
  return {
    id: raw.id || newId(),
    name: String(raw.name ?? '').trim() || 'Routine',
    type: TYPE[raw.type] ? raw.type : guessType(raw),
    perWeek: int(raw.perWeek, 1, 14, 3),
    // Le indicazioni che valgono per tutta la routine: attrezzatura, come progredire.
    note: String(raw.note ?? '').trim().slice(0, 1200),
    exercises: (Array.isArray(raw.exercises) ? raw.exercises : []).map(normalizeExercise)
  };
}

// ── Durate ─────────────────────────────────────────────────────────────────

/** Quanto dura un ciclo di un esercizio a tempo: la somma delle fasi, se ne ha. */
export function cycleSeconds(ex) {
  return ex.phases?.length ? ex.phases.reduce((a, p) => a + (Number(p.seconds) || 0), 0) : ex.seconds;
}

/** In che fase del ciclo sei dopo `t` secondi dal suo inizio, e quanto manca alla prossima. */
export function phaseAt(phases, t) {
  let end = 0;
  for (let index = 0; index < phases.length; index++) {
    end += phases[index].seconds;
    if (t < end || index === phases.length - 1) return { index, left: Math.max(0, end - t) };
  }
  return { index: 0, left: 0 };
}

/** Quanto dura una serie (o, negli esercizi a tempo, tutti i cicli di un lato). Stimata se non c'è un ritmo. */
export function setSeconds(ex) {
  if (ex.kind === 'time') return ex.sets * cycleSeconds(ex);
  const rep = ex.tempo ? ex.tempo.reduce((a, b) => a + b, 0) : REP_SECONDS;
  // Con una forbice si stima a metà strada.
  return Math.round(((ex.reps + (ex.repsMax ?? ex.reps)) / 2) * rep);
}

/** Il lavoro di un esercizio, senza pause: è il «volume per seduta». */
export function workSeconds(ex) {
  const sides = ex.sides ? 2 : 1;
  return ex.kind === 'time' ? setSeconds(ex) * sides : setSeconds(ex) * ex.sets * sides;
}

// ── I passi della sessione ─────────────────────────────────────────────────

/**
 * La routine distesa in passi: lavoro e pause, nell'ordine in cui si fanno.
 *   lavoro: { kind: 'work', mode: 'time' | 'tempo' | 'manual', ex, side, set, sets, seconds, est, … }
 *   pausa:  { kind: 'rest', why: 'lead' | 'rest' | 'side', label, seconds, ex }
 * `ex` è la posizione dell'esercizio nella routine (per le pause, quello che viene dopo).
 * `seconds` è null nei passi che finiscono quando lo dici tu (ripetizioni senza ritmo); `est` c'è sempre.
 */
export function expand(routine, opts = DEFAULTS) {
  const { rest, switchRest, lead } = { ...DEFAULTS, ...opts };
  const exs = routine.exercises;

  // Prima le «unità»: una serie di un esercizio (o tutti i suoi cicli, se si fanno di fila), con la
  // pausa che la segue. In un circuito le serie degli esercizi del blocco si alternano, giro per giro.
  const units = [];
  for (let i = 0; i < exs.length; ) {
    const ex = exs[i];
    if (ex.circuit) {
      let j = i;
      while (j < exs.length && exs[j].circuit && exs[j].block === ex.block) j++;
      const rounds = Math.max(...exs.slice(i, j).map((e) => e.sets));
      for (let round = 1; round <= rounds; round++) {
        const turn = [];
        for (let k = i; k < j; k++) if (exs[k].sets >= round) turn.push({ i: k, set: round, sets: exs[k].sets, round, rounds, single: true, after: exs[k].rest ?? rest, label: 'Pausa' });
        const end = turn.at(-1);
        end.after = ex.roundRest ?? end.after;
        if (round < rounds) end.label = `Fine del giro ${round}`;
        units.push(...turn);
      }
      i = j;
      continue;
    }
    const after = ex.rest ?? rest;
    if (ex.kind === 'time' && !ex.apart) units.push({ i, set: 1, sets: 1, after, label: 'Pausa' });
    else for (let set = 1; set <= ex.sets; set++) units.push({ i, set, sets: ex.sets, single: true, after, label: 'Pausa' });
    i++;
  }

  const steps = [];
  const pause = (why, label, seconds, ex) => {
    if (seconds > 0) steps.push({ kind: 'rest', why, label, seconds, ex });
  };
  units.forEach((u, n) => {
    const ex = exs[u.i];
    if (n === 0) pause('lead', 'Preparati', lead, u.i);
    else pause('rest', units[n - 1].label, units[n - 1].after, u.i);
    const round = u.rounds ? { round: u.round, rounds: u.rounds } : {};
    (ex.sides ? ['sx', 'dx'] : [null]).forEach((side, k) => {
      if (k > 0) pause('side', 'Cambia lato', switchRest, u.i);
      if (ex.kind === 'time') {
        const cycle = cycleSeconds(ex);
        const cycles = u.single ? 1 : ex.sets;
        const seconds = cycles * cycle;
        steps.push({ kind: 'work', mode: 'time', ex: u.i, side, set: u.set, sets: u.sets, cycles, cycle, phases: ex.phases?.length ? ex.phases : null, seconds, est: seconds, ...round });
        return;
      }
      const est = setSeconds(ex);
      steps.push({ kind: 'work', mode: ex.tempo ? 'tempo' : 'manual', ex: u.i, side, set: u.set, sets: u.sets, reps: ex.reps, repsMax: ex.repsMax, tempo: ex.tempo, seconds: ex.tempo ? est : null, est, ...round });
    });
  });
  return steps.map((s, id) => ({ id, ...s }));
}

const sum = (list, f) => list.reduce((a, x) => a + f(x), 0);

/** Quanto dura la routine, pause comprese. */
export function routineSeconds(routine, opts = DEFAULTS) {
  return sum(expand(routine, opts), (s) => s.seconds ?? s.est);
}

/** Quanto dura ogni esercizio con le sue pause interne (cambio di lato, pausa fra le serie). */
export function exerciseSpans(routine, opts = DEFAULTS) {
  const spans = routine.exercises.map(() => 0);
  let last = -1; // l'esercizio dell'ultimo passo di lavoro: una pausa è «dentro» se viene dopo un suo passo
  for (const s of expand(routine, opts)) {
    if (s.kind === 'work' || last === s.ex) spans[s.ex] += s.seconds ?? s.est;
    if (s.kind === 'work') last = s.ex;
  }
  return spans;
}

/**
 * Com'è andata, esercizio per esercizio: `spent` sono i secondi passati su ogni passo,
 * `done` i passi portati fino in fondo. Gli esercizi nemmeno cominciati non compaiono.
 */
export function summarize(exercises, steps, spent = {}, done = {}, loads = {}, reps = {}) {
  return exercises
    .map((ex, i) => {
      const works = steps.filter((s) => s.kind === 'work' && s.ex === i);
      const finished = works.filter((s) => done[s.id]);
      // Le ripetizioni di ogni serie finita: quelle segnate, o quelle previste.
      const each = ex.kind === 'reps' ? finished.map((s) => Number(reps[s.id] ?? ex.reps)) : [];
      const item = {
        name: ex.name,
        cat: ex.cat,
        kind: ex.kind,
        sides: ex.sides,
        seconds: Math.round(sum(works, (s) => spent[s.id] ?? 0)),
        sets: finished.length,
        of: works.length,
        reps: sum(each, (n) => n),
        load: ex.load && loads[i] != null && finished.length ? Number(loads[i]) : null
      };
      // Con una forbice restano anche le ripetizioni serie per serie, e la forbice di quel giorno.
      if (ex.repsMax && each.length) Object.assign(item, { each, range: [ex.reps, ex.repsMax] });
      return item;
    })
    .filter((x) => x.seconds > 0 || x.sets > 0);
}

/** Quanto tempo può contare un passo: tutto il suo, o (senza ritmo) fino a quattro volte la stima. */
export const stepCap = (s) => s.seconds ?? Math.max(120, s.est * 4);

/**
 * La voce di diario di una sessione, finita o lasciata a metà: conta quello che è stato fatto, nel
 * giorno della sessione. Null se non c'è niente da contare.
 */
export function sessionOf(draft) {
  const spent = { ...draft.spent };
  // Il passo lasciato a metà conta per il tempo che ci hai passato.
  const s = draft.steps[draft.i];
  if (s?.kind === 'work' && !draft.done?.[s.id]) {
    const t = (draft.acc ?? 0) + (draft.since ? Math.max(0, ((draft.beat ?? draft.since) - draft.since) / 1000) : 0);
    if (t >= 1) spent[s.id] = Math.max(spent[s.id] ?? 0, Math.min(t, stepCap(s)));
  }
  const items = summarize(draft.exercises, draft.steps, spent, draft.done, draft.loads, draft.reps);
  if (!items.length) return null;
  const seconds = sum(items, (x) => x.seconds);
  return {
    date: draft.date,
    routineId: draft.routineId,
    name: draft.name,
    type: draft.type ?? 'altro',
    // `seconds` è il lavoro; `total` è la seduta com'è durata, pause comprese.
    seconds,
    total: seconds + Math.round(draft.rested ?? 0),
    items,
    feel: draft.feel ?? null,
    note: String(draft.note ?? '').trim()
  };
}

/**
 * Una seduta scritta a mano nel diario (fatta senza l'app, o andata persa): gli esercizi scelti
 * contano per il loro volume intero, la durata è quella che dici tu. Le ripetizioni delle forbici
 * non si inventano: restano solo quelle segnate dal vivo.
 */
export function manualSession(routine, picks, { date, minutes, note = '', opts = DEFAULTS } = {}) {
  const steps = expand(routine, opts);
  const works = steps.filter((s) => s.kind === 'work' && picks.includes(s.ex));
  const session = sessionOf({
    date,
    routineId: routine.id,
    name: routine.name,
    type: routine.type,
    exercises: routine.exercises,
    steps,
    i: steps.length,
    spent: Object.fromEntries(works.map((s) => [s.id, s.seconds ?? s.est])),
    done: Object.fromEntries(works.map((s) => [s.id, true])),
    note
  });
  if (!session) return null;
  const total = Math.max(60, Math.round(minutes * 60));
  return { ...session, seconds: Math.min(session.seconds, total), total, manual: true, items: session.items.map(({ each, range, ...x }) => x) };
}

// ── Testi ──────────────────────────────────────────────────────────────────

/** 3:20, per il tempo che scorre. */
export function fmtClock(sec) {
  const s = Math.max(0, Math.ceil(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Una durata da leggere: «40 s», «1 min», «3:20». */
export function fmtDur(sec) {
  const s = Math.round(sec);
  if (s < 60) return `${s} s`;
  if (s % 60 === 0) return `${s / 60} min`;
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export const minutesOf = (sec) => Math.max(1, Math.round(sec / 60));

/** Le ripetizioni di una serie: «8», oppure la forbice «6–10». */
export const repsText = (ex) => (ex.repsMax ? `${ex.reps}–${ex.repsMax}` : String(ex.reps));

/**
 * Il volume di un esercizio in una riga: «5 cicli da 41 s per lato · 4 fasi», «3 × 5 · ritmo 4-2-4 ·
 * 2–4 kg», «4 × 6–10», «2 × 30 s» (serie staccate).
 */
export function volumeText(ex) {
  const side = ex.sides ? ' per lato' : '';
  if (ex.kind === 'time') {
    const cycle = cycleSeconds(ex);
    const split = ex.apart || ex.circuit;
    const text = (ex.sets > 1 ? (split ? `${ex.sets} × ${fmtDur(cycle)}` : `${ex.sets} cicli da ${fmtDur(cycle)}`) : fmtDur(cycle)) + side;
    return ex.phases?.length ? `${text} · ${ex.phases.length} fasi` : text;
  }
  const parts = [`${ex.sets} × ${repsText(ex)}${side}`];
  if (ex.tempo) parts.push(`ritmo ${ex.tempo.join('-')}`);
  if (ex.load) parts.push(ex.load);
  return parts.join(' · ');
}

/**
 * I blocchi di una routine, per mostrarla a pezzi: ogni blocco ha il nome (vuoto se non ne ha), gli
 * indici dei suoi esercizi e, se è un circuito, i giri.
 */
export function blocksOf(routine) {
  const out = [];
  routine.exercises.forEach((ex, i) => {
    const last = out.at(-1);
    if (last && last.name === ex.block && last.circuit === ex.circuit) last.items.push(i);
    else out.push({ name: ex.block, circuit: ex.circuit, items: [i] });
  });
  for (const b of out) if (b.circuit) b.rounds = Math.max(...b.items.map((i) => routine.exercises[i].sets));
  return out;
}

/** Gli esercizi si riconoscono dal nome, anche fra routine diverse. */
export const nameKey = (name) => String(name).trim().toLowerCase();

/** Una durata in due pezzi, numero grande e unità piccola: 40 + «sec», 3:20 + «min». */
export function durParts(sec) {
  const s = Math.round(sec);
  if (s < 60) return { time: String(s), unit: 'sec' };
  return { time: s % 60 === 0 ? String(s / 60) : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`, unit: 'min' };
}
