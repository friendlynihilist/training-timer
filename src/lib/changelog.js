// Versione e novità. La versione vera è quella di package.json: qui sotto si aggiunge la voce
// corrispondente. Le novità compaiono una volta dopo un aggiornamento, e da Impostazioni.

import pkg from '../../package.json';

export const VERSION = pkg.version;

export const CHANGELOG = [
  {
    version: '0.5.1',
    date: '2026-11-26',
    title: 'L’andamento, giorno per giorno',
    items: [
      { icon: 'trending', text: 'Nel grafico c’è una linea sola, con il totale di ogni giorno: prima ogni tipo di routine aveva la sua, e due giorni di fila con routine diverse sembravano una salita e una discesa.' },
      { icon: 'tag', text: 'Il colore del punto dice che routine era: blu la mobilità, arancione l’ipertrofia. Sopra ogni punto ci sono i minuti.' },
      { icon: 'calendar', text: 'Sotto il grafico trovi il totale giorno per giorno, oltre a quello del periodo. Toccando un giorno si apre nel Diario.' }
    ]
  },
  {
    version: '0.5.0',
    date: '2026-11-26',
    title: 'Aggiungi al diario, e le novità',
    items: [
      { icon: 'calendar', text: 'Nel Diario c’è «Aggiungi»: segni a mano una seduta fatta senza l’app, o in un giorno passato. Scegli il giorno, la routine, gli esercizi fatti e i minuti.' },
      { icon: 'sparkles', text: 'Dopo ogni aggiornamento questa finestra ti dice cosa è cambiato. La ritrovi in Impostazioni, sotto «Novità».' },
      { icon: 'shield', text: 'Il giorno di una seduta è sempre quello in cui la cominci, anche se l’app era rimasta aperta dal giorno prima.' }
    ]
  },
  {
    version: '0.4.0',
    date: '2026-11-26',
    title: 'Circuito V-shape, ipertrofia e spiegazioni',
    items: [
      { icon: 'dumbbell', text: 'Fra le routine c’è «Circuito V-shape al parchetto»: riscaldamento, due circuiti a giri e chiusura, con i suoi recuperi.' },
      { icon: 'repeat', text: 'Circuiti a giri e forbici di ripetizioni (6–10): a ogni serie segni quante ne hai fatte, e in Progressi vedi quando è ora di aumentare la difficoltà.' },
      { icon: 'tag', text: 'Ogni routine dice a cosa serve: mobilità, ipertrofia o altro. Nell’andamento ognuna ha la sua linea e il suo colore.' },
      { icon: 'book', text: 'Gli esercizi di mobilità hanno la spiegazione di come si fanno: la leggi nella pausa prima e nella scheda della routine.' },
      { icon: 'timer', text: 'I minuti di una seduta contano anche le pause.' }
    ]
  },
  {
    version: '0.3.0',
    date: '2026-11-26',
    title: 'Quello che fai conta sempre',
    items: [
      { icon: 'check', text: 'La X chiude e salva: se ti fermi prima della fine, quello che hai fatto va nel diario, nel suo giorno.' },
      { icon: 'play', text: 'La volta dopo puoi riprendere dall’esercizio a cui eri arrivato.' },
      { icon: 'trending', text: 'In Progressi l’andamento mostra i minuti giorno per giorno: settimana, mese, tre mesi.' }
    ],
    note: 'Le sedute chiuse a metà prima di questa versione non erano state salvate: puoi rimetterle con «Aggiungi» nel Diario.'
  },
  {
    version: '0.2.0',
    date: '2026-11-23',
    title: 'Cicli a fasi (PNF)',
    items: [{ icon: 'layers', text: 'Ogni ciclo può avere più fasi: posizione, spingi, tira, rilassa, con un’indicazione e un suono per ognuna.' }]
  },
  {
    version: '0.1.0',
    date: '2026-11-23',
    title: 'Prima versione',
    items: [{ icon: 'blocks', text: 'Routine a blocchi, sessione dal vivo con le pause, importazione, progressi e diario.' }]
  }
];

const parts = (v) => String(v).split('.').map((n) => Number(n) || 0);
/** `a` viene dopo `b`? */
export function newer(a, b) {
  const [x, y] = [parts(a), parts(b)];
  for (let i = 0; i < 3; i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) > (y[i] ?? 0);
  return false;
}

/** Le novità uscite dopo la versione `seen`, dalla più recente. */
export const unseen = (seen) => CHANGELOG.filter((e) => newer(e.version, seen) && !newer(e.version, VERSION));
