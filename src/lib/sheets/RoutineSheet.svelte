<script>
  // Il foglio di una routine: quanto dura, i suoi blocchi, e cosa ci puoi fare.
  import Play from '@lucide/svelte/icons/play';
  import ChevronRight from '@lucide/svelte/icons/chevron-right';
  import Pencil from '@lucide/svelte/icons/pencil-line';
  import Copy from '@lucide/svelte/icons/copy';
  import Share from '@lucide/svelte/icons/share';
  import Trash from '@lucide/svelte/icons/trash-2';
  import Sun from '@lucide/svelte/icons/sun';
  import { app } from '../store.svelte.js';
  import { ui } from '../ui.svelte.js';
  import { routineSeconds, minutesOf } from '../model.js';
  import { exportRoutine } from '../importer.js';
  import { download } from '../device.js';
  import Sheet from '../ui/Sheet.svelte';
  import Stack from '../ui/Stack.svelte';
  import TypeTag from '../ui/TypeTag.svelte';

  let { id } = $props();
  const routine = $derived(app.routine(id));
  const minutes = $derived(routine ? minutesOf(routineSeconds(routine, app.opts)) : 0);

  function today() {
    app.setActive(id);
    ui.close();
    ui.toast(`«${routine.name}» è la routine di Oggi`);
  }
  function duplicate() {
    const copy = app.duplicateRoutine(id);
    ui.close();
    if (copy) ui.build(copy);
  }
  function share() {
    const file = `${routine.name.toLowerCase().replace(/[^a-z0-9àèéìòù]+/gi, '-').replace(/^-|-$/g, '') || 'routine'}.json`;
    download(file, JSON.stringify(exportRoutine($state.snapshot(routine)), null, 2));
    ui.toast('File scaricato: si importa da «Importa una routine»');
  }
  function remove() {
    const name = routine.name;
    const removed = app.removeRoutine(id);
    ui.close();
    if (removed) ui.toast(`«${name}» eliminata`, { action: { label: 'Annulla', run: () => app.restoreRoutine(removed) } });
  }
</script>

{#snippet row(Icon, label, sub, onclick, danger = false)}
  <button class="row-btn" class:danger {onclick}>
    <span class="ico"><Icon size={20} /></span>
    <span class="grow"><span class="lbl">{label}</span>{#if sub}<span class="sub">{sub}</span>{/if}</span>
    {#if !danger}<ChevronRight size={18} />{/if}
  </button>
{/snippet}

{#if routine}
  <Sheet title={routine.name} onclose={() => ui.close()} tall>
    <div class="head">
      <span class="total t-num">{minutes}</span>
      <span class="muted unit">minuti, pause comprese · {routine.perWeek} {routine.perWeek === 1 ? 'volta' : 'volte'} a settimana</span>
    </div>

    <div class="about">
      <TypeTag type={routine.type} />
      {#if routine.note}<p class="note small">{routine.note}</p>{/if}
    </div>

    {#if routine.exercises.length}
      <Stack {routine} />
    {:else}
      <p class="muted">Questa routine è vuota: aggiungi qualche blocco con «Modifica».</p>
    {/if}

    <div class="card flush rows">
      {#if app.active?.id !== id}{@render row(Sun, 'Usa per oggi', 'Diventa la routine della pagina Oggi', today)}{/if}
      {@render row(Pencil, 'Modifica', 'Blocchi, ordine, durate', () => ui.build(routine))}
      {@render row(Copy, 'Duplica', 'Una copia da cambiare', duplicate)}
      {@render row(Share, 'Esporta', 'Un file da tenere o passare a qualcuno', share)}
      {@render row(Trash, 'Elimina', '', remove, true)}
    </div>

    {#snippet footer()}
      <button class="btn accent wide" onclick={() => ui.start(id)} disabled={!routine.exercises.length}><Play size={18} fill="currentColor" strokeWidth={0} /> Inizia</button>
    {/snippet}
  </Sheet>
{/if}

<style>
  .head {
    display: flex;
    align-items: flex-end;
    gap: 8px;
    margin-bottom: 14px;
  }
  .total {
    font-size: 56px;
    font-weight: 800;
    letter-spacing: -0.05em;
    line-height: 0.9;
  }
  .unit {
    padding-bottom: 3px;
    font-size: 14px;
    line-height: 1.3;
  }
  .about {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-bottom: 16px;
  }
  .note {
    margin: 0;
    white-space: pre-line;
    line-height: 1.45;
    color: var(--ink-2);
  }
  .rows {
    margin-top: 18px;
  }
</style>
