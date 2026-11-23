<script>
  // La sessione dal vivo. Il telefono sta per terra: tempo grande, e tutto va avanti da solo. Finito
  // un esercizio parte la pausa, finita la pausa parte l'esercizio dopo; solo le serie a ripetizioni
  // senza ritmo aspettano che tu dica «fatta». Il tempo si misura sull'orologio, non contando i
  // battiti: se il telefono si addormenta un attimo, al ritorno è al punto giusto.
  // Tutto viene salvato sul dispositivo e diventa una voce del diario solo alla fine.
  import { onMount } from 'svelte';
  import { fly, fade } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import X from '@lucide/svelte/icons/x';
  import Play from '@lucide/svelte/icons/play';
  import Pause from '@lucide/svelte/icons/pause';
  import ChevronRight from '@lucide/svelte/icons/chevron-right';
  import ChevronLeft from '@lucide/svelte/icons/chevron-left';
  import Check from '@lucide/svelte/icons/check';
  import Timer from '@lucide/svelte/icons/timer';
  import ListChecks from '@lucide/svelte/icons/list-checks';
  import { app } from '../store.svelte.js';
  import { ui, buzz } from '../ui.svelte.js';
  import { expand, summarize, exerciseSpans, fmtClock, volumeText, durParts, CAT, SIDE, PHASES } from '../model.js';
  import { lastLoad } from '../stats.js';
  import { chime, tick, keepAwake, confetti, unlockAudio } from '../device.js';
  import { lockScroll } from '../scroll.js';
  import Brick from '../ui/Brick.svelte';
  import FeelPicker from '../ui/FeelPicker.svelte';
  import Stepper from '../ui/Stepper.svelte';

  function create() {
    const from = app.routine(ui.live.routineId);
    if (!from?.exercises.length) return null;
    const routine = $state.snapshot(from);
    // La sessione si congela all'inizio: resta la stessa anche se intanto la routine cambia.
    return {
      v: 1,
      routineId: routine.id,
      name: routine.name,
      date: app.today,
      opts: app.opts,
      exercises: routine.exercises,
      steps: expand(routine, app.opts),
      i: 0,
      acc: 0, // i secondi già passati sul passo in corso, prima dell'ultima ripartenza
      since: Date.now(), // da quando il tempo scorre; null se è fermo
      spent: {},
      done: {},
      loads: {},
      feel: null,
      note: '',
      beat: Date.now()
    };
  }

  function restore() {
    const saved = app.loadLive();
    if (!saved?.steps?.length) return null;
    // Il tempo rimasto acceso si ferma all'ultimo momento in cui l'app era viva.
    if (saved.since) {
      saved.acc += Math.max(0, (saved.beat - saved.since) / 1000);
      saved.since = null;
    }
    return saved;
  }

  let draft = $state(ui.live.resume ? restore() : create());
  let now = $state(Date.now());
  let dir = $state(1);
  let finished = false;
  let scroller = $state();

  const steps = $derived(draft?.steps ?? []);
  const exs = $derived(draft?.exercises ?? []);
  const closing = $derived(draft ? draft.i >= steps.length : false);
  const step = $derived(steps[Math.min(draft?.i ?? 0, steps.length - 1)]);
  const ex = $derived(step ? exs[step.ex] : null);
  const running = $derived(Boolean(draft?.since));
  const elapsed = $derived(draft ? draft.acc + (draft.since ? Math.max(0, now - draft.since) / 1000 : 0) : 0);
  const remaining = $derived(step?.seconds != null ? Math.max(0, step.seconds - elapsed) : 0);
  const spans = $derived(draft ? exerciseSpans({ exercises: exs }, draft.opts) : []);

  // Negli esercizi a cicli il tempo grande è quello del ciclo in corso.
  const cycle = $derived(step?.mode === 'time' ? Math.min(step.cycles - 1, Math.floor(elapsed / step.cycle)) : 0);
  const shown = $derived(step?.mode === 'time' && step.cycles > 1 ? Math.max(0, step.cycle * (cycle + 1) - elapsed) : remaining);
  // A ritmo: a che ripetizione sei, e in quale fase (scendi, tieni, sali).
  const pace = $derived(step?.mode === 'tempo' ? paceAt(step, elapsed) : null);

  function paceAt(s, t) {
    const len = s.tempo.reduce((a, b) => a + b, 0);
    const rep = Math.min(s.reps - 1, Math.floor(t / len));
    const inRep = Math.min(len, t - rep * len);
    const phase = inRep < s.tempo[0] ? 0 : inRep < s.tempo[0] + s.tempo[1] ? 1 : 2;
    return { rep, phase };
  }

  const elapsedNow = () => draft.acc + (draft.since ? Math.max(0, Date.now() - draft.since) / 1000 : 0);
  /** Quanto tempo può contare un passo: tutto il suo, o (senza ritmo) fino a quattro volte la stima. */
  const cap = (s) => s.seconds ?? Math.max(120, s.est * 4);
  const firstWork = (exIndex) => steps.findIndex((s) => s.kind === 'work' && s.ex === exIndex);
  const nextWork = $derived(steps.findIndex((s, k) => k > (draft?.i ?? 0) && s.kind === 'work'));
  const hasBefore = $derived(steps.slice(0, draft?.i ?? 0).some((s) => s.kind === 'work'));

  /** Come si chiama un passo di lavoro: l'esercizio e, se servono, la serie e il lato. */
  function label(s) {
    const e = exs[s.ex];
    const bits = [];
    if (s.sets > 1) bits.push(`serie ${s.set}`);
    if (s.side) bits.push(SIDE[s.side].toLowerCase());
    return bits.length ? `${e.name} · ${bits.join(', ')}` : e.name;
  }

  // ── Suoni e vibrazione ───────────────────────────────────────────────────

  const sound = (notes, o) => app.settings.sound && chime(notes, o);
  const click = (freq, gain) => app.settings.sound && tick(freq, gain);

  /** Cosa è già stato suonato sul passo in corso: ogni segnale parte una volta sola. */
  let marks = { sec: null, cycle: 0, pace: '0:0' };
  const resetMarks = () => (marks = { sec: null, cycle: 0, pace: '0:0' });

  function cues() {
    const s = steps[draft.i];
    const t = elapsedNow();
    if (s.seconds != null && s.seconds >= 5) {
      // Gli ultimi tre secondi di ogni passo a tempo.
      const left = Math.ceil(s.seconds - t);
      if (left !== marks.sec) {
        marks.sec = left;
        if (left >= 1 && left <= 3) click(660);
      }
    }
    if (s.mode === 'time' && s.cycles > 1) {
      const c = Math.min(s.cycles - 1, Math.floor(t / s.cycle));
      if (c !== marks.cycle) {
        marks.cycle = c;
        sound([880]);
        buzz(60);
      }
    }
    if (s.mode === 'tempo') {
      const p = paceAt(s, t);
      const key = `${p.rep}:${p.phase}`;
      if (key !== marks.pace) {
        marks.pace = key;
        click(p.phase === 0 ? 784 : 587, 0.1);
      }
    }
  }

  function celebrate() {
    sound([784, 988, 1175, 1568]);
    buzz([40, 40, 120]);
    confetti();
  }

  // ── Il tempo che scorre ──────────────────────────────────────────────────

  /** Arrivati su un passo nuovo (o alla chiusura): `auto` se ci ha portati il tempo. */
  function arrived(auto) {
    resetMarks();
    dir = 1;
    scroller?.scrollTo({ top: 0 });
    if (draft.i >= steps.length) {
      draft.since = null;
      draft.acc = 0;
      celebrate();
      return;
    }
    if (!auto) return;
    if (steps[draft.i].kind === 'work') {
      sound([988, 1319]);
      buzz([60, 40, 60]);
    } else {
      sound([1319, 988]);
      buzz(120);
    }
  }

  function beat() {
    now = Date.now();
    if (!draft?.since) return;
    let moved = false;
    // Più passi in un colpo solo se il telefono si era addormentato: l'avanzo passa al passo dopo.
    while (draft.since && draft.i < steps.length) {
      const s = steps[draft.i];
      if (s.seconds == null) break;
      const t = draft.acc + (now - draft.since) / 1000;
      if (t < s.seconds) break;
      if (s.kind === 'work') {
        draft.spent[s.id] = s.seconds;
        draft.done[s.id] = true;
      }
      draft.since += (s.seconds - draft.acc) * 1000;
      draft.acc = 0;
      draft.i += 1;
      moved = true;
    }
    if (!moved) return cues();
    // Una serie che aspetta te comincia adesso, non quando il telefono dormiva.
    if (draft.since && now - draft.since > 2000 && steps[draft.i]?.seconds == null) draft.since = now;
    arrived(true);
  }

  function toggle() {
    unlockAudio();
    buzz();
    if (draft.since) {
      draft.acc = elapsedNow();
      draft.since = null;
    } else draft.since = Date.now();
    now = Date.now();
  }

  /** Lasciando un passo a metà, il tempo passato resta contato (ma la serie non è fatta). */
  function keepPartial() {
    const s = steps[draft.i];
    if (!s || s.kind !== 'work' || draft.done[s.id]) return;
    const t = elapsedNow();
    if (t >= 1) draft.spent[s.id] = Math.max(draft.spent[s.id] ?? 0, Math.min(t, cap(s)));
  }

  /** Va a un passo qualsiasi, che riparte da capo. Oltre l'ultimo c'è la chiusura. */
  function goTo(i) {
    unlockAudio();
    keepPartial();
    const target = Math.max(0, Math.min(i, steps.length));
    dir = target >= draft.i ? 1 : -1;
    const keep = Boolean(draft.since);
    draft.i = target;
    draft.acc = 0;
    draft.since = keep && target < steps.length ? Date.now() : null;
    now = Date.now();
    resetMarks();
    scroller?.scrollTo({ top: 0 });
  }

  function back() {
    let k = draft.i - 1;
    while (k > 0 && steps[k].kind === 'rest') k--;
    goTo(k);
  }

  /** «Serie fatta»: le ripetizioni senza ritmo finiscono quando lo dici tu, poi parte la pausa. */
  function setDone() {
    unlockAudio();
    const s = steps[draft.i];
    draft.spent[s.id] = Math.min(cap(s), Math.max(1, elapsedNow()));
    draft.done[s.id] = true;
    draft.i += 1;
    draft.acc = 0;
    draft.since = Date.now();
    now = Date.now();
    buzz(30);
    arrived(false);
  }

  // ── Chiusura ─────────────────────────────────────────────────────────────

  const items = $derived(draft ? summarize(exs, steps, draft.spent, draft.done, draft.loads) : []);
  const doneSeconds = $derived(items.reduce((a, x) => a + x.seconds, 0));
  const doneMinutes = $derived(Math.round(doneSeconds / 60));
  /** Gli esercizi con un carico, se hai fatto almeno una serie: alla chiusura si segna quanti chili. */
  const loaded = $derived(
    draft ? exs.map((e, i) => ({ e, i })).filter(({ e, i }) => e.load && steps.some((s) => s.kind === 'work' && s.ex === i && draft.done[s.id])) : []
  );

  // Il carico parte da quello dell'ultima volta, o dal primo numero scritto nell'esercizio («2–4 kg» → 2).
  $effect(() => {
    if (!closing) return;
    for (const { e, i } of loaded) {
      if (draft.loads[i] == null) draft.loads[i] = lastLoad(app.sessions, e.name) ?? (Number(e.load.match(/\d+(?:[.,]\d+)?/)?.[0]?.replace(',', '.')) || 0);
    }
  });

  function finish() {
    finished = true;
    if (items.length) {
      app.addSession({
        date: draft.date,
        at: Date.now(),
        routineId: draft.routineId,
        name: draft.name,
        seconds: doneSeconds,
        items: $state.snapshot(items),
        feel: draft.feel,
        note: draft.note.trim()
      });
      ui.toast('Salvato nel diario');
    }
    app.clearLive();
    ui.live = null;
  }

  /** La X: il tempo si ferma e la sessione resta a metà, da riprendere da Oggi. */
  function leave() {
    keepPartial();
    if (draft.since) {
      draft.acc = elapsedNow();
      draft.since = null;
    }
    // Chiusa subito, senza aver fatto niente: non resta niente da riprendere.
    if (!Object.keys(draft.spent).length && draft.i <= Math.max(0, firstWork(0))) {
      finished = true;
      app.clearLive();
    } else app.saveLive({ ...$state.snapshot(draft), beat: Date.now() });
    ui.live = null;
  }

  // Ogni secondo, e a ogni tocco, la sessione si salva: se l'app si chiude, si riprende da lì.
  const second = $derived(Math.floor(now / 1000));
  $effect(() => {
    second;
    if (!draft || finished) return;
    app.saveLive({ ...$state.snapshot(draft), beat: Date.now() });
  });

  onMount(() => {
    if (!draft) {
      app.clearLive();
      ui.live = null;
      return;
    }
    const unlock = lockScroll();
    const awake = keepAwake();
    const timer = setInterval(beat, 100);
    return () => {
      clearInterval(timer);
      awake();
      unlock();
    };
  });
