// Le routine con cui l'app parte la prima volta: la mobilità (otto esercizi, tre volte a settimana) e
// il circuito V-shape al parchetto (ipertrofia, due volte a settimana).

import { normalizeRoutine, nameKey, pnfPhases, PNF } from './model.js';

/** Le indicazioni della rana, fase per fase. */
const FROG = [
  'A quattro zampe, ginocchia larghe, tibie parallele, piedi in linea con le ginocchia. Bacino indietro fino a sentire tensione all’interno coscia: 7 su 10.',
  'Premi le ginocchia verso il pavimento come per avvicinarle, senza muoverle davvero. Adduttori al 60-70% della forza.',
  'Rilascia e contrai i glutei come per allargare ancora le ginocchia; intanto lascia scendere il bacino indietro e in basso.',
  'Espira a fondo e resta nella nuova posizione, più bassa.'
];
const COUCH = [
  'Un ginocchio a terra contro il muro, tibia e piede su lungo la parete; l’altra gamba avanti, in affondo. Busto alto, fino a sentire tensione davanti alla coscia: 7 su 10.',
  'Premi il collo del piede e la tibia contro il muro, come per stendere il ginocchio, senza muoverti. Quadricipite al 60-70% della forza.',
  'Rilascia e stringi il gluteo della gamba dietro: il bacino va avanti e il busto si alza un po’ di più.',
  'Espira a fondo e resta nella nuova posizione, senza inarcare la schiena.'
];
const DOORWAY = [
  'Avambraccio contro lo stipite, gomito all’altezza della spalla, piegato a 90°. Un passo avanti e ruota il busto dall’altra parte, fino a sentire tensione al petto: 7 su 10.',
  'Premi l’avambraccio contro lo stipite come per chiudere il braccio davanti a te, senza muoverti. Pettorale al 60-70% della forza.',
  'Rilascia e stringi le scapole, come per staccare il gomito dallo stipite; intanto ruota ancora un po’ il busto.',
  'Espira a fondo e resta nella nuova posizione, con la spalla bassa, lontana dall’orecchio.'
];
const BLOCK = [
  'In ginocchio davanti a una panca o a una sedia, gomiti appoggiati sopra, mani giunte dietro la testa. Bacino indietro e petto verso il pavimento, fino a sentire tensione sotto le ascelle: 7 su 10.',
  'Premi i gomiti contro la panca, verso il basso, senza muoverti. Dorsali e tricipiti al 60-70% della forza.',
  'Rilascia e lascia scendere ancora il petto, come per sollevare i gomiti dalla panca.',
  'Espira a fondo e resta nella nuova posizione, con le costole chiuse e la schiena lunga.'
];

/** Gli esercizi a cicli della routine di partenza, tutti PNF, con le loro indicazioni. */
const PNF_NAMES = { 'frog stretch': FROG, 'couch stretch': COUCH, 'apertura allo stipite': DOORWAY, 'butcher’s block': BLOCK };

/** Come si fanno gli esercizi della mobilità. */
const HOW = {
  '90/90 hip switches':
    'Seduto a terra, una gamba piegata a 90° davanti a te e l’altra a 90° di lato. Senza staccare i talloni, porta le ginocchia dall’altra parte e torna, lentamente. Busto alto; le mani dietro aiutano, senza mani è più difficile. Una ripetizione è un passaggio da una parte all’altra.',
  'jefferson curl':
    'In piedi su un rialzo, gambe tese, un peso leggero in mano. Scendi srotolando la schiena una vertebra alla volta, dal mento in giù (4 secondi), resta appeso in basso (2), risali riarrotolando dal bacino (4). Il peso serve ad allungare, non a faticare: nessun dolore alla schiena.',
  'frog stretch':
    'A quattro zampe, ginocchia larghe, tibie parallele e piedi in linea con le ginocchia; appoggiati sugli avambracci. Si lavora portando il bacino indietro, con la schiena piatta. Allunga gli adduttori, l’interno coscia.',
  'couch stretch':
    'Un ginocchio a terra vicino al muro (o al divano), tibia e piede su lungo la parete; l’altra gamba avanti in affondo. Busto alto, gluteo stretto, bacino che spinge avanti senza inarcare la schiena. Allunga quadricipite e flessori dell’anca. Un cuscino sotto il ginocchio aiuta.',
  'seated hip flexor lift-offs':
    'Seduto a terra, gambe tese davanti, mani a terra ai lati di una coscia. Solleva quella gamba tesa di qualche centimetro, tieni un attimo e scendi piano, senza buttare il busto indietro. Più avanti metti le mani, più è difficile. Rinforza i flessori dell’anca dove sono più corti.',
  'apertura allo stipite':
    'In piedi accanto a uno stipite, avambraccio appoggiato in verticale con il gomito all’altezza della spalla. Fai un passo avanti con la gamba dello stesso lato e ruota il busto dall’altra parte. Allunga il petto e la parte davanti della spalla; la spalla resta bassa.',
  'open book':
    'Sdraiato su un fianco, ginocchia piegate a 90° una sull’altra, braccia tese davanti a te con le mani unite. Apri il braccio di sopra verso il lato opposto, seguendo la mano con lo sguardo, e lascia ruotare il petto verso il soffitto; le ginocchia restano ferme a terra. Resta un respiro e torna. Vai avanti così, lento, per tutto il minuto.',
  'butcher’s block':
    'In ginocchio davanti a una panca o a una sedia, gomiti appoggiati sopra alla larghezza delle spalle, mani giunte dietro la testa (o un bastone fra le mani). Bacino sopra le ginocchia o poco più indietro, petto verso il pavimento. Allunga dorsali, tricipiti e la parte alta della schiena.'
};

