<script>
  // «Routine»: le tue routine, ognuna con la sua scaletta in segmenti colorati. In fondo, una nuova
  // da costruire o da importare.
  import Timer from '@lucide/svelte/icons/timer';
  import Plus from '@lucide/svelte/icons/plus';
  import Upload from '@lucide/svelte/icons/upload';
  import ChevronRight from '@lucide/svelte/icons/chevron-right';
  import { app } from '../store.svelte.js';
  import { ui } from '../ui.svelte.js';
  import { routineSeconds, exerciseSpans, minutesOf } from '../model.js';
  import PageHead from '../ui/PageHead.svelte';
  import TypeTag from '../ui/TypeTag.svelte';
</script>

<div class="page enter routines">
  <PageHead title="Routine" />

  <div class="cards">
    {#each app.routines as r (r.id)}
      {@const spans = exerciseSpans(r, app.opts)}
      <button class="card r" onclick={() => ui.open('routine', { id: r.id })}>
        <span class="row top">
          <span class="t-name grow">{r.name}</span>
          {#if app.active?.id === r.id}<span class="tag accent">Oggi</span>{/if}
          <span class="dur t-num"><Timer size={16} strokeWidth={2.4} /> {minutesOf(routineSeconds(r, app.opts))} min</span>
        </span>
        {#if r.exercises.length}
          <span class="strip" aria-hidden="true">
            {#each r.exercises as e, i (e.id)}<i data-cat={e.cat} style:flex-grow={spans[i]}></i>{/each}
          </span>
        {/if}
        <span class="row foot">
          <TypeTag type={r.type} />
          <span class="small muted">{r.exercises.length} {r.exercises.length === 1 ? 'esercizio' : 'esercizi'} · {r.perWeek} {r.perWeek === 1 ? 'volta' : 'volte'} a settimana</span>
        </span>
      </button>
    {/each}

    <button class="new" onclick={() => ui.build()}><Plus size={20} strokeWidth={2.6} /> Nuova routine</button>

    <div class="card flush">
      <button class="row-btn" onclick={() => ui.open('import')}>
        <span class="ico"><Upload size={20} /></span>
        <span class="grow"><span class="lbl">Importa una routine</span><span class="sub">Da una tabella incollata o da un file</span></span>
        <ChevronRight size={18} />
      </button>
    </div>
  </div>
</div>

<style>
  .foot {
    gap: 10px;
    flex-wrap: wrap;
  }
  .cards {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-top: 16px;
  }
  .r {
    display: flex;
    flex-direction: column;
    gap: 12px;
    width: 100%;
    text-align: left;
    transition: transform 0.18s var(--ease);
  }
  .r:active {
    transform: scale(0.985);
  }
  .top {
    gap: 8px;
  }
  .dur {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    flex: none;
    font-weight: 700;
    color: var(--ink-2);
  }
  .strip {
    display: flex;
    gap: 3px;
    height: 10px;
  }
  .strip i {
    flex-basis: 0;
    min-width: 6px;
    border-radius: 99px;
    background: var(--f);
  }
  .new {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 64px;
    border: 2px dashed var(--line-strong);
    border-radius: var(--r-card);
    color: var(--accent-ink);
    font-weight: 700;
  }
  .new:active {
    background: var(--sunk);
  }
</style>
