// I dati dell'app: routine, diario delle sedute, impostazioni. Tutto resta su questo dispositivo
// (localStorage); la copia completa si esporta e si ripristina da Impostazioni.

import { DEFAULTS, TYPE, normalizeRoutine, newId, nameKey, sessionOf } from './model.js';
import { seedRoutine, vshapeRoutine, addPnf, addHow, addVshape } from './seed.js';
import { todayISO } from './dates.js';
import { VERSION as APP_VERSION } from './changelog.js';

const KEY = 'training-timer:v1';
const LIVE = 'training-timer:live';
const THEME = 'training-timer:theme';

const SETTINGS = { theme: 'auto', sound: true, haptics: true, ...DEFAULTS };

function read(key) {
  try {
    return JSON.parse(localStorage.getItem(key));
  } catch {
    return null;
  }
}
function write(key, value) {
  try {
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

const seconds = (v, fallback) => (Number.isFinite(Number(v)) ? Math.min(600, Math.max(0, Math.round(Number(v)))) : fallback);

function cleanSettings(raw = {}) {
  return {
    theme: ['auto', 'light', 'dark'].includes(raw.theme) ? raw.theme : 'auto',
    sound: raw.sound !== false,
    haptics: raw.haptics !== false,
    rest: seconds(raw.rest, DEFAULTS.rest),
    switchRest: seconds(raw.switchRest, DEFAULTS.switchRest),
    lead: seconds(raw.lead, DEFAULTS.lead)
  };
}

/** La versione dei dati salvati: cambia quando chi ha già l'app deve ricevere qualcosa (vedi #apply). */
const VERSION = 3;

function cleanSession(raw) {
  if (!raw || typeof raw.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(raw.date)) return null;
  return {
    id: raw.id || newId(),
    date: raw.date,
    at: Number(raw.at) || Date.parse(raw.date),
    routineId: raw.routineId ?? null,
    name: String(raw.name ?? 'Allenamento'),
    // A cosa serviva la routine quel giorno; le sedute più vecchie lo prendono dalla routine (#apply).
    type: TYPE[raw.type] ? raw.type : null,
    // Il lavoro, e la seduta com'è durata con le pause (le sedute più vecchie hanno solo il lavoro).
    seconds: Math.max(0, Math.round(Number(raw.seconds) || 0)),
    total: Math.max(0, Math.round(Number(raw.total ?? raw.seconds) || 0)),
    items: Array.isArray(raw.items) ? raw.items : [],
    // Scritta a mano nel diario, non fatta con il timer.
    manual: Boolean(raw.manual),
    feel: raw.feel >= 1 && raw.feel <= 5 ? raw.feel : null,
    note: String(raw.note ?? '')
  };
}

class App {
  routines = $state([]);
  sessions = $state([]);
  settings = $state({ ...SETTINGS });
  /** La routine di Oggi. */
  activeId = $state(null);
  today = $state(todayISO());
  /** C'è una sessione lasciata a metà? */
  hasDraft = $state(false);
  /** L'ultima versione di cui hai visto le novità. */
  seen = $state(APP_VERSION);

  constructor() {
    const saved = read(KEY);
    if (saved) {
      this.#apply(saved);
      if ((saved.v ?? 1) < VERSION) this.save();
    } else {
      // La prima volta: le routine di partenza, già pronte da provare.
      this.#seed();
      this.save();
    }
    this.hasDraft = Boolean(read(LIVE));
    if (typeof document !== 'undefined') {
      // A cavallo della mezzanotte, o tornando sull'app il giorno dopo, «oggi» si aggiorna: quando
      // l'app torna in vista, e comunque ogni mezzo minuto.
      const fresh = () => this.refreshToday();
      document.addEventListener('visibilitychange', fresh);
      window.addEventListener('pageshow', fresh);
      window.addEventListener('focus', fresh);
      setInterval(fresh, 30000);
      // L'app aperta in due schede: quello che salva una, l'altra lo rilegge, invece di
      // scriverci sopra i suoi dati vecchi.
      window.addEventListener('storage', (e) => {
        if (e.key === KEY && e.newValue) this.#apply(read(KEY));
        if (e.key === LIVE) this.hasDraft = Boolean(e.newValue);
      });
    }
  }

  /** Che giorno è adesso: lo si chiede di nuovo ogni volta che conta (cominciando una sessione). */
  refreshToday() {
    const now = todayISO();
    if (now !== this.today) this.today = now;
    return now;
  }

  #seed() {
    const seed = seedRoutine();
    this.routines = [seed, vshapeRoutine()];
    this.activeId = seed.id;
  }

  #apply(data) {
    const v = data.v ?? 1;
    const routines = (data.routines ?? []).map(normalizeRoutine);
    // Le copie salvate con la 0.1 non avevano le fasi dei cicli.
    if (v < 2) addPnf(routines);
    // Con la 0.4 arrivano le spiegazioni degli esercizi di mobilità e il circuito V-shape.
    if (v < 3) addVshape(addHow(routines));
    this.routines = routines;
    this.sessions = (data.sessions ?? [])
      .map(cleanSession)
      .filter(Boolean)
      .map((s) => ({ ...s, type: s.type ?? routines.find((r) => r.id === s.routineId)?.type ?? 'altro' }));
    this.settings = cleanSettings(data.settings);
    // Chi aveva l'app prima che esistessero le novità le vede tutte dalla 0.3 in poi.
    this.seen = typeof data.seen === 'string' ? data.seen : '0.2.0';
    this.activeId = this.routines.some((r) => r.id === data.activeId) ? data.activeId : (this.routines[0]?.id ?? null);
  }

  get active() {
    return this.routines.find((r) => r.id === this.activeId) ?? this.routines[0] ?? null;
  }
  /** Le pause, come le vuole `expand`. */
  get opts() {
    const { rest, switchRest, lead } = this.settings;
    return { rest, switchRest, lead };
  }
  /** Le sedute dalla più recente. */
  get history() {
    return [...this.sessions].sort((a, b) => b.at - a.at);
  }
  /** Tutti gli esercizi delle routine, una volta per nome: i blocchi da riusare nel costruttore. */
  get blocks() {
    const seen = new Map();
    for (const r of this.routines) for (const e of r.exercises) if (!seen.has(nameKey(e.name))) seen.set(nameKey(e.name), e);
    return [...seen.values()];
  }

  routine(id) {
    return this.routines.find((r) => r.id === id) ?? null;
  }

  snapshot() {
    return $state.snapshot({ v: VERSION, seen: this.seen, routines: this.routines, sessions: this.sessions, settings: this.settings, activeId: this.activeId });
  }
  save() {
    return write(KEY, this.snapshot());
  }

  // ── Routine ──────────────────────────────────────────────────────────────

  /** Salva una routine nuova o cambiata. */
  putRoutine(raw) {
    const routine = normalizeRoutine(raw);
    const i = this.routines.findIndex((r) => r.id === routine.id);
    if (i < 0) this.routines.push(routine);
    else this.routines[i] = routine;
    if (!this.routine(this.activeId)) this.activeId = routine.id;
    this.save();
    return routine;
  }
  /** Toglie una routine e la restituisce con il suo posto, per poterla rimettere. */
  removeRoutine(id) {
    const index = this.routines.findIndex((r) => r.id === id);
    if (index < 0) return null;
    const [routine] = this.routines.splice(index, 1);
    const wasActive = this.activeId === id;
    if (wasActive) this.activeId = this.routines[0]?.id ?? null;
    this.save();
    return { routine: $state.snapshot(routine), index, wasActive };
  }
  restoreRoutine({ routine, index, wasActive }) {
    this.routines.splice(index, 0, routine);
    if (wasActive) this.activeId = routine.id;
    this.save();
  }
  duplicateRoutine(id) {
    const from = this.routine(id);
    if (!from) return null;
    const copy = $state.snapshot(from);
    return this.putRoutine({ ...copy, id: null, name: `${copy.name} (copia)`, exercises: copy.exercises.map((e) => ({ ...e, id: null })) });
  }
  setActive(id) {
    this.activeId = id;
    this.save();
  }

  // ── Diario ───────────────────────────────────────────────────────────────

  addSession(raw) {
    const session = cleanSession({ ...raw, id: newId() });
    session.type ??= this.routine(session.routineId)?.type ?? 'altro';
    this.sessions.push(session);
    this.save();
    return session;
  }
  removeSession(id) {
    const index = this.sessions.findIndex((s) => s.id === id);
    if (index < 0) return null;
    const [session] = this.sessions.splice(index, 1);
    this.save();
    return $state.snapshot(session);
  }
  restoreSession(session) {
    this.sessions.push(session);
    this.save();
  }

  /** Le novità fino a questa versione sono state viste. */
  markSeen() {
    if (this.seen === APP_VERSION) return;
    this.seen = APP_VERSION;
    this.save();
  }

  // ── Impostazioni e dati ──────────────────────────────────────────────────

  patchSettings(patch) {
    this.settings = cleanSettings({ ...this.settings, ...patch });
    this.save();
  }

  /** La copia completa, da tenere da parte o portare su un altro dispositivo. */
  backup() {
    return { app: 'training-timer', version: 1, exported: new Date().toISOString(), ...this.snapshot() };
  }
  /** Rimette una copia completa al posto dei dati di adesso. Dice se la copia era valida. */
  restore(data) {
    if (!data || data.app !== 'training-timer' || !Array.isArray(data.routines)) return false;
    this.#apply(data);
    this.save();
    return true;
  }
  wipe() {
    write(KEY, null);
    this.clearLive();
    this.#seed();
    this.sessions = [];
    this.settings = { ...SETTINGS };
    this.seen = APP_VERSION;
    this.save();
  }

  // ── La sessione a metà ───────────────────────────────────────────────────

  loadLive() {
    return read(LIVE);
  }
  saveLive(draft) {
    write(LIVE, draft);
    this.hasDraft = true;
  }
  clearLive() {
    write(LIVE, null);
    this.hasDraft = false;
  }
  /** La sessione a metà si chiude: quello che avevi fatto va nel diario, nel suo giorno. */
  bankLive() {
    const draft = read(LIVE);
    const done = draft?.steps?.length ? sessionOf(draft) : null;
    const session = done ? this.addSession({ ...done, at: draft.beat ?? Date.now() }) : null;
    this.clearLive();
    return session;
  }

  rememberTheme() {
    try {
      localStorage.setItem(THEME, this.settings.theme);
    } catch {}
  }
}

export const app = new App();
