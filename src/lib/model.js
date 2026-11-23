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
  return {
    id: raw.id || newId(),
    name: String(raw.name ?? '').trim() || 'Esercizio',
    cat: CAT[raw.cat] ? raw.cat : 'altro',
    kind,
    sets: int(raw.sets, 1, 50, 1),
    // Con le fasi, il ciclo dura quanto la loro somma.
    seconds: phases ? phases.reduce((a, p) => a + p.seconds, 0) : int(raw.seconds, 1, 3600, 30),
    phases,
    reps: int(raw.reps, 1, 500, 10),
    tempo: tempo && tempo.some((n) => n > 0) ? tempo : null,
    sides: Boolean(raw.sides),
    load: String(raw.load ?? '').trim(),
    note: String(raw.note ?? '').trim()
  };
}

export function normalizeRoutine(raw = {}) {
  return {
    id: raw.id || newId(),
    name: String(raw.name ?? '').trim() || 'Routine',
    perWeek: int(raw.perWeek, 1, 14, 3),
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
  return ex.reps * rep;
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
  const steps = [];
  const pause = (why, label, seconds, ex) => {
    if (seconds > 0) steps.push({ kind: 'rest', why, label, seconds, ex });
  };

  routine.exercises.forEach((ex, i) => {
    if (i === 0) pause('lead', 'Preparati', lead, i);
    else pause('rest', 'Pausa', rest, i);
    const sides = ex.sides ? ['sx', 'dx'] : [null];

    if (ex.kind === 'time') {
      sides.forEach((side, k) => {
        if (k > 0) pause('side', 'Cambia lato', switchRest, i);
        const cycle = cycleSeconds(ex);
        const seconds = ex.sets * cycle;
        steps.push({ kind: 'work', mode: 'time', ex: i, side, set: 1, sets: 1, cycles: ex.sets, cycle, phases: ex.phases?.length ? ex.phases : null, seconds, est: seconds });
      });
      return;
    }

    const est = setSeconds(ex);
    for (let set = 1; set <= ex.sets; set++) {
      if (set > 1) pause('rest', 'Pausa', rest, i);
      sides.forEach((side, k) => {
        if (k > 0) pause('side', 'Cambia lato', switchRest, i);
        steps.push({
          kind: 'work',
          mode: ex.tempo ? 'tempo' : 'manual',
          ex: i,
          side,
          set,
          sets: ex.sets,
          reps: ex.reps,
          tempo: ex.tempo,
          seconds: ex.tempo ? est : null,
          est
        });
      });
    }
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
export function summarize(exercises, steps, spent = {}, done = {}, loads = {}) {
  return exercises
    .map((ex, i) => {
      const works = steps.filter((s) => s.kind === 'work' && s.ex === i);
      const finished = works.filter((s) => done[s.id]).length;
      return {
        name: ex.name,
        cat: ex.cat,
        kind: ex.kind,
        sides: ex.sides,
        seconds: Math.round(sum(works, (s) => spent[s.id] ?? 0)),
        sets: finished,
        of: works.length,
        reps: ex.kind === 'reps' ? finished * ex.reps : 0,
        load: ex.load && loads[i] != null && finished ? Number(loads[i]) : null
      };
    })
    .filter((x) => x.seconds > 0 || x.sets > 0);
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

/** Il volume di un esercizio in una riga: «5 cicli da 41 s per lato · 4 fasi», «3 × 5 · ritmo 4-2-4 · 2–4 kg». */
export function volumeText(ex) {
  const side = ex.sides ? ' per lato' : '';
  if (ex.kind === 'time') {
    const cycle = cycleSeconds(ex);
    const text = (ex.sets > 1 ? `${ex.sets} cicli da ${fmtDur(cycle)}` : fmtDur(cycle)) + side;
    return ex.phases?.length ? `${text} · ${ex.phases.length} fasi` : text;
  }
  const parts = [`${ex.sets} × ${ex.reps}${side}`];
  if (ex.tempo) parts.push(`ritmo ${ex.tempo.join('-')}`);
  if (ex.load) parts.push(ex.load);
  return parts.join(' · ');
}

/** Gli esercizi si riconoscono dal nome, anche fra routine diverse. */
export const nameKey = (name) => String(name).trim().toLowerCase();

/** Una durata in due pezzi, numero grande e unità piccola: 40 + «sec», 3:20 + «min». */
export function durParts(sec) {
  const s = Math.round(sec);
  if (s < 60) return { time: String(s), unit: 'sec' };
  return { time: s % 60 === 0 ? String(s / 60) : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`, unit: 'min' };
}
