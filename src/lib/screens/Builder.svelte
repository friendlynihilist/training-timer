<script>
  // Il costruttore a tutto schermo: la routine come una pila di blocchi, uno per esercizio. Si apre
  // dal tasto + (una routine nuova) e da «Modifica». In basso il vassoio: un blocco nuovo, a tempo o
  // a ripetizioni, oppure uno che hai già usato in un'altra routine.
  //   · tocca un blocco e cambi nome, tipo, cicli, serie, lato, carico;
  //   · trascinalo dalla maniglia a sinistra e cambi l'ordine.
  // L'altezza di un blocco è la sua durata.
  import { onMount, tick } from 'svelte';
  import { fly } from 'svelte/transition';
  import { flip } from 'svelte/animate';
  import { cubicOut } from 'svelte/easing';
  import X from '@lucide/svelte/icons/x';
  import Plus from '@lucide/svelte/icons/plus';
  import Grip from '@lucide/svelte/icons/grip-vertical';
  import ChevronRight from '@lucide/svelte/icons/chevron-right';
  import ArrowUp from '@lucide/svelte/icons/arrow-up';
  import ArrowDown from '@lucide/svelte/icons/arrow-down';
  import { app } from '../store.svelte.js';
  import { ui, buzz } from '../ui.svelte.js';
  import { CATS, PHASES, newId, nameKey, routineSeconds, exerciseSpans, minutesOf, fmtDur, volumeText, cycleSeconds, pnfPhases } from '../model.js';
  import { lockScroll } from '../scroll.js';
  import Sheet from '../ui/Sheet.svelte';
  import Segmented from '../ui/Segmented.svelte';
  import Stepper from '../ui/Stepper.svelte';
  import Toggle from '../ui/Toggle.svelte';

  let { routine = null } = $props();

  // La routine si copia all'apertura: finché non salvi, quella vera non cambia.
  // svelte-ignore state_referenced_locally
  const start = routine ? $state.snapshot(routine) : { name: '', perWeek: 3, exercises: [] };
  let name = $state(start.name);
  let perWeek = $state(start.perWeek);
  let list = $state(structuredClone(start.exercises));

  const draft = $derived({ exercises: list });
  const total = $derived(routineSeconds(draft, app.opts));
  const spans = $derived(exerciseSpans(draft, app.opts));
  const dirty = $derived(JSON.stringify({ name, perWeek, exercises: list }) !== JSON.stringify(start));
  // I blocchi delle altre routine che qui non ci sono ancora.
  const tray = $derived(app.blocks.filter((b) => !list.some((e) => nameKey(e.name) === nameKey(b.name))));

  const height = (sec) => Math.min(150, Math.max(58, Math.round(sec / 4)));

  let editing = $state(null);
  let fresh = $state(null);
  let nameField = $state();
  const edited = $derived(list.find((e) => e.id === editing) ?? null);

  async function add(from) {
    const ex = { sets: 1, seconds: 30, reps: 10, tempo: null, phases: null, sides: false, load: '', note: '', cat: 'altro', ...structuredClone(from), id: newId() };
    list.push(ex);
    fresh = ex.id;
    buzz();
    await tick();
    document.querySelector(`[data-id="${ex.id}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    // Un blocco nuovo di zecca si apre subito, per dargli un nome.
    if (!from.name) editing = ex.id;
  }

  function remove() {
    list = list.filter((e) => e.id !== editing);
    editing = null;
  }

  function shift(by) {
    const i = list.findIndex((e) => e.id === editing);
    const j = i + by;
    if (i < 0 || j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    buzz();
  }

  function setKind(kind) {
    edited.kind = kind;
    // Cicli e serie stanno nello stesso campo: cambiando tipo si riparte da un numero sensato.
    edited.sets = kind === 'time' ? 1 : 3;
    if (kind === 'time') edited.tempo = null;
    else edited.phases = null;
  }

  /** Accende o spegne le fasi: si parte dal ciclo PNF, e spegnendole il ciclo resta lungo uguale. */
  function setPhases(on) {
    if (on) edited.phases = pnfPhases();
    else {
      edited.seconds = cycleSeconds(edited);
      edited.phases = null;
    }
  }

  // ── Trascinare un blocco dalla maniglia ──────────────────────────────────

  const GAP = 5;
  let tower = $state();
  /** Il blocco che stai trascinando: { id, y } (lo spostamento rispetto al suo posto). */
  let drag = $state(null);
  let grab = 0;

  function down(e, id) {
    drag = { id, y: 0 };
    grab = e.clientY;
    e.currentTarget.setPointerCapture(e.pointerId);
    buzz();
  }
  function move(e) {
    if (!drag) return;
    let y = e.clientY - grab;
    const i = list.findIndex((x) => x.id === drag.id);
    const els = [...tower.querySelectorAll('.brk')];
    // Passata la metà del vicino, i due si scambiano di posto; il punto di presa si sposta di
    // conseguenza, così il blocco resta sotto il dito.
    if (y < 0 && i > 0) {
      const h = els[i - 1].offsetHeight + GAP;
      if (-y > h / 2) {
        [list[i - 1], list[i]] = [list[i], list[i - 1]];
        grab -= h;
        y += h;
        buzz();
      }
    } else if (y > 0 && i < list.length - 1) {
      const h = els[i + 1].offsetHeight + GAP;
      if (y > h / 2) {
        [list[i + 1], list[i]] = [list[i], list[i + 1]];
        grab += h;
        y -= h;
        buzz();
      }
    }
    drag.y = y;
  }
  function up() {
    drag = null;
  }

  // ── Salvare e chiudere ───────────────────────────────────────────────────

  function save() {
    if (!name.trim()) {
      ui.toast('Dai un nome alla routine');
      nameField?.focus();
      return;
    }
    // Le proprietà spariscono con la schermata: quello che serve si prende prima di chiudere.
    const fresh = !routine;
    app.putRoutine({ id: routine?.id, name, perWeek, exercises: $state.snapshot(list).map((e) => ({ ...e, name: e.name.trim() || 'Esercizio' })) });
    ui.builder = null;
    ui.toast(fresh ? 'Routine creata' : 'Routine salvata');
    if (fresh) ui.go('routine');
  }

  function close() {
    if (!dirty) return (ui.builder = null);
    ui.confirm({
      title: 'Chiudere senza salvare?',
      text: 'Le modifiche a questa routine vanno perse.',
      label: 'Chiudi senza salvare',
      danger: true,
      run: () => (ui.builder = null)
    });
  }

  onMount(() => lockScroll());
</script>

<div class="builder" transition:fly={{ y: 40, duration: 320, easing: cubicOut }} role="dialog" aria-modal="true" aria-label={routine ? 'Modifica la routine' : 'Nuova routine'}>
  <div class="scroll">
    <header>
      <button class="icon-btn" onclick={close} aria-label="Chiudi"><X size={22} /></button>
      <input class="t-title title-in" bind:value={name} bind:this={nameField} placeholder="Nome della routine" aria-label="Nome della routine" maxlength="60" />
    </header>

    <div class="head">
      <span class="total t-num">{list.length ? minutesOf(total) : 0}</span>
      <span class="muted unit">minuti{list.length > 1 ? ', pause comprese' : ''}</span>
      <span class="grow"></span>
      <Stepper label="Volte a settimana" value={perWeek} min={1} max={14} format={(v) => `${v}× sett.`} onchange={(v) => (perWeek = v)} />
    </div>

    <div class="tower" bind:this={tower}>
      {#each list as ex, i (ex.id)}
        {@const h = height(spans[i])}
        <div
          class="brk"
          class:new={fresh === ex.id}
          class:drag={drag?.id === ex.id}
          data-id={ex.id}
          data-cat={ex.cat}
          style:height="{h}px"
          style:transform={drag?.id === ex.id ? `translateY(${drag.y}px)` : null}
          animate:flip={{ duration: drag?.id === ex.id ? 0 : 180 }}
        >
          <span class="grip" role="presentation" onpointerdown={(e) => down(e, ex.id)} onpointermove={move} onpointerup={up} onpointercancel={up}>
            <Grip size={18} />
          </span>
          <button class="brk-open" onclick={() => (editing = ex.id)} aria-label="{ex.name || 'Esercizio senza nome'}, {volumeText(ex)}. Tocca per modificare.">
            <span class="brk-t">
              <b>{ex.name || 'Senza nome'}</b>
              <small>{volumeText(ex)}{ex.note ? ` · ${ex.note}` : ''}</small>
            </span>
            <span class="brk-m">{fmtDur(spans[i])}</span>
            <span class="brk-go" aria-hidden="true"><ChevronRight size={18} strokeWidth={2.6} /></span>
          </button>
        </div>
      {:else}
        <div class="empty">Qui compaiono i blocchi<br />che aggiungi</div>
      {/each}
    </div>

    <div class="tray">
      <button class="tile plain" onclick={() => add({ kind: 'time', cat: 'allungamento' })}><Plus size={16} strokeWidth={3} /> A tempo</button>
      <button class="tile plain" onclick={() => add({ kind: 'reps', sets: 3, cat: 'forza' })}><Plus size={16} strokeWidth={3} /> Ripetizioni</button>
      {#each tray as b (b.id)}
        <button class="tile" data-cat={b.cat} onclick={() => add($state.snapshot(b))} aria-label="Aggiungi {b.name}">{b.name}</button>
      {/each}
    </div>
  </div>
  <footer>
    <button class="btn accent wide" onclick={save} disabled={!list.length}>{routine ? 'Salva' : 'Crea la routine'}</button>
  </footer>
</div>

{#if edited}
  <Sheet title={edited.name || 'Nuovo blocco'} onclose={() => (editing = null)} tall>
    <div class="edit">
      <label class="lbl">
        <span class="t-label muted">Nome</span>
        <!-- svelte-ignore a11y_autofocus -->
        <input class="field" bind:value={edited.name} placeholder="Frog Stretch, Squat…" maxlength="60" autofocus={!edited.name} />
      </label>

      <div class="lbl">
        <span class="t-label muted">Categoria</span>
        <div class="cats">
          {#each CATS as c (c.id)}
            <button class="cat" data-cat={c.id} aria-pressed={edited.cat === c.id} onclick={() => (edited.cat = c.id)}><i></i>{c.name}</button>
          {/each}
        </div>
      </div>

      <Segmented
        options={[
          { id: 'time', label: 'A tempo' },
          { id: 'reps', label: 'Ripetizioni' }
        ]}
        value={edited.kind}
        onchange={setKind}
      />

      <div class="card rows">
        {#if edited.kind === 'time'}
          <div class="frow">
            <span class="grow">Cicli<span class="small muted block">Un segnale a ogni ciclo</span></span>
            <Stepper label="Cicli" value={edited.sets} min={1} max={30} onchange={(v) => (edited.sets = v)} />
          </div>
          {#if !edited.phases}
            <div class="frow">
              <span class="grow">Durata{edited.sets > 1 ? ' di un ciclo' : ''}</span>
              <Stepper label="Secondi" value={edited.seconds} min={5} max={1800} step={5} format={fmtDur} onchange={(v) => (edited.seconds = v)} />
            </div>
          {/if}
          <Toggle label="A fasi" hint="Ogni ciclo ha più fasi, come nel PNF: posizione, spingi, tira, rilassa" checked={Boolean(edited.phases)} onchange={setPhases} />
          {#if edited.phases}
            {#each edited.phases as ph, k (k)}
              <div class="phase">
                <div class="frow">
                  <input class="field ph-name" bind:value={ph.name} placeholder="Fase {k + 1}" aria-label="Nome della fase {k + 1}" maxlength="24" />
                  <Stepper label="Secondi della fase {k + 1}" value={ph.seconds} min={1} max={300} format={(v) => `${v} s`} onchange={(v) => (ph.seconds = v)} />
                  <button class="icon-btn" onclick={() => edited.phases.splice(k, 1)} disabled={edited.phases.length <= 1} aria-label="Togli la fase {k + 1}"><X size={18} /></button>
                </div>
                <textarea class="field ph-cue" bind:value={ph.cue} placeholder="Cosa fare in questa fase (facoltativo)" aria-label="Indicazione per la fase {k + 1}" maxlength="240" rows="1"></textarea>
              </div>
            {/each}
            <div class="frow">
              <button class="btn ghost small add-ph" onclick={() => edited.phases.push({ name: '', seconds: 10, cue: '' })} disabled={edited.phases.length >= 8}><Plus size={16} /> Aggiungi una fase</button>
              <span class="grow"></span>
              <span class="small muted t-num">Un ciclo: {fmtDur(cycleSeconds(edited))}</span>
            </div>
          {/if}
        {:else}
          <div class="frow">
            <span class="grow">Serie</span>
            <Stepper label="Serie" value={edited.sets} min={1} max={20} onchange={(v) => (edited.sets = v)} />
          </div>
          <div class="frow">
            <span class="grow">Ripetizioni</span>
            <Stepper label="Ripetizioni" value={edited.reps} min={1} max={100} onchange={(v) => (edited.reps = v)} />
          </div>
          <Toggle label="A ritmo" hint="Il timer scandisce ogni ripetizione; senza, dici tu quando la serie è fatta" checked={Boolean(edited.tempo)} onchange={(on) => (edited.tempo = on ? [4, 2, 4] : null)} />
          {#if edited.tempo}
            {#each PHASES as phase, k (phase)}
              <div class="frow">
                <span class="grow">{phase}</span>
                <Stepper label="Secondi: {phase.toLowerCase()}" value={edited.tempo[k]} min={k === 1 ? 0 : 1} max={20} format={(v) => `${v} s`} onchange={(v) => (edited.tempo[k] = v)} />
              </div>
            {/each}
          {/if}
        {/if}
        <Toggle label="Per lato" hint="Prima a sinistra, poi a destra" checked={edited.sides} onchange={(v) => (edited.sides = v)} />
      </div>

      {#if edited.kind === 'reps'}
        <label class="lbl">
          <span class="t-label muted">Carico</span>
          <input class="field" bind:value={edited.load} placeholder="2–4 kg (facoltativo)" maxlength="30" />
          <span class="small muted">Se lo scrivi, a fine seduta segni i chili usati.</span>
        </label>
      {/if}

      <label class="lbl">
        <span class="t-label muted">Nota</span>
        <input class="field" bind:value={edited.note} placeholder="Lente, respiro profondo… (facoltativa)" maxlength="80" />
      </label>

      <div class="frow order">
        <span class="grow t-label muted">Posizione nella routine</span>
        <button class="icon-btn sq" onclick={() => shift(-1)} disabled={list[0]?.id === edited.id} aria-label="Sposta su"><ArrowUp size={20} /></button>
        <button class="icon-btn sq" onclick={() => shift(1)} disabled={list.at(-1)?.id === edited.id} aria-label="Sposta giù"><ArrowDown size={20} /></button>
      </div>
    </div>
    {#snippet footer()}
      <div class="stack g-8">
        <button class="btn accent wide" onclick={() => (editing = null)}>Fatto</button>
        <button class="btn plain wide danger-txt" onclick={remove}>Togli questo blocco</button>
      </div>
    {/snippet}
  </Sheet>
{/if}

<style>
  .builder {
    position: fixed;
    inset: 0;
    z-index: 30;
    display: flex;
    flex-direction: column;
    background: var(--paper);
  }
  .scroll {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    display: flex;
    flex-direction: column;
    gap: 14px;
    width: 100%;
    max-width: 560px;
    margin: 0 auto;
    padding: calc(env(safe-area-inset-top) + 12px) var(--gutter) 0;
  }
  header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-left: -10px;
  }
  .title-in {
    flex: 1;
    min-width: 0;
    padding: 4px 0;
    border: 0;
    border-bottom: 2px solid transparent;
    border-radius: 0;
    background: none;
    outline: none;
    font-size: 26px;
  }
  .title-in:focus {
    border-bottom-color: var(--accent);
  }
  .title-in::placeholder {
    color: var(--ink-3);
  }
  footer {
    width: 100%;
    max-width: 560px;
    margin: 0 auto;
    padding: 6px var(--gutter) calc(env(safe-area-inset-bottom) + 14px);
  }

  .head {
    display: flex;
    align-items: flex-end;
    gap: 8px;
  }
  .total {
    font-size: 56px;
    font-weight: 800;
    letter-spacing: -0.05em;
    line-height: 0.9;
  }
  .unit {
    padding-bottom: 4px;
  }

  .tower {
    position: relative;
    flex: 1 0 auto;
    min-height: 180px;
    display: flex;
    flex-direction: column;
    gap: 5px;
    padding-bottom: 12px;
  }
  .empty {
    flex: 1;
    min-height: 180px;
    display: grid;
    place-items: center;
    text-align: center;
    border: 2px dashed var(--line-strong);
    border-radius: 20px;
    color: var(--ink-3);
  }

  .brk {
    position: relative;
    flex: none;
    display: flex;
    align-items: stretch;
    border-radius: 16px;
    background: var(--f);
    color: var(--f-on);
    box-shadow: 0 4px 0 var(--f-edge);
    user-select: none;
    -webkit-user-select: none;
  }
  .brk.new {
    animation: drop 0.42s cubic-bezier(0.3, 0.7, 0.3, 1) both;
  }
  @keyframes drop {
    from {
      opacity: 0;
      translate: 0 -28px;
    }
  }
  .brk.drag {
    z-index: 5;
    scale: 1.03;
    box-shadow:
      0 4px 0 var(--f-edge),
      0 18px 30px -8px rgba(0, 0, 0, 0.45);
  }
  /* La maniglia: solo qui il dito trascina il blocco, altrove la pagina scorre. */
  .grip {
    flex: none;
    display: grid;
    place-items: center;
    width: 40px;
    opacity: 0.75;
    cursor: grab;
    touch-action: none;
  }
  .brk.drag .grip {
    cursor: grabbing;
  }
  .brk-open {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 0 14px 0 0;
    color: inherit;
    text-align: left;
  }
  .brk-t {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }
  .brk-t b {
    font-size: 16px;
    font-weight: 750;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .brk-t small {
    font-size: 13px;
    opacity: 0.9;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .brk-m {
    flex: none;
    font-size: 18px;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
  }
  /* La freccia a destra dice che il blocco si apre. */
  .brk-go {
    flex: none;
    display: grid;
    margin: 0 -6px 0 -4px;
    opacity: 0.8;
  }

  .tray {
    position: sticky;
    bottom: 0;
    flex: none;
    display: flex;
    gap: 8px;
    margin: 0 calc(var(--gutter) * -1);
    padding: 8px var(--gutter) 10px;
    overflow-x: auto;
    scrollbar-width: none;
    background: var(--paper);
  }
  .tray::-webkit-scrollbar {
    display: none;
  }
  .tile {
    flex: none;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 52px;
    padding: 0 18px;
    border-radius: 14px;
    background: var(--f);
    color: var(--f-on);
    font-weight: 750;
    box-shadow: 0 4px 0 var(--f-edge);
    white-space: nowrap;
  }
  .tile.plain {
    background: var(--card);
    color: var(--ink);
    box-shadow: 0 4px 0 var(--line-strong);
  }
  .tile:active {
    transform: translateY(3px);
    box-shadow: 0 1px 0 var(--f-edge, var(--line-strong));
  }

  .edit {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .lbl {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .cats {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .cat {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    min-height: 40px;
    padding: 0 14px 0 12px;
    border-radius: 999px;
    background: var(--sunk);
    font-size: 14px;
    font-weight: 650;
  }
  .cat i {
    width: 10px;
    height: 10px;
    border-radius: 3px;
    background: var(--f);
  }
  .cat[aria-pressed='true'] {
    background: var(--f);
    color: var(--f-on);
  }
  .cat[aria-pressed='true'] i {
    background: var(--f-on);
  }
  .rows {
    display: flex;
    flex-direction: column;
    gap: 16px;
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
  .rows :global(.toggle .grow) {
    font-weight: 600;
  }
  .rows :global(.toggle .muted) {
    font-weight: 400;
  }
  .phase {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding-top: 14px;
    border-top: 1px solid var(--line);
  }
  .phase .frow {
    gap: 8px;
  }
  .ph-name {
    flex: 1;
    min-width: 0;
    font-weight: 650;
  }
  textarea.ph-cue {
    min-height: 0;
    font-size: 15px;
    color: var(--ink-2);
  }
  .phase .icon-btn {
    margin-right: -10px;
  }
  .phase .icon-btn:disabled {
    opacity: 0.3;
  }
  .add-ph {
    margin-left: -14px;
  }
  .sq {
    background: var(--sunk);
    color: var(--ink);
  }
  .sq:disabled {
    opacity: 0.35;
  }
  .danger-txt {
    color: var(--down);
  }
  @media (prefers-reduced-motion: reduce) {
    .brk.new {
      animation: none;
    }
  }
</style>
