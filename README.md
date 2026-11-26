# Cadenza

Timer per allenamenti a blocchi: costruisci una routine esercizio per esercizio, la fai partire e il
telefono scandisce tutto, pause comprese. L'aspetto è quello di [Terza palla](https://github.com/friendlynihilist/tt-trainer).

**Apri l'app: <https://friendlynihilist.github.io/training-timer/>** (si installa sul telefono con «Aggiungi a Home»).

## Cosa fa

- **Routine a blocchi.** Ogni blocco è un esercizio, a tempo (cicli da N secondi) o a ripetizioni
  (serie × ripetizioni, anche a ritmo: 4-2-4), per lato oppure no, con un carico se serve.
- **Cicli a fasi (PNF).** Un ciclo può avere più fasi, ognuna con i suoi secondi e un'indicazione:
  posizione 10 s, spingi 6 s, tira 5 s, rilassa 20 s. In sessione vedi la fase in corso in grande,
  con un suono diverso a ogni cambio.
- **Sessione dal vivo.** Tempo grande, un segnale a ogni ciclo e negli ultimi tre secondi, 15 secondi
  di pausa fra un esercizio e l'altro, cambio di lato, schermo sempre acceso. Le serie senza ritmo
  aspettano il tuo «Serie fatta». Se ti fermi prima, quello che hai fatto va nel diario lo stesso, nel
  suo giorno, e la volta dopo puoi riprendere dall'esercizio a cui eri arrivato.
- **Importa.** Incolli una tabella o un elenco (una riga per esercizio: nome e volume) e diventa una
  routine; oppure un file esportato dall'app.
- **Progressi.** Settimane di fila, minuti di lavoro, l'andamento con i minuti giorno per giorno
  (settimana, mese, tre mesi), obiettivi della settimana esercizio per esercizio (volume di una
  seduta × volte a settimana), carichi usati.
- **Diario.** Il mese con le sedute fatte, ognuna con sensazione e nota.

I dati restano sul dispositivo (localStorage). Da Impostazioni si scarica e si ripristina la copia completa.

## Come si scrive il volume, quando importi

| Scritto così | Diventa |
|---|---|
| `2 x 8 rep lente` | 2 serie da 8, nota «lente» |
| `3 x 5 (4-2-4), 2–4 kg` | 3 serie da 5 a ritmo, con carico |
| `5 cicli (3:20)` | 5 cicli da 40 s (3:20 in tutto) |
| `5 cicli per lato (3:20 per lato)` | lo stesso, a sinistra e a destra |
| `5 cicli PNF` | 5 cicli a fasi (posizione, spingi, tira, rilassa), 41 s l'uno |
| `1 min per lato` | 1 minuto per lato |
| `3 x 30 s` | 3 cicli da 30 s |

Se c'è una terza colonna con il totale settimanale («10 min»), l'app ne ricava le volte a settimana.

## Sviluppo

```sh
npm install
npm run dev      # http://localhost:5173
npm test         # modello, importazione, statistiche
npm run build    # in dist/
```

Svelte 5 e Vite, senza server. Ogni push su `main` pubblica su GitHub Pages (`.github/workflows/deploy.yml`).

- `src/lib/model.js`: esercizi, routine, i passi della sessione con le pause.
- `src/lib/importer.js`: dal testo incollato alla routine.
- `src/lib/stats.js`: settimane di fila, obiettivi, andamento, carichi.
- `src/lib/screens/Live.svelte`: la sessione dal vivo. `Builder.svelte`: il costruttore.
