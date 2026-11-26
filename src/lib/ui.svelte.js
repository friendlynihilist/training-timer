// Stato dell'interfaccia: pagina corrente, fogli aperti, sessione dal vivo, costruttore, avvisi.

import { app } from './store.svelte.js';
import { unlockAudio, vibrate } from './device.js';

const ROUTES = ['oggi', 'diario', 'progressi', 'routine', 'impostazioni'];

function parseHash() {
  const [name, ...params] = location.hash.replace(/^#\/?/, '').split('/');
  return { name: ROUTES.includes(name) ? name : 'oggi', params };
}

let seq = 0;

class UI {
  route = $state.raw(parseHash());
  /** Pila di fogli: [{ id, type, props }] */
  sheets = $state.raw([]);
  /** Sessione dal vivo aperta: { routineId, from } oppure { resume: true }; null se chiusa. */
  live = $state.raw(null);
  /** Il costruttore aperto: { routine } (null per una routine nuova). */
  builder = $state.raw(null);
  toasts = $state.raw([]);
  /** Le novità aperte da Impostazioni: { history: true }; null se chiuse. */
  news = $state.raw(null);
  /** La pagina da cui si è arrivati a Impostazioni, per tornarci. */
  #from = 'oggi';

  constructor() {
    window.addEventListener('hashchange', () => {
      const next = parseHash();
      if (next.name === 'impostazioni' && this.route.name !== 'impostazioni') this.#from = this.route.name;
      this.route = next;
      this.sheets = []; // cambiando pagina i fogli aperti si chiudono
      window.scrollTo({ top: 0 });
    });
  }

  go(name, ...params) {
    location.hash = `#/${[name, ...params].join('/')}`;
  }
  back() {
    this.go(this.#from);
  }

  open(type, props = {}) {
    this.sheets = [...this.sheets, { id: ++seq, type, props }];
  }
  /** Chiude il foglio in cima. */
  close() {
    this.sheets = this.sheets.slice(0, -1);
  }
  closeAll() {
    this.sheets = [];
  }
  /** Chiede conferma prima di una cosa che non si annulla: { title, text, label, danger, run }. */
  confirm(props) {
    this.open('confirm', props);
  }

  /** Comincia una routine, dal primo esercizio o da `from`. Va chiamata dentro un tocco: sblocca l'audio. */
  start(routineId, from = 0) {
    unlockAudio();
    this.closeAll();
    this.live = { routineId, from };
  }
  resume() {
    unlockAudio();
    this.closeAll();
    this.live = { resume: true };
  }
  /** Apre il costruttore: su una routine che c'è già, o su una nuova. */
  build(routine = null) {
    this.closeAll();
    this.builder = { routine };
  }

  toast(text, { tone = '', action = null, ms = 3200 } = {}) {
    const id = ++seq;
    this.toasts = [...this.toasts, { id, text, tone, action }];
    setTimeout(() => this.dismiss(id), action ? 6000 : ms);
  }
  dismiss(id) {
    this.toasts = this.toasts.filter((t) => t.id !== id);
  }
}

export const ui = new UI();

/** Una vibrazione breve, se accesa in Impostazioni. */
export function buzz(pattern = 8) {
  if (app.settings.haptics) vibrate(pattern);
}
