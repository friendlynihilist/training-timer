<script>
  // Una seduta del diario: quanto è durata, cosa hai fatto esercizio per esercizio, com'è andata.
  import Timer from '@lucide/svelte/icons/timer';
  import ListChecks from '@lucide/svelte/icons/list-checks';
  import { app } from '../store.svelte.js';
  import { ui } from '../ui.svelte.js';
  import { fmtDur } from '../model.js';
  import { fmtLong } from '../dates.js';
  import Sheet from '../ui/Sheet.svelte';
  import { FEEL } from '../ui/FeelPicker.svelte';

  let { id } = $props();
  const session = $derived(app.sessions.find((s) => s.id === id));
  const minutes = $derived(session ? Math.round(session.seconds / 60) : 0);

  const kg = (v) => `${String(v).replace('.', ',')} kg`;
  /** Quanto hai fatto di un esercizio: il tempo, oppure le serie (con il carico, se c'è). */
  function amount(x) {
    if (x.kind === 'time') return fmtDur(x.seconds);
    // Con due lati, una serie fatta da una parte sola è mezza serie.
    const sets = x.sides ? x.sets / 2 : x.sets;
    const text = `${Math.floor(sets) || (sets % 1 ? '' : '0')}${sets % 1 ? '½' : ''} serie`;
    return x.load != null ? `${text} · ${kg(x.load)}` : text;
  }

  function remove() {
    const removed = app.removeSession(id);
    ui.close();
    if (removed) ui.toast('Seduta eliminata', { action: { label: 'Annulla', run: () => app.restoreSession(removed) } });
  }
</script>

{#if session}
  <Sheet title={session.name} onclose={() => ui.close()}>
    <p class="date muted">{fmtLong(session.date)}</p>

    <div class="stats">
      <div class="stat"><Timer size={20} strokeWidth={2.4} /><b class="t-num">{minutes}</b><span>{minutes === 1 ? 'minuto' : 'minuti'} di lavoro</span></div>
      <div class="stat"><ListChecks size={20} strokeWidth={2.4} /><b class="t-num">{session.items.length}</b><span>{session.items.length === 1 ? 'esercizio' : 'esercizi'}</span></div>
    </div>

    <div class="card flush list items">
      {#each session.items as x, i (i)}
        <div class="res" data-cat={x.cat}>
          <i class="dot"></i>
          <span class="grow">{x.name}{#if x.sets < x.of}<span class="small muted block">Non finito</span>{/if}</span>
          <span class="t-num small">{amount(x)}</span>
        </div>
      {/each}
    </div>

    {#if session.feel}
      <p class="line"><span class="t-label muted">Sensazione</span><span>{FEEL[session.feel - 1]}</span></p>
    {/if}
    {#if session.note}
      <p class="line"><span class="t-label muted">Nota</span><span class="note">{session.note}</span></p>
    {/if}

    {#snippet footer()}
      <button class="btn plain wide danger-txt" onclick={remove}>Elimina dal diario</button>
    {/snippet}
  </Sheet>
{/if}

<style>
  .date::first-letter {
    text-transform: uppercase;
  }
  .stats {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
    margin: 14px 0 12px;
  }
  .stat {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
    padding: 14px 14px 12px;
    border-radius: var(--r-card);
    background: var(--card);
    box-shadow: var(--shadow-card);
    color: var(--accent-ink);
  }
  .stat b {
    margin-top: 6px;
    font-size: 30px;
    font-weight: 600;
    letter-spacing: -0.04em;
    line-height: 1;
    color: var(--ink);
  }
  .stat span {
    font-size: 12.5px;
    font-weight: 600;
    color: var(--ink-2);
  }
  .res {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 13px 16px;
  }
  .dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--f);
    flex: none;
  }
  .line {
    display: flex;
    flex-direction: column;
    gap: 2px;
    margin-top: 14px;
  }
  .note {
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
  .danger-txt {
    color: var(--down);
  }
</style>