const key = (name) => nameKey(name).replace("'", '’');
const isDefault = (phases) => phases.length === PNF.length && phases.every((p, i) => p.cue === PNF[i].cue);

/**
 * Chi aveva già la routine di partenza, salvata prima che esistessero le fasi (versione 0.1), se la
 * ritrova con i cicli PNF. Tocca solo quei quattro esercizi, e solo se sono ancora a cicli semplici.
 */
export function addPnf(routines) {
  for (const r of routines) {
    for (const e of r.exercises) {
      const cues = PNF_NAMES[key(e.name)];
      if (cues && e.kind === 'time' && e.sets > 1 && !e.phases) {
        e.phases = pnfPhases(cues);
        e.seconds = e.phases.reduce((a, p) => a + p.seconds, 0);
      }
    }
  }
  return routines;
}

/**
 * Dalla 0.4 gli esercizi hanno una spiegazione. Chi ha già gli esercizi di mobilità la trova scritta,
 * e i cicli PNF che avevano ancora le indicazioni generiche prendono quelle dell'esercizio. Quello
 * che hai scritto tu non si tocca.
 */
export function addHow(routines) {
  for (const r of routines) {
    for (const e of r.exercises) {
      if (!e.how && HOW[key(e.name)]) e.how = HOW[key(e.name)];
      const cues = PNF_NAMES[key(e.name)];
      if (cues && e.phases && isDefault(e.phases)) e.phases = pnfPhases(cues);
    }
  }
  return routines;
}

/**
 * Mette il circuito V-shape fra le routine. Se ce n'è già uno con quel nome (provato a importare, o
 * scritto a mano) lo rimette a posto, tenendo il suo posto e il suo identificativo.
 */
export function addVshape(routines) {
  const at = routines.findIndex((r) => /v-?\s?shape/i.test(r.name));
  if (at < 0) routines.push(vshapeRoutine());
  else routines[at] = { ...vshapeRoutine(), id: routines[at].id };
  return routines;
}

export const SEED_TEXT = `#\tEsercizio\tVolume per seduta\tTotale settimanale
1\t90/90 Hip Switches\t2 x 8 rep lente\tinvariato
2\tJefferson Curl\t3 x 5 (4-2-4), 2–4 kg\tinvariato
3\tFrog Stretch\t5 cicli (3:20)\t10 min
4\tCouch Stretch\t5 cicli per lato (3:20 per lato)\t10 min per lato
5\tSeated Hip Flexor Lift-offs\t2 x 8 per gamba\tinvariato
6\tApertura allo stipite\t5 cicli per lato (3:20 per lato)\t10 min per lato
7\tOpen Book\t1 min per lato\tinvariato
8\tButcher's Block\t5 cicli (3:20)\t10 min`;

export function seedRoutine() {
  return normalizeRoutine({
    name: 'Mobilità',
    type: 'mobilita',
    perWeek: 3,
    exercises: [
      { name: '90/90 Hip Switches', cat: 'mobilita', kind: 'reps', sets: 2, reps: 8, note: 'lente' },
      { name: 'Jefferson Curl', cat: 'forza', kind: 'reps', sets: 3, reps: 5, tempo: [4, 2, 4], load: '2–4 kg' },
      { name: 'Frog Stretch', cat: 'allungamento', kind: 'time', sets: 5, phases: pnfPhases(FROG) },
      { name: 'Couch Stretch', cat: 'allungamento', kind: 'time', sets: 5, phases: pnfPhases(COUCH), sides: true },
      { name: 'Seated Hip Flexor Lift-offs', cat: 'attivazione', kind: 'reps', sets: 2, reps: 8, sides: true },
      { name: 'Apertura allo stipite', cat: 'allungamento', kind: 'time', sets: 5, phases: pnfPhases(DOORWAY), sides: true },
      { name: 'Open Book', cat: 'mobilita', kind: 'time', sets: 1, seconds: 60, sides: true },
      { name: 'Butcher’s Block', cat: 'allungamento', kind: 'time', sets: 5, phases: pnfPhases(BLOCK) }
    ].map((e) => ({ ...e, how: HOW[key(e.name)] }))
  });
}

