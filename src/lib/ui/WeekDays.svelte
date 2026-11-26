<script>
  // La settimana in sette cerchi: verde con la spunta nei giorni in cui ti sei allenato (anche
  // solo un pezzo di routine), oggi in evidenza. Sopra, i giorni fatti su quelli previsti. Toccando un giorno si apre il Diario.
  import Check from '@lucide/svelte/icons/check';
  import { app } from '../store.svelte.js';
  import { ui } from '../ui.svelte.js';
  import { weekDays, daysThisWeek } from '../stats.js';
  import { WEEKDAYS_MIN } from '../dates.js';

  let { perWeek = 0 } = $props();

  const days = $derived(weekDays(app.sessions, app.today));
  const have = $derived(daysThisWeek(app.sessions, app.today));
</script>

<div class="week">
  <div class="spread">
    <span class="t-name">Questa settimana</span>
    {#if perWeek}<span class="count t-num" class:ok={have >= perWeek}>{have} su {perWeek}</span>{/if}
  </div>

  {#if perWeek}
    <div class="segs" aria-hidden="true">
      {#each Array(perWeek) as _, k (k)}<i class:past={k < have}></i>{/each}
    </div>
  {/if}

  <div class="grid">
    {#each days as d, i (d.date)}
      <button class="day" class:today={d.today} class:done={d.done} onclick={() => ui.go('diario', d.date)} aria-label="{d.name} {d.n}: {d.done ? 'fatto' : 'niente'}">
        <small>{WEEKDAYS_MIN[i]}</small>
        <span class="dot">{#if d.done}<Check size={16} strokeWidth={3.2} />{/if}</span>
      </button>
    {/each}
  </div>
</div>

<style>
  .week {
    display: flex;
    flex-direction: column;
    gap: 12px;
    width: 100%;
    padding: 16px;
    border-radius: var(--r-card);
    background: var(--card);
    box-shadow: var(--shadow-card);
  }
  .count {
    font-weight: 700;
    color: var(--ink-2);
  }
  .count.ok {
    color: var(--ok);
  }
  .segs {
    display: flex;
    gap: 4px;
  }
  .segs i {
    flex: 1 1 0;
    height: 6px;
    border-radius: 3px;
    background: var(--sunk);
  }
  .segs i.past {
    background: var(--ok);
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 4px;
    text-align: center;
  }
  .day {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    color: var(--ink);
  }
  small {
    font-size: 11px;
    font-weight: 700;
    line-height: 1.5;
    color: var(--ink-2);
  }
  .dot {
    display: grid;
    place-items: center;
    width: 30px;
    height: 30px;
    border-radius: 50%;
    background: var(--sunk);
    color: #fff;
  }
  .done .dot {
    background: var(--ok);
  }
  .today .dot {
    outline: 2px solid var(--ink);
    outline-offset: 2px;
  }
</style>
