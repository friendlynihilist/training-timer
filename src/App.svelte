<script>
  import { onMount, untrack } from 'svelte';
  import { fly } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import { app } from './lib/store.svelte.js';
  import { ui } from './lib/ui.svelte.js';

  import Nav from './lib/ui/Nav.svelte';
  import Toasts from './lib/ui/Toasts.svelte';
  import Live from './lib/screens/Live.svelte';
  import Builder from './lib/screens/Builder.svelte';
  import WhatsNew from './lib/ui/WhatsNew.svelte';
  import { unseen } from './lib/changelog.js';

  import Today from './lib/pages/Today.svelte';
  import Diary from './lib/pages/Diary.svelte';
  import Progress from './lib/pages/Progress.svelte';
  import Routines from './lib/pages/Routines.svelte';
  import Settings from './lib/pages/Settings.svelte';

  import RoutineSheet from './lib/sheets/RoutineSheet.svelte';
  import ImportSheet from './lib/sheets/ImportSheet.svelte';
  import SessionSheet from './lib/sheets/SessionSheet.svelte';
  import ConfirmSheet from './lib/sheets/ConfirmSheet.svelte';
  import AddSessionSheet from './lib/sheets/AddSessionSheet.svelte';

  const PAGES = { oggi: Today, diario: Diary, progressi: Progress, routine: Routines, impostazioni: Settings };
  const SHEETS = { routine: RoutineSheet, import: ImportSheet, session: SessionSheet, confirm: ConfirmSheet, add: AddSessionSheet };

  onMount(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && ui.sheets.length) ui.close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // Il tema scelto si ricorda a parte, così index.html lo applica prima del primo disegno.
  $effect(() => {
    const theme = app.settings.theme;
    const root = document.documentElement;
    if (theme === 'light' || theme === 'dark') root.dataset.theme = theme;
    else delete root.dataset.theme;
    app.rememberTheme();
  });

  // Una sessione rimasta a metà in un altro giorno va nel diario di quel giorno, senza aspettare.
  $effect(() => {
    if (ui.live || !app.hasDraft) return;
    const today = app.today;
    untrack(() => {
      if (app.loadLive()?.date !== today) app.bankLive();
    });
  });

  // Le novità: dopo un aggiornamento (mai nel mezzo di una sessione), o chieste da Impostazioni.
  const fresh = $derived(unseen(app.seen));
  const news = $derived(ui.news || (fresh.length > 0 && !ui.live && !ui.builder));
  function closeNews() {
    ui.news = null;
    app.markSeen();
  }

  const Page = $derived(PAGES[ui.route.name] ?? Today);
</script>

<Nav />
<main>
  {#key ui.route.name}
    <div in:fly={{ y: 10, duration: 360, easing: cubicOut }}>
      <Page />
    </div>
  {/key}
</main>

{#if ui.live}
  <Live />
{/if}

{#if news}
  <WhatsNew entries={fresh} history={Boolean(ui.news?.history)} onclose={closeNews} />
{/if}

{#if ui.builder}
  <Builder routine={ui.builder.routine} />
{/if}

{#each ui.sheets as s (s.id)}
  {@const Sheet = SHEETS[s.type]}
  <Sheet {...s.props} />
{/each}

<Toasts />

<style>
  main {
    margin-left: var(--rail);
  }
</style>
