<script>
  // «Oggi»: il riquadro blu con la routine di oggi (il nome, i suoi esercizi, un solo pulsante),
  // la settimana, e le altre routine. Toccando gli esercizi si apre il foglio della routine.
  import Play from '@lucide/svelte/icons/play';
  import Check from '@lucide/svelte/icons/check';
  import Trash from '@lucide/svelte/icons/trash-2';
  import Upload from '@lucide/svelte/icons/upload';
  import ChevronRight from '@lucide/svelte/icons/chevron-right';
  import { app } from '../store.svelte.js';
  import { ui } from '../ui.svelte.js';
  import { routineSeconds, exerciseSpans, fmtDur, minutesOf } from '../model.js';
  import { weekStreak, resumePoint, minutes as minutesDone } from '../stats.js';
  import { fmtLong, fmtRelative } from '../dates.js';
  import PageHead from '../ui/PageHead.svelte';
  import Pills from '../ui/Pills.svelte';
  import Flame from '../ui/Flame.svelte';
  import WeekDays from '../ui/WeekDays.svelte';

  const routine = $derived(app.active);
  const minutes = $derived(routine ? minutesOf(routineSeconds(routine, app.opts)) : 0);
  const pills = $derived.by(() => {
    if (!routine) return [];
    const spans = exerciseSpans(routine, app.opts);
    return routine.exercises.map((e, i) => ({ cat: e.cat, name: e.name, time: fmtDur(spans[i]) }));
  });
  const streak = $derived(weekStreak(app.sessions, app.today));
  const doneToday = $derived(app.sessions.filter((s) => s.date === app.today));
  const doneMinutes = $derived(minutesDone(doneToday.reduce((a, s) => a + s.seconds, 0)));
  // Chi fa la routine a pezzi (un giorno la parte bassa, un altro l'alta) riparte da dove era rimasto.
  const resumeAt = $derived(resumePoint(routine, app.sessions, app.today));
  const left = $derived(resumeAt == null ? 0 : routine.exercises.length - resumeAt);
  const draft = $derived(app.hasDraft && !ui.live ? app.loadLive() : null);
  const others = $derived(app.routines.filter((r) => r.id !== routine?.id));

  function discard() {
    ui.confirm({
      title: 'Scartare la sessione?',
      text: 'Quello che hai fatto in questa sessione non finisce nel diario.',
      label: 'Scarta',
      danger: true,
      run: () => app.clearLive()
    });
  }
</script>

