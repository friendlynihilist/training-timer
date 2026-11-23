<script>
  import SunMoon from '@lucide/svelte/icons/sun-moon';
  import Volume2 from '@lucide/svelte/icons/volume-2';
  import Vibrate from '@lucide/svelte/icons/vibrate';
  import Hourglass from '@lucide/svelte/icons/hourglass';
  import ArrowLeftRight from '@lucide/svelte/icons/arrow-left-right';
  import Flag from '@lucide/svelte/icons/flag';
  import FileJson from '@lucide/svelte/icons/file-json';
  import Upload from '@lucide/svelte/icons/upload';
  import Trash from '@lucide/svelte/icons/trash-2';
  import ChevronRight from '@lucide/svelte/icons/chevron-right';
  import { app } from '../store.svelte.js';
  import { ui } from '../ui.svelte.js';
  import { download } from '../device.js';
  import PageHead from '../ui/PageHead.svelte';
  import Segmented from '../ui/Segmented.svelte';
  import Toggle from '../ui/Toggle.svelte';
  import Stepper from '../ui/Stepper.svelte';

  const VERSION = __APP_VERSION__;
  const s = $derived(app.settings);
  let fileInput = $state();

  const secs = (v) => (v ? `${v} s` : 'No');

  function exportAll() {
    download(`cadenza-${app.today}.json`, JSON.stringify(app.backup(), null, 2));
  }

  async function picked(e) {
    const file = e.currentTarget.files?.[0];
    e.currentTarget.value = '';
    if (!file) return;
    let data = null;
    try {
      data = JSON.parse(await file.text());
    } catch {}
    if (data?.app !== 'training-timer' || !Array.isArray(data.routines)) return ui.toast('Questo file non è una copia completa di Cadenza', { tone: 'error' });
    ui.confirm({
      title: 'Ripristinare la copia?',
      text: `Prende il posto dei dati di adesso: ${data.routines.length} routine e ${data.sessions?.length ?? 0} sedute.`,
      label: 'Ripristina',
      run: () => ui.toast(app.restore(data) ? 'Copia ripristinata' : 'La copia non si legge', {})
    });
  }

  function wipe() {
    ui.confirm({
      title: 'Cancellare tutto?',
      text: 'Routine, diario e impostazioni spariscono da questo dispositivo. Non si torna indietro: prima, se vuoi, scarica la copia completa.',
      label: 'Cancella tutto',
      danger: true,
      run: () => {
        app.wipe();
        ui.toast('Dati cancellati');
      }
    });
  }
</script>

{#snippet row(Icon, label, sub, onclick, danger = false)}
  <button class="row-btn" class:danger {onclick}>
    <span class="ico"><Icon size={20} /></span>
    <span class="grow"><span class="lbl">{label}</span>{#if sub}<span class="sub">{sub}</span>{/if}</span>
    {#if !danger}<ChevronRight size={18} />{/if}
  </button>
{/snippet}

{#snippet time(Icon, label, hint, key, max)}
  <div class="trow">
    <span class="ico"><Icon size={20} /></span>
    <span class="grow lbl">{label}<span class="small muted block">{hint}</span></span>
    <Stepper {label} value={s[key]} min={0} {max} step={5} format={secs} onchange={(v) => app.patchSettings({ [key]: v })} />
  </div>
{/snippet}

<div class="page enter settings">
  <PageHead title="Impostazioni" back />

  <section class="section">
    <h2 class="heading">Tempi</h2>
    <div class="card prefs">
      {@render time(Hourglass, 'Pausa', 'Fra un esercizio e l’altro, e fra le serie', 'rest', 180)}
      {@render time(ArrowLeftRight, 'Cambio di lato', 'Da sinistra a destra', 'switchRest', 60)}
      {@render time(Flag, 'Preparati', 'Prima del primo esercizio', 'lead', 30)}
    </div>
  </section>

  <section class="section">
    <h2 class="heading">Preferenze</h2>
    <div class="card prefs">
      <div class="trow">
        <span class="ico"><SunMoon size={20} /></span>
        <span class="grow lbl">Aspetto</span>
        <Segmented
          small
          options={[
            { id: 'auto', label: 'Auto' },
            { id: 'light', label: 'Chiaro' },
            { id: 'dark', label: 'Scuro' }
          ]}
          value={s.theme}
          onchange={(theme) => app.patchSettings({ theme })}
        />
      </div>
      <Toggle icon={Volume2} label="Suoni" hint="Inizio e fine di ogni blocco, gli ultimi tre secondi, i cicli" checked={s.sound} onchange={(sound) => app.patchSettings({ sound })} />
      <Toggle icon={Vibrate} label="Vibrazione" checked={s.haptics} onchange={(haptics) => app.patchSettings({ haptics })} />
    </div>
  </section>

  <section class="section">
    <h2 class="heading">Dati</h2>
    <div class="card flush list">
      {@render row(FileJson, 'Copia completa', 'Un file con routine, diario e impostazioni', exportAll)}
      {@render row(Upload, 'Ripristina una copia', 'Rimette i dati di una copia completa', () => fileInput.click())}
      {@render row(Trash, 'Cancella tutti i dati', '', wipe, true)}
    </div>
    <input class="sr-only" type="file" accept="application/json,.json" bind:this={fileInput} onchange={picked} tabindex="-1" aria-hidden="true" />
    <p class="small faint after">Cadenza {VERSION} · i dati restano su questo dispositivo</p>
  </section>
</div>

<style>
  .prefs {
    display: flex;
    flex-direction: column;
    gap: 18px;
    padding: 16px;
  }
  .prefs :global(.toggle .grow) {
    font-weight: 600;
  }
  .prefs :global(.toggle .muted) {
    font-weight: 400;
  }
  .trow {
    display: flex;
    align-items: center;
    gap: 14px;
  }
  .lbl {
    font-weight: 600;
  }
  .lbl .small {
    font-weight: 400;
  }
  .after {
    margin-top: 10px;
  }
</style>
