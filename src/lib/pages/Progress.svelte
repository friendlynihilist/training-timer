<script>
  // «Progressi», dal generale al particolare: tre numeri (settimane di fila, tempo, sedute), gli
  // obiettivi della settimana esercizio per esercizio, l'andamento nel tempo, i carichi.
  import Timer from '@lucide/svelte/icons/timer';
  import ListChecks from '@lucide/svelte/icons/list-checks';
  import Check from '@lucide/svelte/icons/check';
  import TrendingUp from '@lucide/svelte/icons/trending-up';
  import TrendingDown from '@lucide/svelte/icons/trending-down';
  import { app } from '../store.svelte.js';
  import { weekStreak, totals, series, weeklyGoals, loadHistory } from '../stats.js';
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
    const m = Math.round(all.seconds / 60);
    return m < 120 ? { n: m, unit: m === 1 ? 'minuto' : 'minuti' } : { n: (m / 60).toFixed(1).replace('.', ',').replace(',0', ''), unit: 'ore' };
  });

  const kg = (v) => `${String(v).replace('.', ',')} kg`;
  /** Quanto, nell'unità dell'obiettivo: un tempo, oppure le serie (mezza, se hai fatto un lato solo). */
  function amount(g, v) {
    if (!v) return '0';
    if (g.unit === 'time') return fmtDur(v);
    return String(Math.floor(v * 2) / 2).replace('.5', '½').replace(/^0½/, '½');
  }

  // ── L'andamento: una barra per giorno (settimana, mese) o per settimana (tre mesi) ──

  const ZOOMS = [
    { id: 'week', label: 'Settimana' },
    { id: 'month', label: 'Mese' },
    { id: 'quarter', label: '3 mesi' }
  ];
  let scale = $state('week');
  /** La barra scelta con il dito o con le frecce; di partenza l'ultima. */
  let tip = $state(null);
  let chart = $state();

  const points = $derived(series(app.sessions, app.today, scale));
  const at = $derived(Math.min(tip ?? points.length - 1, points.length - 1));
  const picked = $derived(points[at]);
  // La cima del grafico: il valore più alto, arrotondato ai dieci minuti (almeno dieci).
  const top = $derived(Math.max(600, Math.ceil(Math.max(...points.map((p) => p.seconds)) / 600) * 600));

  const W = 320;
  const BASE = 100;
  const H = 84;
  const slot = $derived((W - 16) / points.length);
  const bw = $derived(Math.min(22, slot - 2));
  const bars = $derived(
    points.map((p, i) => {
      const h = p.seconds ? Math.max(3, (p.seconds / top) * H) : 0;
      const x = 8 + i * slot + (slot - bw) / 2;
      const r = Math.min(4, bw / 2, h);
      // In alto gli angoli tondi, in basso la barra poggia dritta sulla linea di base.
      const d = h ? `M${x},${BASE}V${BASE - h + r}q0,${-r} ${r},${-r}h${bw - 2 * r}q${r},0 ${r},${r}V${BASE}z` : '';
      return { x, h, d };
    })
  );

  function setScale(v) {
    scale = v;
    tip = null;
  }
  function pick(e) {
    const box = chart.getBoundingClientRect();
    const x = ((e.clientX - box.left) / box.width) * W;
    tip = Math.max(0, Math.min(points.length - 1, Math.floor((x - 8) / slot)));
  }
  function keys(e) {
    if (e.key === 'ArrowLeft') tip = Math.max(0, at - 1);
    else if (e.key === 'ArrowRight') tip = Math.min(points.length - 1, at + 1);
    else return;
    e.preventDefault();
  }
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
      <b class="t-num">{all.count}</b>
      <span>{all.count === 1 ? 'seduta' : 'sedute'}</span>
    </div>
  </div>

  <div class="cards">
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

    <section class="card">
      <div class="spread">
        <h2 class="t-name">Andamento</h2>
        <span class="small muted">minuti di lavoro</span>
      </div>
      <Segmented small options={ZOOMS} value={scale} onchange={setScale} />
      <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
      <div
        class="chart"
        bind:this={chart}
        role="group"
        tabindex="0"
        aria-label="Minuti di lavoro, {ZOOMS.find((z) => z.id === scale).label.toLowerCase()}. Frecce per scorrere"
        onpointerdown={pick}
        onpointermove={(e) => (e.pointerType === 'mouse' || e.buttons) && pick(e)}
        onkeydown={keys}
      >
        <svg viewBox="0 0 {W} 106" aria-hidden="true">
          <path d="M8 {BASE - H}H{W - 8}M8 {BASE - H / 2}H{W - 8}" stroke="var(--line)" stroke-width="1" />
          {#each bars as b, i (points[i].from)}
            {#if i === at}<rect x={8 + i * slot} y={BASE - H - 6} width={slot} height={H + 6} rx="4" fill="var(--sunk)" />{/if}
            {#if b.d}<path d={b.d} fill="var(--accent)" opacity={i === at ? 1 : 0.5} />{/if}
          {/each}
          <path d="M8 {BASE}H{W - 8}" stroke="var(--line-strong)" stroke-width="1" />
        </svg>
        <span class="top-l t-num">{top / 60} min</span>
      </div>
      <div class="spread axis small muted">
        <span>{scale === 'quarter' ? `Dal ${fmtShort(points[0].from)}` : fmtShort(points[0].from)}</span>
        <span>Oggi</span>
      </div>
      <p class="tip" aria-live="polite">
        <span class="muted">{picked.label}</span>
        <b class="t-num">{picked.seconds ? `${Math.max(1, Math.round(picked.seconds / 60))} min` : 'Niente'}</b>
        {#if picked.count > 1}<span class="muted t-num">{picked.count} sedute</span>{/if}
      </p>
    </section>

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

  /* Il grafico tiene per sé i gesti orizzontali; in verticale la pagina scorre. */
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
  }
  .top-l {
    position: absolute;
    top: 0;
    left: 2.5%;
    padding: 0 6px 0 0;
    translate: 0 -55%;
    background: var(--card);
    font-size: 11px;
    font-weight: 600;
    color: var(--ink-3);
  }
  .axis {
    margin-top: -8px;
    padding: 0 2.5%;
  }
  .tip {
    display: flex;
    align-items: baseline;
    gap: 10px;
    padding-top: 12px;
    border-top: 1px solid var(--line);
  }
  .tip b {
    font-size: 18px;
    font-weight: 750;
  }
  .tip .muted:first-child {
    flex: 1;
    min-width: 0;
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
