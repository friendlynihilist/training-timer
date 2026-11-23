<script>
  // Gli esercizi di una routine, uno sotto l'altro: il colore, il nome, il volume e la durata.
  // Più dura, più è alto. Solo da leggere: per cambiarli c'è il costruttore.
  import { app } from '../store.svelte.js';
  import { exerciseSpans, fmtDur, volumeText } from '../model.js';

  let { routine } = $props();
  const spans = $derived(exerciseSpans(routine, app.opts));
</script>

<div class="stack-b">
  {#each routine.exercises as ex, i (ex.id)}
    <div class="b" data-cat={ex.cat} style:min-height="{Math.max(52, Math.round(spans[i] / 5))}px">
      <span class="grow">
        <b>{ex.name}</b>
        <small>{volumeText(ex)}{ex.note ? ` · ${ex.note}` : ''}</small>
      </span>
      <span class="b-m">{fmtDur(spans[i])}</span>
    </div>
  {/each}
</div>

<style>
  .stack-b {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }
  .b {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 14px;
    border-radius: 16px;
    background: var(--f);
    color: var(--f-on);
    box-shadow: 0 4px 0 var(--f-edge);
  }
  .b b {
    display: block;
    font-weight: 750;
  }
  .b small {
    display: block;
    font-size: 13px;
    opacity: 0.9;
  }
  .b-m {
    flex: none;
    font-size: 18px;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
  }
</style>