/**
 * Il circuito V-shape al parchetto: riscaldamento, due circuiti (quattro giri e tre giri) e chiusura.
 * Nei circuiti si recupera fra un esercizio e l'altro e, più a lungo, a fine giro.
 */
export function vshapeRoutine() {
  const warm = { block: 'Riscaldamento', rest: 30 };
  const a = { block: 'Circuito A', circuit: true, sets: 4, rest: 60, roundRest: 90, kind: 'reps', cat: 'forza' };
  const b = { block: 'Circuito B', circuit: true, sets: 3, rest: 45, roundRest: 90, kind: 'reps', cat: 'forza' };
  return normalizeRoutine({
    name: 'Circuito V-shape al parchetto',
    type: 'ipertrofia',
    perWeek: 2,
    note: [
      'Due volte a settimana, nei giorni senza palestra. Dura 35-40 minuti. Servono sbarra, parallele ed elastico.',
      'Fermati 1-2 ripetizioni prima del cedimento in ogni serie.',
      'Quando arrivi al massimo della forbice in tutte le serie, aumenta la difficoltà: zaino con peso per trazioni e dips, elastico più duro per le alzate.',
      'A ogni serie segna le ripetizioni fatte: restano nel diario e nei progressi.'
    ].join('\n'),
    exercises: [
      { ...warm, name: 'Dead hang', cat: 'attivazione', kind: 'time', apart: true, sets: 2, seconds: 30, how: 'Appeso alla sbarra a braccia tese, spalle attive, corpo fermo. Scalda presa e spalle.' },
      { ...warm, name: 'Scapular pull-up', cat: 'attivazione', kind: 'reps', sets: 2, reps: 8, how: 'Appeso alla sbarra a braccia tese, abbassa e avvicina le scapole senza piegare i gomiti, poi rilascia. Attiva i dorsali prima delle trazioni.' },
      { ...warm, name: 'Piegamenti leggeri', cat: 'attivazione', kind: 'reps', sets: 1, reps: 10, rest: 60, how: 'Piegamenti a ritmo tranquillo, lontani dal cedimento. Scaldano petto, spalle e tricipiti prima dei dips.' },
      { ...a, name: 'Trazioni presa prona', reps: 6, repsMax: 10, how: 'Palmi in avanti, mani poco più larghe delle spalle. Sali fino a portare il mento sopra la sbarra e scendi controllato fino a braccia tese. Lavora i dorsali, il muscolo principale della forma a V.' },
      { ...a, name: 'Dips alle parallele', reps: 8, repsMax: 12, how: 'Braccia tese sulle parallele, busto leggermente inclinato in avanti. Scendi finché i gomiti arrivano a circa 90 gradi e risali spingendo. Lavora tricipiti, petto e spalle.' },
      { ...b, name: 'Trazioni presa supina (chin-up)', reps: 8, repsMax: 12, how: 'Palmi verso di te, mani alla larghezza delle spalle. Stessa esecuzione delle trazioni prone. Lavora dorsali e bicipiti.' },
      { ...b, name: 'Alzate laterali con elastico', reps: 15, repsMax: 20, how: 'In piedi sull’elastico, braccia lungo i fianchi. Sali lateralmente fino all’altezza delle spalle con i gomiti leggermente piegati, senza slancio del busto, poi scendi lento. Lavora i deltoidi laterali, che allargano le spalle.' },
      { ...b, name: 'Piegamenti a mani strette', reps: 10, repsMax: 15, how: 'Mani sotto il petto, più vicine della larghezza delle spalle, gomiti lungo i fianchi. Corpo dritto dalla testa ai talloni. Lavora soprattutto i tricipiti.' },
      { block: 'Chiusura', name: 'Dead hang finale', cat: 'allungamento', kind: 'time', apart: true, sets: 2, seconds: 45, rest: 45, note: '30–45 s', how: 'Appeso alla sbarra a braccia tese, lascia allungare le spalle. Allena la presa e migliora la mobilità con le braccia sopra la testa. Tieni almeno 30 secondi, fino a 45.' }
    ]
  });
}
