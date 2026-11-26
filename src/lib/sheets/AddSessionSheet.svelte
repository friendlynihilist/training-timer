<script>
  // Una seduta scritta a mano nel diario: fatta senza l'app, o in un giorno passato. Si sceglie il
  // giorno, la routine, gli esercizi fatti e quanti minuti è durata.
  import Check from '@lucide/svelte/icons/check';
  import { app } from '../store.svelte.js';
  import { ui } from '../ui.svelte.js';
  import { expand, manualSession, minutesOf } from '../model.js';
  import { addDays, fmtLong, parse } from '../dates.js';
  import Sheet from '../ui/Sheet.svelte';
  import Stepper from '../ui/Stepper.svelte';
  import TypeTag from '../ui/TypeTag.svelte';

  let { date: asked = null } = $props();

  // svelte-ignore state_referenced_locally
  let date = $state(asked && asked <= app.today ? asked : app.today);
  let routineId = $state(app.active?.id ?? app.routines[0]?.id ?? null);
  const routine = $derived(app.routine(routineId));
  /** Gli esercizi fatti: di partenza tutti. */
  let picks = $state([]);
  /** I minuti scritti a mano; finché è null valgono quelli stimati dagli esercizi scelti. */
  let typed = $state(null);
  let note = $state('');

  $effect(() => {
    // Cambiando routine si riparte da tutti i suoi esercizi.
    picks = routine ? routine.exercises.map((_, i) => i) : [];
    typed = null;
  });

  // La stima: i passi degli esercizi scelti, con le pause che li precedono.
  const estimate = $derived.by(() => {
    if (!routine || !picks.length) return 0;
    const steps = expand(routine, app.opts);
    return minutesOf(steps.filter((s) => picks.includes(s.ex)).reduce((a, s) => a + (s.seconds ?? s.est), 0));
  });
  const minutes = $derived(typed ?? estimate);

  function toggle(i) {
    picks = picks.includes(i) ? picks.filter((x) => x !== i) : [...picks, i].sort((a, b) => a - b);
  }

  function save() {
    const session = manualSession($state.snapshot(routine), picks, { date, minutes, note, opts: app.opts });
    if (!session) return;
    // Nel diario sta a mezzogiorno del suo giorno; se è oggi, adesso.
    app.addSession({ ...session, at: date === app.today ? Date.now() : parse(date).getTime() });
    ui.close();
    ui.toast('Aggiunta al diario');
  }
</script>

<Sheet title="Aggiungi al diario" onclose={() => ui.close()} tall>
  <div class="form">
    <label class="lbl">
      <span class="t-label muted">Giorno</span>
      <input class="field" type="date" bind:value={date} max={app.today} min={addDays(app.today, -365)} required />
      <span class="small muted cap">{date ? fmtLong(date) : ''}</span>
    </label>

    <div class="lbl">
      <span class="t-label muted">Routine</span>
      <div class="choices">
        {#each app.routines as r (r.id)}
          <button class="choice" aria-pressed={r.id === routineId} onclick={() => (routineId = r.id)}>
            <span class="grow">{r.name}</span>
            <TypeTag type={r.type} />
          </button>
        {/each}
      </div>
    </div>

    {#if routine}
      <div class="lbl">
        <span class="spread">
          <span class="t-label muted">Cosa hai fatto</span>
          <button class="small link" onclick={() => (picks = picks.length === routine.exercises.length ? [] : routine.exercises.map((_, i) => i))}>
            {picks.length === routine.exercises.length ? 'Nessuno' : 'Tutti'}
          </button>
        </span>
        <div class="exs">
          {#each routine.exercises as e, i (e.id)}
            <button class="ex" data-cat={e.cat} aria-pressed={picks.includes(i)} onclick={() => toggle(i)}>
              <i>{#if picks.includes(i)}<Check size={14} strokeWidth={3.4} />{/if}</i>{e.name}
            </button>
          {/each}
        </div>
      </div>

      <div class="card frow">
        <span class="grow">Quanto è durata<span class="small muted block">Pause comprese</span></span>
        <Stepper label="Minuti" value={minutes} min={1} max={300} format={(v) => `${v} min`} onchange={(v) => (typed = v)} />
      </div>

      <label class="lbl">
        <span class="t-label muted">Una nota?</span>
        <textarea class="field" bind:value={note} placeholder="Facoltativa" maxlength="300" rows="2"></textarea>
      </label>
    {/if}
  </div>

  {#snippet footer()}
    <button class="btn accent wide" onclick={save} disabled={!routine || !picks.length || !date || date > app.today}>Aggiungi</button>
  {/snippet}
</Sheet>

<style>
  .form {
    display: flex;
    flex-direction: column;
    gap: 18px;
  }
  .lbl {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .cap::first-letter {
    text-transform: uppercase;
  }
  .choices {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .choice {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 52px;
    padding: 8px 14px;
    border-radius: 14px;
    background: var(--card);
    box-shadow: inset 0 0 0 1.5px var(--line);
    text-align: left;
    font-weight: 650;
  }
  .choice[aria-pressed='true'] {
    box-shadow: inset 0 0 0 2px var(--accent);
    background: var(--accent-soft);
  }
  .link {
    min-height: 32px;
    font-weight: 650;
    color: var(--accent-ink);
  }
  .exs {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .ex {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-height: 40px;
    padding: 0 12px 0 10px;
    border-radius: 12px;
    background: var(--sunk);
    color: var(--ink-2);
    font-size: 14px;
    font-weight: 650;
    text-align: left;
  }
  .ex i {
    display: grid;
    place-items: center;
    flex: none;
    width: 18px;
    height: 18px;
    border-radius: 6px;
    box-shadow: inset 0 0 0 2px var(--line-strong);
    color: var(--f-on);
  }
  .ex[aria-pressed='true'] {
    background: var(--f-soft);
    color: var(--ink);
  }
  .ex[aria-pressed='true'] i {
    background: var(--f);
    box-shadow: none;
  }
  .frow {
    display: flex;
    align-items: center;
    gap: 12px;
    font-weight: 600;
  }
  .frow .small {
    font-weight: 400;
  }
</style>
