// I dati dell'app: routine, diario delle sedute, impostazioni. Tutto resta su questo dispositivo
// (localStorage); la copia completa si esporta e si ripristina da Impostazioni.

import { DEFAULTS, normalizeRoutine, newId, nameKey } from './model.js';
import { seedRoutine } from './seed.js';
import { todayISO } from './dates.js';

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

function cleanSession(raw) {
  if (!raw || typeof raw.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(raw.date)) return null;
  return {
    id: raw.id || newId(),
    date: raw.date,
    at: Number(raw.at) || Date.parse(raw.date),
    routineId: raw.routineId ?? null,
    name: String(raw.name ?? 'Allenamento'),
    seconds: Math.max(0, Math.round(Number(raw.seconds) || 0)),
    items: Array.isArray(raw.items) ? raw.items : [],
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

  constructor() {
    const saved = read(KEY);
    if (saved) this.#apply(saved);
    else {
      // La prima volta: la routine di partenza, già pronta da provare.
      const seed = seedRoutine();
      this.routines = [seed];
      this.activeId = seed.id;
      this.save();
    }
    this.hasDraft = Boolean(read(LIVE));
    if (typeof document !== 'undefined') {
      // A cavallo della mezzanotte, o tornando sull'app il giorno dopo, «oggi» si aggiorna.
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) this.today = todayISO();
      });
    }
  }

  #apply(data) {
    this.routines = (data.routines ?? []).map(normalizeRoutine);
    this.sessions = (data.sessions ?? []).map(cleanSession).filter(Boolean);
    this.settings = cleanSettings(data.settings);
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
    return $state.snapshot({ routines: this.routines, sessions: this.sessions, settings: this.settings, activeId: this.activeId });
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
    const seed = seedRoutine();
    this.routines = [seed];
    this.sessions = [];
    this.settings = { ...SETTINGS };
    this.activeId = seed.id;
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

  rememberTheme() {
    try {
      localStorage.setItem(THEME, this.settings.theme);
    } catch {}
  }
}

export const app = new App();
