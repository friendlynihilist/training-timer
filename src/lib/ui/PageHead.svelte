<script>
  // Intestazione di pagina: il nome della pagina in grande e, sul telefono, l'ingranaggio a destra
  // (apre Impostazioni; su schermi larghi sta già nella colonna di sinistra). Impostazioni ha al suo
  // posto la freccia per tornare indietro.
  import ArrowLeft from '@lucide/svelte/icons/arrow-left';
  import Settings from '@lucide/svelte/icons/settings';
  import { ui } from '../ui.svelte.js';

  // aside: qualcosa accanto all'ingranaggio (in Oggi la fiamma delle settimane di fila).
  let { title, sub = '', back = false, aside = null } = $props();
</script>

<header class="head">
  <div class="top">
    {#if back}
      <button class="icon-btn back" onclick={() => ui.back()} aria-label="Indietro"><ArrowLeft size={22} /></button>
    {/if}
    <h1 class="t-title big">{title}</h1>
    {#if aside}{@render aside()}{/if}
    {#if !back}
      <a class="me" href="#/impostazioni" aria-label="Impostazioni"><Settings size={22} /></a>
    {/if}
  </div>
  {#if sub}<p class="sub">{sub}</p>{/if}
</header>

<style>
  .top {
    display: flex;
    align-items: center;
    gap: 6px;
    min-height: 44px;
  }
  .t-title.big {
    flex: 1;
    min-width: 0;
    margin: 0;
    font-size: 30px;
  }
  .back {
    width: 44px;
    height: 44px;
    margin-left: -12px;
    color: var(--ink);
  }
  .me {
    display: grid;
    place-items: center;
    flex: none;
    width: 44px;
    height: 44px;
    margin-right: -10px;
    border-radius: 50%;
    color: var(--ink-2);
    text-decoration: none;
    transition: transform 0.2s var(--ease);
  }
  .me:active {
    transform: scale(0.92);
  }
  .sub {
    margin-top: 2px;
    font-size: 15px;
    color: var(--ink-2);
  }
  .sub::first-letter {
    text-transform: uppercase;
  }
  @media (min-width: 900px) {
    .me {
      display: none;
    }
  }
</style>