<div class="page enter today">
  <PageHead title="Oggi" sub={fmtLong(app.today)}>
    {#snippet aside()}
      {#if streak > 0}
        <span class="streak" role="img" aria-label="{streak} {streak === 1 ? 'settimana' : 'settimane'} di fila">
          <Flame size={30} /><b>{streak}</b>
        </span>
      {/if}
    {/snippet}
  </PageHead>

  <section class="court">
    {#if draft}
      <h2>Sessione a metà</h2>
      <span class="sub">{draft.name} · {fmtRelative(draft.date, app.today)}</span>
      <button class="go" onclick={() => ui.resume()}><Play size={18} fill="currentColor" strokeWidth={0} /> Riprendi</button>
      <button class="quiet" onclick={discard}><Trash size={16} /> Scarta questa sessione</button>
    {:else if routine}
      <h2>{routine.name}</h2>
      <button class="open" onclick={() => ui.open('routine', { id: routine.id })} aria-label="Vedi gli esercizi di {routine.name}">
        <Pills bricks={pills} solid />
      </button>
      {#if doneToday.length}
        <span class="done"><Check size={20} strokeWidth={3} /> Fatto oggi, {doneMinutes} {doneMinutes === 1 ? 'minuto' : 'minuti'}</span>
      {/if}
      {#if doneToday.length && resumeAt != null}
        <button class="go" onclick={() => ui.start(routine.id, resumeAt)}>
          <Play size={18} fill="currentColor" strokeWidth={0} /> Continua · {left === 1 ? 'manca 1 esercizio' : `mancano ${left} esercizi`}
        </button>
        <button class="quiet" onclick={() => ui.start(routine.id)}>Ricomincia da capo</button>
      {:else if doneToday.length}
        <button class="quiet" onclick={() => ui.start(routine.id)}><Play size={16} fill="currentColor" strokeWidth={0} /> Fai un’altra seduta</button>
      {:else}
        <button class="go" onclick={() => ui.start(routine.id)} disabled={!routine.exercises.length}>
          <Play size={18} fill="currentColor" strokeWidth={0} /> Inizia · {minutes} min
        </button>
        {#if resumeAt != null}
          <button class="quiet" onclick={() => ui.start(routine.id, resumeAt)}><span class="from">Riprendi da {routine.exercises[resumeAt].name}</span></button>
        {/if}
      {/if}
    {:else}
      <h2>Nessuna routine</h2>
      <span class="sub">Costruiscila blocco per blocco, o incolla quella che hai già.</span>
      <button class="go" onclick={() => ui.build()}>Costruisci una routine</button>
      <button class="quiet" onclick={() => ui.open('import')}><Upload size={16} /> Importa una routine</button>
    {/if}
  </section>

  <section>
    <WeekDays perWeek={routine?.perWeek ?? 0} />
  </section>

  {#if others.length}
    <section class="section">
      <h2 class="heading">Le altre routine</h2>
      <div class="card flush list">
        {#each others as r (r.id)}
          <button class="item" onclick={() => ui.open('routine', { id: r.id })}>
            <span class="grow"><strong>{r.name}</strong><span class="small muted block">{r.exercises.length} esercizi · {minutesOf(routineSeconds(r, app.opts))} min</span></span>
            <span class="muted"><ChevronRight size={18} /></span>
          </button>
        {/each}
      </div>
    </section>
  {/if}
</div>

<style>
  .today {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .streak {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    margin-right: 4px;
  }
  .streak b {
    font-size: 24px;
    font-weight: 800;
  }
  strong {
    font-weight: 650;
  }

  /* Il riquadro blu: al posto del tavolo, due anelli come il quadrante di un timer. */
  .court {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 20px 18px 18px;
    border-radius: 24px;
    background: var(--court);
    color: #fff;
    overflow: hidden;
  }
  .court::before,
  .court::after {
    content: '';
    position: absolute;
    border: 2px solid #fff;
    border-radius: 50%;
    pointer-events: none;
  }
  .court::before {
    top: -70px;
    right: -70px;
    width: 220px;
    height: 220px;
    opacity: 0.16;
  }
  .court::after {
    top: -30px;
    right: -30px;
    width: 140px;
    height: 140px;
    opacity: 0.24;
  }
  .court > :global(*) {
    position: relative;
    z-index: 1;
  }
  .court h2 {
    margin: 0;
    padding-right: 40px;
    font-size: 28px;
    font-weight: 800;
    letter-spacing: -0.03em;
    line-height: 1.1;
    text-wrap: balance;
  }
  .court .sub {
    opacity: 0.85;
  }
  .open {
    text-align: left;
  }
  .go {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    min-height: 56px;
    border-radius: 999px;
    background: #fff;
    color: #10151d;
    font-size: 17px;
    font-weight: 750;
    box-shadow: 0 4px 0 rgba(6, 30, 60, 0.4);
    transition:
      transform var(--dur-fast),
      box-shadow var(--dur-fast);
  }
  .go:active {
    transform: translateY(3px);
    box-shadow: 0 1px 0 rgba(6, 30, 60, 0.4);
  }
  .go:disabled {
    opacity: 0.5;
  }
  .done {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 44px;
    font-weight: 700;
  }
  .from {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .quiet {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    min-height: 44px;
    color: #fff;
    opacity: 0.9;
    font-weight: 600;
  }
</style>
