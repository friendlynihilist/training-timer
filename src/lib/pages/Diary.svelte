<script>
  // «Diario»: il mese con un pallino nei giorni in cui ti sei allenato e, sotto, le sedute.
  // Toccando un giorno restano solo le sue; toccandolo di nuovo torna il mese intero.
  import ChevronLeft from '@lucide/svelte/icons/chevron-left';
  import ChevronRight from '@lucide/svelte/icons/chevron-right';
  import Timer from '@lucide/svelte/icons/timer';
  import { app } from '../store.svelte.js';
  import { ui } from '../ui.svelte.js';
  import { iso, parse, fmtMonth, fmtLong, fmtRelative, WEEKDAYS_MIN } from '../dates.js';
  import PageHead from '../ui/PageHead.svelte';
  import { FEEL } from '../ui/FeelPicker.svelte';

  // Si può arrivare qui su un giorno preciso (#/diario/2026-11-23), dalla settimana di Oggi.
  const asked = $derived(/^\d{4}-\d{2}-\d{2}$/.test(ui.route.params[0] ?? '') ? ui.route.params[0] : null);
  // svelte-ignore state_referenced_locally
  let picked = $state(asked);
  // svelte-ignore state_referenced_locally
  let month = $state(monthOf(asked ?? app.today));

  function monthOf(date) {
    const d = parse(date);
    return { y: d.getFullYear(), m: d.getMonth() };
  }
  const here = $derived(monthOf(app.today));
  const away = $derived(month.y !== here.y || month.m !== here.m);

  function shift(by) {
    const d = new Date(month.y, month.m + by, 1, 12);
    month = { y: d.getFullYear(), m: d.getMonth() };
    picked = null;
  }
  function toToday() {
    month = here;
    picked = null;
  }

  // La griglia: i giorni del mese, preceduti dai vuoti fino al lunedì.
  const cells = $derived.by(() => {
    const first = new Date(month.y, month.m, 1, 12);
    const lead = (first.getDay() + 6) % 7;
    const days = new Date(month.y, month.m + 1, 0).getDate();
    return [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => iso(new Date(month.y, month.m, i + 1, 12)))];
  });
  const prefix = $derived(`${month.y}-${String(month.m + 1).padStart(2, '0')}`);
  const inMonth = $derived(app.history.filter((s) => s.date.startsWith(prefix)));
  const count = $derived(Map.groupBy(inMonth, (s) => s.date));
  const shown = $derived(picked ? inMonth.filter((s) => s.date === picked) : inMonth);
  const minutes = $derived(Math.round(inMonth.reduce((a, s) => a + s.seconds, 0) / 60));
</script>

<div class="page enter diary">
  <PageHead title="Diario" />

  <section class="card cal">
    <div class="cal-top">
      <span class="t-name grow month">{fmtMonth(month.y, month.m)}</span>
      {#if away}<button class="btn small" onclick={toToday}>Oggi</button>{/if}
      <button class="icon-btn" onclick={() => shift(-1)} aria-label="Mese prima"><ChevronLeft size={20} /></button>
      <button class="icon-btn" onclick={() => shift(1)} aria-label="Mese dopo"><ChevronRight size={20} /></button>
    </div>
    <div class="grid names" aria-hidden="true">
      {#each WEEKDAYS_MIN as d, i (i)}<small>{d}</small>{/each}
    </div>
    <div class="grid">
      {#each cells as date, i (date ?? `v${i}`)}
        {#if date}
          {@const n = count.get(date)?.length ?? 0}
          <button class="day" class:today={date === app.today} class:on={date === picked} class:has={n > 0} onclick={() => (picked = picked === date ? null : date)} aria-pressed={date === picked} aria-label="{fmtLong(date)}{n ? `, ${n} ${n === 1 ? 'seduta' : 'sedute'}` : ''}">
            <span class="t-num">{Number(date.slice(8))}</span>
            <i></i>
          </button>
        {:else}
          <span></span>
        {/if}
      {/each}
    </div>
  </section>

  <section class="section">
    <h2 class="heading">
      {#if picked}<span class="cap">{fmtLong(picked)}</span>{:else}{`${inMonth.length} ${inMonth.length === 1 ? 'seduta' : 'sedute'} nel mese${minutes ? ` · ${minutes} min` : ''}`}{/if}
    </h2>
    {#if shown.length}
      <div class="card flush list">
        {#each shown as s (s.id)}
          <button class="item" onclick={() => ui.open('session', { id: s.id })}>
            <span class="grow">
              <span class="spread"><strong>{s.name}</strong><span class="small muted cap">{fmtRelative(s.date, app.today)}</span></span>
              <span class="meta small muted">
                <span class="t-num"><Timer size={14} strokeWidth={2.4} /> {Math.round(s.seconds / 60)} min</span>
                <span>{s.items.length} {s.items.length === 1 ? 'esercizio' : 'esercizi'}</span>
                {#if s.feel}<span>{FEEL[s.feel - 1]}</span>{/if}
              </span>
              {#if s.note}<span class="small note">{s.note}</span>{/if}
            </span>
            <span class="muted"><ChevronRight size={18} /></span>
          </button>
        {/each}
      </div>
    {:else}
      <p class="muted empty">{picked ? 'Nessuna seduta in questo giorno.' : app.sessions.length ? 'Nessuna seduta in questo mese.' : 'Le sedute che finisci compaiono qui.'}</p>
    {/if}
  </section>
</div>

<style>
  .cal {
    margin-top: 16px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .cal-top {
    display: flex;
    align-items: center;
    gap: 2px;
    margin-right: -8px;
  }
  .month::first-letter,
  .cap::first-letter {
    text-transform: uppercase;
  }
  .cap {
    display: inline-block;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 2px;
    text-align: center;
  }
  .names small {
    font-size: 11px;
    font-weight: 700;
    color: var(--ink-2);
  }
  .day {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
    height: 44px;
    border-radius: 12px;
    font-weight: 600;
    color: var(--ink);
  }
  .day i {
    width: 6px;
    height: 6px;
    border-radius: 50%;
  }
  .day.has i {
    background: var(--ok);
  }
  .day.today {
    box-shadow: inset 0 0 0 2px var(--accent);
  }
  .day.on {
    background: var(--ink);
    color: var(--paper);
    box-shadow: none;
  }
  strong {
    font-weight: 650;
  }
  .meta {
    display: flex;
    flex-wrap: wrap;
    gap: 2px 12px;
    margin-top: 2px;
  }
  .meta span {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }
  .note {
    display: block;
    margin-top: 4px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .item .grow {
    min-width: 0;
  }
  .empty {
    padding: 4px 2px;
  }
</style>