</script>

{#if draft}
  <div class="live" in:fly={{ y: 40, duration: 420, easing: cubicOut }} out:fade={{ duration: 180 }} role="dialog" aria-modal="true" aria-label={draft.name}>
    <header>
      <button class="icon-btn" onclick={leave} aria-label="Metti in pausa e chiudi"><X size={22} /></button>
      <div class="steps" role="tablist" aria-label="Esercizi">
        {#each exs as e, i (e.id)}
          <button
            class:on={!closing && step.ex === i}
            class:past={closing || step.ex > i}
            data-cat={e.cat}
            style:flex-grow={spans[i]}
            onclick={() => goTo(firstWork(i))}
            aria-label={e.name}
            role="tab"
            aria-selected={!closing && step.ex === i}
          ></button>
        {/each}
      </div>
      <button class="end" class:on={closing} onclick={() => goTo(steps.length)} aria-label="Chiusura" role="tab" aria-selected={closing}>
        <Check size={14} strokeWidth={3} />
      </button>
    </header>

    <div class="scroll" bind:this={scroller}>
      {#key draft.i}
        <div class="content" in:fly={{ x: 32 * dir, duration: 320, easing: cubicOut }}>
          {#if !closing && step.kind === 'rest'}
            {@const after = steps[nextWork]}
            <section class="now rest">
              <div class="now-top">
                <span class="tag-b"><i></i>{step.why === 'lead' ? 'Si comincia' : step.why === 'side' ? 'Cambio' : 'Riposo'}</span>
              </div>
              <h1 class="now-name">{step.label}</h1>
              <button class="time" class:idle={!running} onclick={toggle} aria-label={running ? 'Pausa' : 'Avvia'}>{fmtClock(remaining)}</button>
              <div class="bar"><span><i style:width="{Math.min(100, (elapsed / step.seconds) * 100)}%"></i></span></div>
            </section>
            {#if after}
              {@const e = exs[after.ex]}
              {@const d = after.mode === 'manual' ? { time: after.reps, unit: 'rip' } : durParts(after.seconds)}
              <span class="t-label muted">{step.why === 'lead' ? 'Si parte con' : step.why === 'side' ? 'Ora' : 'Dopo la pausa'}</span>
              <Brick cat={e.cat} name={label(after)} sub={volumeText(e)} time={d.time} unit={d.unit} />
            {/if}
          {:else if !closing}
            <section class="now" data-cat={ex.cat}>
              <div class="now-top">
                <span class="tag-b"><i></i>{CAT[ex.cat].name}</span>
                {#if step.side}
                  {#key step.side}
                    <span class="who" in:fade={{ duration: 200 }}>{SIDE[step.side]}</span>
                  {/key}
                {/if}
              </div>
              <h1 class="now-name">{ex.name}</h1>
              <div class="facts">
                {#if step.mode === 'time' && step.cycles > 1}<span class="tag t-num">Ciclo {cycle + 1} di {step.cycles}</span>{/if}
                {#if step.sets > 1}<span class="tag t-num">Serie {step.set} di {step.sets}</span>{/if}
                {#if pace}<span class="tag t-num">Ripetizione {pace.rep + 1} di {step.reps}</span>{/if}
                {#if ex.load}<span class="tag">{ex.load}</span>{/if}
                {#if ex.note}<span class="tag">{ex.note}</span>{/if}
              </div>

              {#if step.mode === 'manual'}
                <button class="time reps" class:idle={!running} onclick={toggle} aria-label="{step.reps} ripetizioni. {running ? 'Pausa' : 'Avvia'}">
                  {step.reps}<small>ripetizioni{step.side ? ` · ${SIDE[step.side].toLowerCase()}` : ''}</small>
                </button>
                <p class="count-up t-num muted" aria-hidden="true">{fmtClock(Math.floor(elapsed))}</p>
              {:else}
                <button class="time" class:idle={!running} onclick={toggle} aria-label={running ? 'Pausa' : 'Avvia'}>{fmtClock(shown)}</button>
                <div class="bar">
                  {#if step.mode === 'time'}
                    {#each Array(step.cycles) as _, c (c)}
                      <span><i style:width="{Math.max(0, Math.min(100, ((elapsed - c * step.cycle) / step.cycle) * 100))}%"></i></span>
                    {/each}
                  {:else}
                    <span><i style:width="{Math.min(100, (elapsed / step.seconds) * 100)}%"></i></span>
                  {/if}
                </div>
                {#if step.mode === 'time' && step.cycles > 1}
                  <p class="count-up t-num muted">In tutto ancora {fmtClock(remaining)}</p>
                {/if}
              {/if}

              {#if pace}
                <div class="tempo" aria-hidden="true">
                  {#each step.tempo as sec, k (k)}
                    {#if sec > 0}<span class:on={running && pace.phase === k}>{PHASES[k]} <b class="t-num">{sec}</b></span>{/if}
                  {/each}
                </div>
              {/if}
            </section>
          {:else}
            <h1 class="t-title">Com’è andata?</h1>

            <div class="stats">
              <div class="stat"><Timer size={20} strokeWidth={2.4} /><b class="t-num">{doneMinutes}</b><span>{doneMinutes === 1 ? 'minuto' : 'minuti'} di lavoro</span></div>
              <div class="stat"><ListChecks size={20} strokeWidth={2.4} /><b class="t-num">{items.length}<small> su {exs.length}</small></b><span>esercizi</span></div>
            </div>

            {#if !items.length}
              <p class="muted">Non hai ancora fatto niente: se chiudi adesso, nel diario non resta nulla.</p>
            {/if}

            {#if loaded.length}
              <section class="group">
                <h2 class="t-label muted">Carico usato</h2>
                <div class="card loads">
                  {#each loaded as { e, i } (e.id)}
                    <div class="load" data-cat={e.cat}>
                      <i class="dot"></i>
                      <span class="grow">{e.name}<span class="small muted block">Previsto: {e.load}</span></span>
                      <Stepper label="Chili per {e.name}" value={draft.loads[i] ?? 0} min={0} max={500} step={0.5} format={(v) => `${String(v).replace('.', ',')} kg`} onchange={(v) => (draft.loads[i] = v)} />
                    </div>
                  {/each}
                </div>
              </section>
            {/if}

            {#if items.length}
              <section class="group">
                <h2 class="t-label muted">Sensazione</h2>
                <FeelPicker value={draft.feel} onchange={(v) => (draft.feel = v)} />
              </section>

              <section class="group">
                <h2 class="t-label muted">Una nota?</h2>
                <textarea class="field" placeholder="Cosa hai sentito, cosa cambiare" bind:value={draft.note}></textarea>
              </section>
            {/if}
          {/if}
        </div>
      {/key}
    </div>

    <footer>
      {#if closing}
        <button class="btn accent wide" onclick={finish}>{items.length ? 'Salva nel diario' : 'Chiudi senza salvare'}</button>
        <button class="after" onclick={() => goTo(steps.findLastIndex((s) => s.kind === 'work'))}>Torna all’allenamento</button>
      {:else}
        {#if step.kind === 'rest'}
          <button class="btn accent wide main" onclick={() => goTo(draft.i + 1)}>{step.why === 'lead' ? 'Parti subito' : 'Salta la pausa'}</button>
        {:else if step.mode === 'manual' && running}
          <button class="btn accent wide main" onclick={setDone}><Check size={20} strokeWidth={3} /> Serie fatta</button>
        {:else}
          <button class="btn accent wide main" onclick={toggle}>
            {#if running}
              <Pause size={20} fill="currentColor" strokeWidth={0} /> Pausa
            {:else}
              <Play size={20} fill="currentColor" strokeWidth={0} /> Riprendi
            {/if}
          </button>
        {/if}
        <div class="row nav-row">
          {#if hasBefore}
            <button class="after back" onclick={back} aria-label="Passo precedente"><ChevronLeft size={18} /></button>
          {/if}
          {#if nextWork < 0}
            <button class="after grow" onclick={() => goTo(steps.length)}>Chiudi l’allenamento <ChevronRight size={18} /></button>
          {:else if step.kind === 'work'}
            <button class="after grow" onclick={() => goTo(nextWork)}><span class="next">{label(steps[nextWork])}</span> <ChevronRight size={18} /></button>
          {/if}
        </div>
      {/if}
    </footer>
  </div>
{/if}

<style>
  .live {
    position: fixed;
    inset: 0;
    z-index: 30;
    display: flex;
    flex-direction: column;
    background: var(--paper);
  }

  /* ── In alto: chiudi, gli esercizi come segmenti colorati, la chiusura ── */
  header {
    flex: none;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: calc(env(safe-area-inset-top) + 8px) 14px 8px 8px;
  }
  .steps {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 3px;
    height: 36px;
  }
  .steps button {
    position: relative;
    flex-basis: 0;
    min-width: 5px;
    height: 6px;
    border-radius: 99px;
    background: var(--sunk);
    transition: background var(--dur) var(--ease);
  }
  /* Il segmento è sottile, ma si tocca su tutta l'altezza della barra. */
  .steps button::after {
    content: '';
    position: absolute;
    inset: -15px -1.5px;
  }
  .steps button.past,
  .steps button.on {
    background: var(--f);
  }
  .steps button.past {
    opacity: 0.55;
  }
  .end {
    position: relative;
    display: grid;
    place-items: center;
    flex: none;
    width: 30px;
    height: 30px;
    border-radius: 50%;
    box-shadow: inset 0 0 0 2px var(--line-strong);
    color: var(--ink-3);
    transition:
      background var(--dur) var(--ease),
      color var(--dur) var(--ease);
  }
  .end::after {
    content: '';
    position: absolute;
    inset: -7px;
  }
  .end.on {
    background: var(--accent);
    box-shadow: none;
    color: var(--accent-on);
  }

  .scroll {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;
    overscroll-behavior: contain;
  }
  .content {
    max-width: 560px;
    margin: 0 auto;
    padding: 8px 20px 32px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  /* ── Il passo in corso: niente riquadro, solo la categoria, il nome e il tempo ── */
  .now {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .now.rest {
    --f: var(--ink-3);
  }
  .now-top {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 36px;
  }
  .tag-b {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 30px;
    padding: 0 10px 0 8px;
    border-radius: 9px;
    background: color-mix(in srgb, var(--f) 16%, var(--card));
    font-size: 13px;
    font-weight: 650;
    min-width: 0;
  }
  .tag-b i {
    flex: none;
    width: 10px;
    height: 10px;
    border-radius: 3px;
    background: var(--f);
  }
  /* Il lato: una pillola piena, che si legge anche da lontano. */
  .who {
    display: inline-flex;
    align-items: center;
    flex: none;
    margin-left: auto;
    min-height: 36px;
    padding: 0 14px;
    border-radius: 999px;
    background: var(--ink);
    color: var(--paper);
    font-size: 14px;
    font-weight: 700;
    white-space: nowrap;
  }
  .now-name {
    margin: 0;
    font-size: 28px;
    font-weight: 800;
    letter-spacing: -0.03em;
    line-height: 1.05;
    text-wrap: balance;
  }
  .facts {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    min-height: 26px;
  }
  .time {
    margin: 18px 0 4px;
    font-size: clamp(84px, 27vw, 104px);
    font-weight: 750;
    line-height: 0.95;
    letter-spacing: -0.055em;
    font-variant-numeric: tabular-nums;
    text-align: center;
    color: var(--ink);
    transition: opacity var(--dur) var(--ease);
  }
  .time.idle {
    opacity: 0.45;
  }
  .time.reps {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
  }
  .time small {
    font-size: 16px;
    font-weight: 650;
    letter-spacing: 0;
    line-height: 1.2;
    color: var(--ink-2);
  }
  .count-up {
    margin: 0;
    text-align: center;
    font-size: 15px;
    font-weight: 600;
  }
  /* La barra del tempo: un pezzo per ciclo. */
  .bar {
    display: flex;
    gap: 4px;
    height: 6px;
  }
  .bar span {
    flex: 1 1 0;
    border-radius: 99px;
    background: var(--sunk);
    overflow: hidden;
  }
  .bar i {
    display: block;
    height: 100%;
    border-radius: 99px;
    background: var(--f);
    transition: width 0.12s linear;
  }
  /* Le fasi del ritmo: quella in corso si accende. */
  .tempo {
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: 1fr;
    gap: 8px;
    margin-top: 6px;
  }
  .tempo span {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 52px;
    border-radius: 14px;
    background: var(--sunk);
    color: var(--ink-2);
    font-weight: 650;
    transition:
      background var(--dur-fast) var(--ease),
      color var(--dur-fast) var(--ease);
  }
  .tempo b {
    font-size: 20px;
    font-weight: 800;
  }
  .tempo .on {
    background: var(--f);
    color: var(--f-on);
  }

  /* ── Chiusura ── */
  .t-title {
    margin: 4px 0 0;
  }
  .stats {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
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
  .stat b small {
    margin-left: 4px;
    font-size: 15px;
    font-weight: 600;
    letter-spacing: 0;
    color: var(--ink-2);
  }
  .stat span {
    font-size: 12.5px;
    font-weight: 600;
    color: var(--ink-2);
  }
  .group {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .group h2 {
    margin: 6px 0 0;
  }
  .loads {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .load {
    display: flex;
    align-items: center;
    gap: 12px;
    font-weight: 600;
  }
  .load .small {
    font-weight: 400;
  }
  .dot {
    flex: none;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--f);
  }

  /* ── In basso: il pulsante del tempo e, sotto, l'esercizio dopo ── */
  footer {
    flex: none;
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-width: 560px;
    width: 100%;
    margin: 0 auto;
    padding: 10px 18px calc(env(safe-area-inset-bottom) + 14px);
  }
  .main {
    height: 60px;
  }
  .nav-row {
    gap: 4px;
    min-height: 44px;
  }
  .after {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    min-height: 44px;
    min-width: 0;
    font-weight: 650;
    color: var(--ink);
  }
  .after.back {
    flex: none;
    width: 44px;
    color: var(--ink-2);
  }
  .next {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
