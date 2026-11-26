<script>
  // «Progressi», dal generale al particolare: tre numeri (settimane di fila, tempo, giorni), l'andamento
  // nel tempo (i minuti giorno per giorno), gli obiettivi della settimana esercizio per esercizio, i carichi.
  import Timer from '@lucide/svelte/icons/timer';
  import ListChecks from '@lucide/svelte/icons/list-checks';
  import Check from '@lucide/svelte/icons/check';
  import TrendingUp from '@lucide/svelte/icons/trending-up';
  import TrendingDown from '@lucide/svelte/icons/trending-down';
  import { app } from '../store.svelte.js';
  import { fade } from 'svelte/transition';
  import { weekStreak, totals, activity, minutes, PERIODS, weeklyGoals, loadHistory } from '../stats.js';
  import { buzz } from '../ui.svelte.js';
  import { fmtDur } from '../model.js';
  import { fmtShort } from '../dates.js';
  import PageHead from '../ui/PageHead.svelte';
  import Segmented from '../ui/Segmented.svelte';
  import Flame from '../ui/Flame.svelte';

  const streak = $derived(weekStreak(app.sessions, app.today));
  const all = $derived(totals(app.sessions));
  const routine = $derived(app.active);
  const goals = $derived(weeklyGoals(routine, app.sessions, app.today));
  const loads = $derived(loadHistory(app.sessions));

  /** Il tempo totale: minuti finché sono pochi, poi ore. */
  const spent = $derived.by(() => {
    const m = minutes(all.seconds);
    return m < 120 ? { n: m, unit: m === 1 ? 'minuto' : 'minuti' } : { n: (m / 60).toFixed(1).replace('.', ',').replace(',0', ''), unit: 'ore' };
  });

  const kg = (v) => `${String(v).replace('.', ',')} kg`;
  /** Quanto, nell'unità dell'obiettivo: un tempo, oppure le serie (mezza, se hai fatto un lato solo). */
  function amount(g, v) {
    if (!v) return '0';
    if (g.unit === 'time') return fmtDur(v);
    return String(Math.floor(v * 2) / 2).replace('.5', '½').replace(/^0½/, '½');
  }

  // ── L'andamento ──
  // Lo stesso grafico di Terza palla: una linea con un punto per giorno (settimana, mese) o per
  // settimana (tre mesi), e in altezza i minuti di lavoro. Conta tutto quello che è nel diario,
  // sedute intere e pezzi. Si cambia periodo con i tre nomi o con due dita: allargando si stringe
  // il periodo (verso la settimana), stringendo lo si allarga (verso i tre mesi).
  const NAMES = {
    settimana: { label: 'Settimana', span: 'ultimi 7 giorni', total: 'Ultimi 7 giorni' },
    mese: { label: 'Mese', span: 'ultimi 30 giorni', total: 'Ultimi 30 giorni' },
    'tre-mesi': { label: 'Tre mesi', span: 'ultimi tre mesi, settimana per settimana', total: 'Ultimi tre mesi' }
  };
  const ZOOMS = PERIODS.map((p) => ({ ...p, ...NAMES[p.id] }));
  // Dal più largo al più stretto: è l'ordine in cui si ingrandisce.
  const ORDER = ZOOMS.map((z) => z.id).reverse();
  const MEMO = 'training-timer:andamento';
  function stored() {
    try {
      const v = localStorage.getItem(MEMO);
      return ORDER.includes(v) ? v : 'mese';
    } catch {
      return 'mese';
    }
  }
  let scale = $state(stored());
  /** Il punto scelto nel grafico: null = nessuno, e sotto c'è il totale del periodo. */
  let picked = $state(null);
  function setScale(v) {
    if (!ORDER.includes(v) || v === scale) return;
    scale = v;
    picked = null;
    try {
      localStorage.setItem(MEMO, v);
    } catch {
      // Senza memoria del browser si riparte dal mese.
    }
  }
  /** +1 ingrandisce (verso la settimana), -1 rimpicciolisce (verso i tre mesi). */
  function zoom(step) {
    const next = ORDER[ORDER.indexOf(scale) + step];
    if (next) {
      setScale(next);
      buzz();
    }
  }

  const period = $derived(ZOOMS.find((z) => z.id === scale));
  const points = $derived(activity(app.sessions, period.unit, period.n, app.today));
  const last = $derived(points.length - 1);
  const tip = $derived(picked == null ? last : Math.min(picked, last));
  // La cima del grafico: il valore più alto, arrotondato ai dieci minuti (alla mezz'ora sopra l'ora).
  const top = $derived.by(() => {
    const m = Math.max(10, ...points.map((p) => p.minutes));
    return m <= 60 ? Math.ceil(m / 10) * 10 : Math.ceil(m / 30) * 30;
  });
  const X = (i) => 8 + i * (304 / Math.max(1, last));
  const Y = (v) => 100 - (v / top) * 84;
  const line = $derived(points.map((p, i) => `${X(i)},${Y(p.minutes)}`).join(' '));
  const dense = $derived(points.length > 16);

  const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
  /** Una durata a parole: «45 minuti», «1 ora», «6 ore e 15 minuti». */
  function spell(min) {
    const h = Math.floor(min / 60);
    const m = min % 60;
    const hours = h === 1 ? '1 ora' : `${h} ore`;
    const mins = m === 1 ? '1 minuto' : `${m} minuti`;
    return !h ? mins : !m ? hours : `${hours} e ${mins}`;
  }
  // Sotto il grafico: senza un punto scelto, il totale del periodo (quanti minuti, in quanti
  // giorni); con un punto scelto, quel giorno o quella settimana.
  const sum = $derived({ seconds: points.reduce((n, p) => n + p.seconds, 0), days: points.reduce((n, p) => n + p.days, 0) });
  const when = $derived.by(() => {
    if (picked == null) return period.total;
    const p = points[tip];
    const back = last - tip;
    if (period.unit === 'day') return back === 0 ? 'Oggi' : back === 1 ? 'Ieri' : cap(fmtShort(p.from));
    return back === 0 ? 'Questa settimana' : back === 1 ? 'Una settimana fa' : `${back} settimane fa`;
  });
  const what = $derived.by(() => {
    const p = picked == null ? sum : points[tip];
    if (!p.seconds) return 'niente';
    const time = spell(minutes(p.seconds));
    // Di un giorno solo bastano i minuti; di più giorni, anche in quanti giorni li hai fatti.
    if (picked != null && period.unit === 'day') return time;
    return `${time} in ${p.days === 1 ? '1 giorno' : `${p.days} giorni`}`;
  });

  // Un dito scorre fra i punti; due dita cambiano l'ingrandimento.
  let chart = $state();
  const fingers = new Map();
  let spread = 0;
  const gap = () => {
    const [a, b] = [...fingers.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  };
  function pickAt(clientX) {
    const r = chart.getBoundingClientRect();
    const x = ((clientX - r.left) / r.width) * 320;
    picked = Math.max(0, Math.min(last, Math.round(((x - 8) / 304) * last)));
  }
  /** Il punto scelto prima che arrivasse il primo dito: con due dita non si sceglie, si ingrandisce. */
  let before = null;
  function down(e) {
    clearTimeout(release);
    fingers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (fingers.size === 2) {
      spread = gap();
      picked = before;
    } else if (fingers.size === 1) {
      before = picked;
      pickAt(e.clientX);
    }
  }
  function move(e) {
    if (!fingers.has(e.pointerId)) return;
    fingers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (fingers.size === 1) pickAt(e.clientX);
    else if (fingers.size === 2 && spread > 0) {
      const now = gap();
      if (now > spread * 1.45) {
        zoom(1);
        spread = now;
      } else if (now < spread / 1.45) {
        zoom(-1);
        spread = now;
      }
    }
  }
  // Tolto il dito, il punto scelto resta qualche secondo e poi torna il totale del periodo.
  let release = null;
  function up(e) {
    if (!fingers.delete(e.pointerId)) return;
    spread = 0;
    clearTimeout(release);
    if (!fingers.size) release = setTimeout(() => (picked = null), 4000);
  }
  /** Sul computer: il gesto delle due dita sul trackpad arriva come rotella con Ctrl. */
  let wheelAt = 0;
  function wheel(e) {
    if (!e.ctrlKey) return;
    e.preventDefault();
    if (Date.now() - wheelAt < 350 || Math.abs(e.deltaY) < 2) return;
    wheelAt = Date.now();
    zoom(e.deltaY < 0 ? 1 : -1);
  }
  function keys(e) {
    // La prima freccia sceglie l'ultimo punto (oggi, o questa settimana); Esc torna al totale.
    if (e.key === 'ArrowLeft') picked = picked == null ? last : Math.max(0, tip - 1);
    else if (e.key === 'ArrowRight') picked = picked == null ? last : Math.min(last, tip + 1);
    else if (e.key === 'Escape' && picked != null) picked = null;
    else if (e.key === '+' || e.key === '=') zoom(1);
    else if (e.key === '-') zoom(-1);
    else return;
    e.preventDefault();
  }
  $effect(() => {
    // La rotella va ascoltata «non passiva» per poter fermare lo zoom della pagina.
    const el = chart;
    if (!el) return;
    el.addEventListener('wheel', wheel, { passive: false });
    return () => el.removeEventListener('wheel', wheel);
  });
</script>

<div class="page enter progress">
  <PageHead title="Progressi" />

  <div class="tiles">
    <div class="tile">
      <Flame size={22} on={streak > 0} />
      <b class="t-num">{streak}</b>
      <span>{streak === 1 ? 'settimana' : 'settimane'} di fila</span>
    </div>
    <div class="tile">
      <Timer size={22} strokeWidth={2.4} />
      <b class="t-num">{spent.n}</b>
      <span>{spent.unit} di lavoro</span>
    </div>
    <div class="tile">
      <ListChecks size={22} strokeWidth={2.4} />
      <b class="t-num">{all.days}</b>
      <span>{all.days === 1 ? 'giorno' : 'giorni'} di allenamento</span>
    </div>
  </div>

  <div class="cards">
    <!-- Il lavoro nel tempo: un punto per giorno (settimana e mese) o per settimana (tre mesi).
         Un dito scorre fra i punti, due dita (o i tre nomi) cambiano l'ingrandimento. -->
    <section class="card">
      <div class="spread">
        <h2 class="t-name">Andamento</h2>
        <span class="small muted">{period.unit === 'day' ? 'minuti al giorno' : 'minuti a settimana'}</span>
      </div>
      <Segmented small options={ZOOMS} value={scale} onchange={setScale} />
      <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
      <div
        class="chart"
        bind:this={chart}
        role="group"
        tabindex="0"
        aria-label="Minuti di lavoro, {period.span}. Frecce per scorrere, più e meno per ingrandire"
        onpointerdown={down}
        onpointermove={move}
        onpointerup={up}
        onpointercancel={up}
        onpointerleave={up}
        onkeydown={keys}
      >
        {#key scale}
          <svg viewBox="0 0 320 116" aria-hidden="true" in:fade={{ duration: 220 }}>
            <path d="M8 100H312M8 58H312M8 16H312" stroke="var(--line)" stroke-width="1" />
            <polygon points="8,100 {line} 312,100" fill="var(--accent)" opacity="0.16" />
            <polyline points={line} fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linejoin="round" />
            {#each points as p, i (p.from)}
              {#if picked != null && tip === i}
                <path d="M{X(i)} 16V100" stroke="var(--line-strong)" stroke-width="1" />
                <circle cx={X(i)} cy={Y(p.minutes)} r="6" fill="var(--accent)" stroke="var(--card)" stroke-width="2" />
              {:else if !dense || p.minutes}
                <circle cx={X(i)} cy={Y(p.minutes)} r={dense ? 2.5 : 4} fill="var(--card)" stroke="var(--accent)" stroke-width={dense ? 2 : 2.5} />
              {/if}
            {/each}
          </svg>
        {/key}
        <span class="top-l t-num">{top} min</span>
      </div>
      <div class="spread axis small muted">
        <span>{cap(fmtShort(points[0].from))}</span>
        <span>{period.unit === 'day' ? 'Oggi' : 'Questa settimana'}</span>
      </div>
      <span class="muted small tip" aria-live="polite">{when}: <b class="ink">{what}</b></span>
    </section>

    {#if routine && goals.length}
      <section class="card">
        <div>
          <h2 class="t-name">Questa settimana</h2>
          <p class="small muted">{routine.name} · {routine.perWeek} {routine.perWeek === 1 ? 'volta' : 'volte'} a settimana</p>
        </div>
        <div class="goals">
          {#each goals as g (g.id)}
            {@const full = g.have >= g.target}
            <div class="goal" data-cat={g.cat}>
              <span class="g-name"><i></i><span>{g.name}</span></span>
              <span class="g-val t-num">
                {#if full}<span class="ok"><Check size={15} strokeWidth={3.2} /></span>{/if}
                <b>{amount(g, g.have)}</b> / {amount(g, g.target)}{g.unit === 'sets' ? ' serie' : ''}{g.perSide ? ' per lato' : ''}
              </span>
              <span class="g-bar" role="progressbar" aria-label={g.name} aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round(Math.min(1, g.have / g.target) * 100)}>
                <i style:width="{Math.min(100, (g.have / g.target) * 100)}%"></i>
              </span>
            </div>
          {/each}
        </div>
      </section>
    {/if}

    {#if loads.length}
      <section class="card">
        <h2 class="t-name">Carichi</h2>
        <div class="loads">
          {#each loads as l (l.name)}
            <div class="load" data-cat={l.cat}>
              <i class="dot"></i>
              <span class="grow">
                <span class="clip">{l.name}</span>
                <span class="small muted block">{l.points.length} {l.points.length === 1 ? 'volta' : 'volte'} · massimo {kg(l.best)}</span>
              </span>
              {#if l.prev != null && l.last !== l.prev}
                <span class="tag {l.last > l.prev ? 'up' : 'down'}">
                  {#if l.last > l.prev}<TrendingUp size={14} strokeWidth={2.6} /> +{kg(Math.round((l.last - l.prev) * 100) / 100)}{:else}<TrendingDown size={14} strokeWidth={2.6} /> −{kg(Math.round((l.prev - l.last) * 100) / 100)}{/if}
                </span>
              {/if}
              <b class="t-num">{kg(l.last)}</b>
            </div>
          {/each}
        </div>
      </section>
    {/if}

    {#if !app.sessions.length}
      <p class="muted small hint">Dopo la prima seduta, qui vedi come va: quanto ti alleni, a che punto sei con gli obiettivi della settimana, i chili che usi.</p>
    {/if}
  </div>
</div>

<style>
  .tiles {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
    margin: 16px 0 12px;
  }
  .tile {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
    min-width: 0;
    padding: 14px 12px 12px;
    border-radius: var(--r-card);
    background: var(--card);
    box-shadow: var(--shadow-card);
    color: var(--accent-ink);
  }
  .tile b {
    margin-top: 6px;
    font-size: 30px;
    font-weight: 600;
    letter-spacing: -0.04em;
    line-height: 1;
    color: var(--ink);
  }
  .tile span {
    font-size: 12.5px;
    font-weight: 600;
    line-height: 1.25;
    color: var(--ink-2);
  }
  .cards {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .card {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .clip {
    display: block;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* Gli obiettivi: il nome con il colore della categoria, quanto hai fatto su quanto serve, la barra. */
  .goals {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .goal {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: baseline;
    gap: 6px 12px;
  }
  .g-name {
    display: flex;
    align-items: baseline;
    gap: 8px;
    min-width: 0;
    font-weight: 600;
    line-height: 1.25;
  }
  .g-name i,
  .dot {
    flex: none;
    width: 10px;
    height: 10px;
    border-radius: 3px;
    background: var(--f);
  }
  .g-val {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 13px;
    color: var(--ink-2);
    white-space: nowrap;
  }
  .g-val b {
    color: var(--ink);
    font-weight: 700;
  }
  .ok {
    display: grid;
    color: var(--ok);
  }
  .g-bar {
    grid-column: 1 / -1;
    height: 8px;
    border-radius: 4px;
    background: var(--sunk);
    overflow: hidden;
  }
  .g-bar i {
    display: block;
    height: 100%;
    border-radius: 4px;
    background: var(--f);
    transition: width var(--dur-slow) var(--ease);
  }

  /* Il grafico tiene per sé i gesti orizzontali e quelli a due dita; in verticale la pagina scorre. */
  .chart {
    position: relative;
    touch-action: pan-y;
    user-select: none;
    -webkit-user-select: none;
    cursor: pointer;
    border-radius: 8px;
  }
  .chart:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 4px;
  }
  .chart svg {
    display: block;
    width: 100%;
    height: auto;
    overflow: visible;
  }
  /* Quanto vale la riga più alta, appoggiato sopra di lei. */
  .top-l {
    position: absolute;
    top: 0;
    left: 2.5%;
    font-size: 11px;
    font-weight: 600;
    line-height: 1;
    color: var(--ink-3);
  }
  .axis {
    margin-top: -8px;
    padding: 0 2.5%;
  }
  .tip {
    padding-top: 12px;
    border-top: 1px solid var(--line);
  }
  .ink {
    color: var(--ink);
  }

  .loads {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .load {
    display: flex;
    align-items: center;
    gap: 12px;
    font-weight: 600;
  }
  .load .grow {
    min-width: 0;
  }
  .load .small {
    font-weight: 400;
  }
  .load .dot {
    border-radius: 50%;
  }
  .load b {
    font-size: 18px;
    font-weight: 750;
    white-space: nowrap;
  }
  .hint {
    padding: 4px 2px;
  }
</style>
