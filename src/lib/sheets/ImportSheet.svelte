<script>
  // Importa una routine: incolli una tabella o un elenco (o scegli un file) e sotto vedi subito i
  // blocchi che ne escono. Le righe non capite restano elencate, così sai cosa manca.
  import FileUp from '@lucide/svelte/icons/file-up';
  import { app } from '../store.svelte.js';
  import { ui } from '../ui.svelte.js';
  import { parseRoutine } from '../importer.js';
  import { routineSeconds, minutesOf } from '../model.js';
  import Sheet from '../ui/Sheet.svelte';
  import Stack from '../ui/Stack.svelte';

  let text = $state('');
  let name = $state('');
  let fileInput = $state();

  const result = $derived(parseRoutine(text));
  const routine = $derived(result.routine);
  // Il nome scritto a mano vince su quello trovato nel testo.
  const title = $derived(name.trim() || (routine?.name === 'Routine importata' ? '' : (routine?.name ?? '')));

  async function picked(e) {
    const file = e.currentTarget.files?.[0];
    e.currentTarget.value = '';
    if (!file) return;
    if (file.size > 1_000_000) return ui.toast('Il file è troppo grande', { tone: 'error' });
    text = await file.text();
  }

  function save() {
    const saved = app.putRoutine({ ...$state.snapshot(routine), name: title || 'Routine importata' });
    ui.close();
    ui.toast(`«${saved.name}» aggiunta alle routine`);
    ui.go('routine');
  }
</script>

<Sheet title="Importa una routine" onclose={() => ui.close()} tall>
  <div class="import">
    <p class="muted">Incolla una tabella o un elenco, una riga per esercizio: il nome e il volume.</p>
    <textarea class="field" bind:value={text} placeholder={'Frog Stretch\t5 cicli (3:20)\nCouch Stretch\t5 cicli per lato (3:20 per lato)\nJefferson Curl\t3 x 5 (4-2-4), 2–4 kg\nOpen Book\t1 min per lato'} rows="6" spellcheck="false" aria-label="Il testo da importare"></textarea>
    <button class="btn ghost small file" onclick={() => fileInput.click()}><FileUp size={16} /> Scegli un file</button>
    <input class="sr-only" type="file" accept=".json,.txt,.csv,.tsv,.md,application/json,text/plain" bind:this={fileInput} onchange={picked} tabindex="-1" aria-hidden="true" />

    {#if routine}
      <label class="lbl">
        <span class="t-label muted">Nome</span>
        <input class="field" bind:value={name} placeholder={routine.name} maxlength="60" />
      </label>
      <span class="t-label muted">{routine.exercises.length} {routine.exercises.length === 1 ? 'blocco' : 'blocchi'} · {minutesOf(routineSeconds(routine, app.opts))} min · {routine.perWeek} {routine.perWeek === 1 ? 'volta' : 'volte'} a settimana</span>
      <Stack {routine} />
    {:else if text.trim() && !result.skipped.length}
      <p class="warn">Qui non trovo esercizi. Ogni riga vuole un nome e un volume, per esempio «Plank 3 x 45 s».</p>
    {/if}

    {#if result.skipped.length}
      <div class="skipped">
        <span class="t-label">{routine ? 'Righe non capite' : 'Non riesco a leggerlo'}</span>
        {#each result.skipped as line, i (i)}<span class="small">{line}</span>{/each}
      </div>
    {/if}
  </div>

  {#snippet footer()}
    <button class="btn accent wide" onclick={save} disabled={!routine}>Aggiungi alle routine</button>
  {/snippet}
</Sheet>

<style>
  .import {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  textarea.field {
    min-height: 132px;
    font-size: 15px;
    white-space: pre;
    overflow-x: auto;
  }
  .file {
    align-self: flex-start;
    margin: -4px 0 0 -14px;
  }
  .lbl {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .warn {
    color: var(--stay);
  }
  .skipped {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 12px 14px;
    border-radius: var(--r-s);
    background: var(--stay-soft);
    color: var(--stay);
    overflow-wrap: anywhere;
  }
</style>
