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
  import { weekStreak, totals, activity, minutes, PERIODS, weeklyGoals, loadHistory, repHistory } from '../stats.js';
  import { fmtDur, TYPES } from '../model.js';
  import TypeTag from '../ui/TypeTag.svelte';
  import { fmtShort, fmtLong } from '../dates.js';
  import { ui, buzz } from '../ui.svelte.js';
  import PageHead from '../ui/PageHead.svelte';
  import Segmented from '../ui/Segmented.svelte';
  import Flame from '../ui/Flame.svelte';

  const streak = $derived(weekStreak(app.sessions, app.today));
  const all = $derived(totals(app.sessions));
  // Gli obiettivi della settimana, routine per routine: prima quella di Oggi.
  const plans = $derived(
    [...app.routines]
      .sort((a, b) => (b.id === app.activeId) - (a.id === app.activeId))
      .map((routine) => ({ routine, goals: weeklyGoals(routine, app.sessions, app.today) }))
      .filter((p) => p.goals.length)
  );
  const loads = $derived(loadHistory(app.sessions));
  const reps = $derived(repHistory(app.sessions));

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
  // Una linea sola: il totale di ogni giorno (o settimana), qualunque routine tu abbia fatto. Il
  // tipo di routine è il colore del punto: così due giorni di fila con routine diverse restano due
  // punti sulla stessa linea, e non due linee che salgono e scendono per conto loro.
  const kinds = $derived(TYPES.filter((t) => app.routines.some((r) => r.type === t.id) || points.some((p) => p.by[t.id] > 0)));
  // La cima del grafico sta un po' sopra il valore più alto, per lasciare posto al numero sul punto.
  const top = $derived.by(() => {
    const m = Math.max(10, ...points.map((p) => p.minutes)) * 1.2;
    return m <= 60 ? Math.ceil(m / 10) * 10 : Math.ceil(m / 30) * 30;
  });
  const X = (i) => 8 + i * (304 / Math.max(1, last));
  const Y = (v) => 100 - (v / top) * 84;
  const line = $derived(points.map((p, i) => `${X(i)},${Y(p.minutes)}`).join(' '));
  const dense = $derived(points.length > 16);
  /** I tipi di un punto, dal più presente: il primo dà il colore al punto, il secondo al suo centro. */
  const typesAt = (p) => TYPES.filter((t) => p.sec[t.id] > 0).sort((a, b) => p.sec[b.id] - p.sec[a.id]).map((t) => t.id);
  // I minuti scritti sopra i punti: tutti quando c'è posto; nel mese, dove due numeri vicini si
  // toccherebbero, uno sì e uno no partendo dal punto scelto e poi dal più recente.
  const labelled = $derived.by(() => {
    const out = new Set();
    const room = (i) => !dense || ![...out].some((k) => Math.abs(k - i) < 3);
    if (picked != null && points[tip].minutes) out.add(tip);
    for (let i = last; i >= 0; i--) if (points[i].minutes && !out.has(i) && room(i)) out.add(i);
    return out;
  });
  /** I minuti di un tipo: del punto scelto, o di tutto il periodo. */
  const share = (id) => minutes(picked == null ? points.reduce((n, p) => n + p.sec[id], 0) : points[tip].sec[id]);

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

  // Sotto il grafico, il totale giorno per giorno (o settimana per settimana): solo i giorni in cui
  // ti sei allenato, dal più recente.
  const rows = $derived(
    points
      .map((p, i) => ({ ...p, back: last - i, types: typesAt(p) }))
      .filter((p) => p.seconds > 0)
      .reverse()
  );
  let allRows = $state(false);
  const shownRows = $derived(allRows ? rows : rows.slice(0, 7));
  function rowName(p) {
    if (period.unit === 'day') return p.back === 0 ? 'Oggi' : p.back === 1 ? 'Ieri' : cap(fmtLong(p.from));
    return p.back === 0 ? 'Questa settimana' : `Settimana del ${fmtShort(p.from)}`;
  }

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
      <span>{spent.unit} di allenamento</span>
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
        aria-label="Minuti di allenamento, {period.span}. Frecce per scorrere, più e meno per ingrandire"
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
            {#if picked != null}<path d="M{X(tip)} 16V100" stroke="var(--line-strong)" stroke-width="1" />{/if}
            <polygon points="8,100 {line} 312,100" fill="var(--ink-3)" opacity="0.14" />
            <polyline points={line} fill="none" stroke="var(--ink-2)" stroke-width="2" stroke-linejoin="round" />
            {#each points as p, i (p.from)}
              {@const types = typesAt(p)}
              {@const on = picked != null && tip === i}
              {#if types.length}
                <!-- Il punto ha il colore del tipo di routine di quel giorno; se sono due, il secondo sta al centro. -->
                <circle cx={X(i)} cy={Y(p.minutes)} r={on ? 6.5 : dense ? 4 : 5} data-type={types[0]} fill="var(--t)" stroke="var(--card)" stroke-width="2" />
                {#if types[1]}<circle cx={X(i)} cy={Y(p.minutes)} r={on ? 2.8 : 2} data-type={types[1]} fill="var(--t)" stroke="var(--card)" stroke-width="1" />{/if}
                {#if labelled.has(i)}
                  <text x={X(i)} y={Y(p.minutes) - (on ? 11 : 9)} text-anchor="middle" class="val" class:on>{p.minutes}</text>
                {/if}
              {:else if !dense || on}
                <circle cx={X(i)} cy={Y(0)} r="3" fill="var(--card)" stroke="var(--line-strong)" stroke-width="2" />
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
      <div class="tip" aria-live="polite">
        <span class="muted small">{when}: <b class="ink">{what}</b></span>
        <!-- La legenda: ogni tipo con il suo colore e i suoi minuti (del periodo, o del punto scelto). -->
        {#if kinds.length > 1}
          <div class="legend">
            {#each kinds as t (t.id)}
              <span class="key" data-type={t.id}><i></i>{t.name}<b class="t-num">{share(t.id) ? spell(share(t.id)) : 'niente'}</b></span>
            {/each}
          </div>
        {/if}
      </div>

      {#if rows.length}
        <div class="days">
          <h3 class="t-label muted">{period.unit === 'day' ? 'Giorno per giorno' : 'Settimana per settimana'}</h3>
          {#each shownRows as p (p.from)}
            <svelte:element this={period.unit === 'day' ? 'button' : 'div'} class="drow" onclick={period.unit === 'day' ? () => ui.go('diario', p.from) : null} role={period.unit === 'day' ? undefined : 'group'}>
              <span class="grow">
                <span class="d-name">{rowName(p)}</span>
                <span class="d-types small muted">
                  {#each p.types as id (id)}
                    <span class="key" data-type={id}><i></i>{TYPES.find((t) => t.id === id).name}{#if p.types.length > 1}<b class="t-num">{p.by[id]} min</b>{/if}</span>
                  {/each}
                  {#if period.unit === 'week'}<span>{p.days === 1 ? '1 giorno' : `${p.days} giorni`}</span>{/if}
                </span>
              </span>
              <b class="d-min t-num">{p.minutes}<small> min</small></b>
            </svelte:element>
          {/each}
          {#if rows.length > 7}
            <button class="more small" onclick={() => (allRows = !allRows)}>{allRows ? 'Mostra meno' : `Mostra tutti${period.unit === 'day' ? ` i ${rows.length} giorni` : ` le ${rows.length} settimane`}`}</button>
          {/if}
        </div>
      {/if}
    </section>

    {#each plans as { routine, goals } (routine.id)}
      <section class="card">
        <div class="g-head">
          <div class="grow">
            <h2 class="t-name">{routine.name}</h2>
            <p class="small muted">Questa settimana · {routine.perWeek} {routine.perWeek === 1 ? 'volta' : 'volte'}</p>
          </div>
          <TypeTag type={routine.type} />
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
    {/each}

    {#if reps.length}
      <!-- Le ripetizioni segnate negli esercizi con una forbice: l'ultima volta serie per serie, e
           l'avviso quando sei al massimo in tutte le serie. -->
      <section class="card" data-type="ipertrofia">
        <div class="g-head">
          <div class="grow">
            <h2 class="t-name">Ripetizioni</h2>
            <p class="small muted">L’ultima volta, serie per serie</p>
          </div>
          <TypeTag type="ipertrofia" />
        </div>
        <div class="loads">
          {#each reps as r (r.name)}
            {@const diff = r.prev ? r.last.total - r.prev.total : 0}
            <div class="rep">
              <span class="grow">
                <span class="rep-name">{r.name}</span>
                <span class="small muted block">{r.range ? `Forbice ${r.range[0]}–${r.range[1]} · ` : ''}{r.points.length} {r.points.length === 1 ? 'volta' : 'volte'}</span>
              </span>
              {#if diff}
                <span class="tag {diff > 0 ? 'up' : 'down'}">
                  {#if diff > 0}<TrendingUp size={14} strokeWidth={2.6} /> +{diff}{:else}<TrendingDown size={14} strokeWidth={2.6} /> −{-diff}{/if}
                </span>
              {/if}
              <b class="t-num sets">{r.last.each.join(' · ')}</b>
              {#if r.range}
                <!-- Ogni serie come una barra dentro la forbice: piena quando sei al massimo. -->
                <span class="marks" aria-hidden="true">
                  {#each r.last.each as n, k (k)}
                    <i><u style:width="{Math.max(8, Math.min(100, ((n - r.range[0] + 1) / (r.range[1] - r.range[0] + 1)) * 100))}%"></u></i>
                  {/each}
                </span>
              {/if}
              {#if r.top}<span class="top-note small"><Check size={15} strokeWidth={3.2} /> Sei al massimo in tutte le serie: aumenta la difficoltà.</span>{/if}
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
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding-top: 12px;
    border-top: 1px solid var(--line);
  }
  /* I minuti scritti sopra i punti. */
  .val {
    font-size: 11px;
    font-weight: 700;
    fill: var(--ink-2);
    font-variant-numeric: tabular-nums;
  }
  .val.on {
    font-size: 12px;
    fill: var(--ink);
  }
  /* Il totale giorno per giorno. */
  .days {
    display: flex;
    flex-direction: column;
    padding-top: 12px;
    border-top: 1px solid var(--line);
  }
  .days h3 {
    margin: 0 0 4px;
  }
  .drow {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 52px;
    padding: 6px 0;
    text-align: left;
  }
  .drow + .drow {
    border-top: 1px solid var(--line);
  }
  .d-name {
    display: block;
    font-weight: 650;
  }
  .d-types {
    display: flex;
    flex-wrap: wrap;
    gap: 2px 12px;
  }
  .d-min {
    font-size: 20px;
    font-weight: 750;
    white-space: nowrap;
  }
  .d-min small {
    margin-left: 3px;
    font-size: 13px;
    font-weight: 600;
    color: var(--ink-2);
  }
  .more {
    align-self: flex-start;
    min-height: 40px;
    font-weight: 650;
    color: var(--accent-ink);
  }
  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 18px;
  }
  .key {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    color: var(--ink-2);
  }
  .key i {
    width: 10px;
    height: 10px;
    border-radius: 3px;
    background: var(--t);
  }
  .key b {
    color: var(--ink);
    font-weight: 700;
  }
  .g-head {
    display: flex;
    align-items: flex-start;
    gap: 10px;
  }
  /* Le ripetizioni: nome e serie sulla prima riga, sotto una barra per serie dentro la forbice. */
  .rep {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 12px;
    font-weight: 600;
  }
  .rep .grow {
    min-width: 0;
    flex: 1 1 8em;
  }
  .rep .small {
    font-weight: 400;
  }
  .sets {
    font-size: 17px;
    font-weight: 750;
    white-space: nowrap;
  }
  .marks {
    display: flex;
    gap: 4px;
    flex: 1 0 100%;
  }
  .marks i {
    flex: 1 1 0;
    height: 8px;
    border-radius: 4px;
    background: var(--sunk);
    overflow: hidden;
  }
  .marks u {
    display: block;
    height: 100%;
    border-radius: 4px;
    background: var(--t);
  }
  .top-note {
    display: flex;
    align-items: center;
    gap: 6px;
    flex: 1 0 100%;
    color: var(--ok);
    font-weight: 600;
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
