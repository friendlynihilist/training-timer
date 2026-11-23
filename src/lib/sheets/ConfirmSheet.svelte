<script>
  // Una domanda prima di una cosa che non si annulla.
  import { ui } from '../ui.svelte.js';
  import Sheet from '../ui/Sheet.svelte';

  let { title, text = '', label = 'Conferma', danger = false, run } = $props();

  function yes() {
    // Le proprietà spariscono con il foglio: la funzione si prende prima di chiudere.
    const go = run;
    ui.close();
    go?.();
  }
</script>

<Sheet {title} onclose={() => ui.close()}>
  {#if text}<p class="muted">{text}</p>{/if}
  {#snippet footer()}
    <div class="stack g-8">
      <button class="btn wide {danger ? 'no' : 'accent'}" onclick={yes}>{label}</button>
      <button class="btn ghost wide" onclick={() => ui.close()}>Annulla</button>
    </div>
  {/snippet}
</Sheet>

<style>
  .no {
    height: 56px;
    font-size: 17px;
    font-weight: 700;
    background: var(--down);
    color: #fff;
  }
</style>
