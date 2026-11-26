<script>
  // Gli esercizi di una routine, uno sotto l'altro: il colore, il nome, il volume e la durata.
  // Più dura, più è alto. Se la routine è fatta a blocchi (riscaldamento, circuiti) ogni blocco ha il
  // suo titolo, con i giri e i recuperi. Toccando un esercizio si legge come si fa. Solo da leggere:
  // per cambiarli c'è il costruttore.
  import ChevronDown from '@lucide/svelte/icons/chevron-down';
  import { slide } from 'svelte/transition';
  import { app } from '../store.svelte.js';
  import { exerciseSpans, blocksOf, fmtDur, volumeText } from '../model.js';

  let { routine } = $props();
  const spans = $derived(exerciseSpans(routine, app.opts));
  const blocks = $derived(blocksOf(routine));
  let open = $state(null);

  /** Sotto il titolo di un circuito: i giri e i recuperi. */
  function about(b) {
    const first = routine.exercises[b.items[0]];
    const bits = [`${b.rounds} ${b.rounds === 1 ? 'giro' : 'giri'}`];
    bits.push(`${fmtDur(first.rest ?? app.opts.rest)} fra gli esercizi`);
    if (first.roundRest != null) bits.push(`${fmtDur(first.roundRest)} a fine giro`);
    return bits.join(' · ');
  }
</script>

<div class="stack-b">
  {#each blocks as b, n (n)}
    {#if b.name}
      <div class="bl" class:first={n === 0}>
        <b>{b.name}</b>
        {#if b.circuit}<span class="small muted">{about(b)}</span>{/if}
      </div>
    {/if}
    {#each b.items as i (routine.exercises[i].id)}
      {@const ex = routine.exercises[i]}
      <svelte:element
        this={ex.how ? 'button' : 'div'}
        class="b"
        data-cat={ex.cat}
        style:min-height="{Math.max(52, Math.round(spans[i] / 5))}px"
        onclick={ex.how ? () => (open = open === ex.id ? null : ex.id) : null}
        aria-expanded={ex.how ? open === ex.id : null}
        role={ex.how ? undefined : 'group'}
      >
        <span class="top">
          <span class="grow">
            <b>{ex.name}</b>
            <small>{volumeText(ex)}{ex.note ? ` · ${ex.note}` : ''}</small>
          </span>
          <span class="b-m">{fmtDur(spans[i])}</span>
          {#if ex.how}<span class="chev" class:up={open === ex.id}><ChevronDown size={18} strokeWidth={2.6} /></span>{/if}
        </span>
        {#if ex.how && open === ex.id}
          <span class="how" transition:slide={{ duration: 180 }}>{ex.how}</span>
        {/if}
      </svelte:element>
    {/each}
  {/each}
</div>

<style>
  .stack-b {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }
  .bl {
    display: flex;
    flex-direction: column;
    gap: 1px;
    margin: 14px 2px 3px;
  }
  .bl.first {
    margin-top: 0;
  }
  .bl b {
    font-weight: 750;
  }
  .b {
    display: flex;
    flex-direction: column;
    justify-content: center;
    width: 100%;
    padding: 6px 14px;
    border-radius: 16px;
    background: var(--f);
    color: var(--f-on);
    box-shadow: 0 4px 0 var(--f-edge);
    text-align: left;
  }
  .top {
    display: flex;
    align-items: center;
    gap: 10px;
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
  .chev {
    display: grid;
    flex: none;
    opacity: 0.85;
    transition: rotate var(--dur);
  }
  .chev.up {
    rotate: 180deg;
  }
  .how {
    display: block;
    padding: 8px 0 6px;
    font-size: 14px;
    line-height: 1.45;
  }
</style>
