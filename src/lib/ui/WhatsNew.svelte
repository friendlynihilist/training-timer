<script>
  // Le novità: compaiono una volta sola dopo un aggiornamento, oppure da Impostazioni. La versione
  // più recente sta sul riquadro blu, come la routine in Oggi; ogni novità ha il suo mattoncino.
  import { fade } from 'svelte/transition';
  import { cubicOut, backOut } from 'svelte/easing';
  import CalendarDays from '@lucide/svelte/icons/calendar-days';
  import Sparkles from '@lucide/svelte/icons/sparkles';
  import ShieldCheck from '@lucide/svelte/icons/shield-check';
  import Dumbbell from '@lucide/svelte/icons/dumbbell';
  import Repeat from '@lucide/svelte/icons/repeat-2';
  import Tag from '@lucide/svelte/icons/tag';
  import BookOpen from '@lucide/svelte/icons/book-open';
  import Timer from '@lucide/svelte/icons/timer';
  import Check from '@lucide/svelte/icons/check';
  import Play from '@lucide/svelte/icons/play';
  import TrendingUp from '@lucide/svelte/icons/trending-up';
  import Layers from '@lucide/svelte/icons/layers';
  import Blocks from '@lucide/svelte/icons/blocks';
  import { CHANGELOG, VERSION } from '../changelog.js';
  import { fmtLong } from '../dates.js';

  let { entries = CHANGELOG.slice(0, 1), history = false, onclose } = $props();

  const CATS = ['mobilita', 'forza', 'allungamento', 'attivazione', 'core', 'cardio', 'recupero'];
  const ICONS = { calendar: CalendarDays, sparkles: Sparkles, shield: ShieldCheck, dumbbell: Dumbbell, repeat: Repeat, tag: Tag, book: BookOpen, timer: Timer, check: Check, play: Play, trending: TrendingUp, layers: Layers, blocks: Blocks };
  const list = $derived(history ? CHANGELOG : entries);

  /** Sale e si assesta: un po' di scala, un po' di spostamento. */
  function pop(_node, { duration = 520 } = {}) {
    return {
      duration,
      css: (t) => {
        const e = backOut(t);
        return `opacity:${cubicOut(t)};transform:translateY(${(1 - e) * 28}px) scale(${0.94 + 0.06 * e})`;
      }
    };
  }

  function onkey(e) {
    if (e.key === 'Escape') onclose?.();
  }
</script>

<svelte:window onkeydown={onkey} />

<div class="scrim" transition:fade={{ duration: 220 }} onclick={onclose} role="presentation"></div>
<div class="wrap" role="dialog" aria-modal="true" aria-labelledby="wn-title">
  <div class="modal" in:pop out:fade={{ duration: 160 }}>
    <div class="scroll">
      {#each list as entry, n (entry.version)}
        <section class:older={n > 0}>
          <div class="head" class:court={n === 0}>
            <p class="eyebrow">
              <span class="ver">v{entry.version}</span>
              {#if n === 0 && entry.version === VERSION && !history}<span class="new">Novità</span>{/if}
              <span class="when">{fmtLong(entry.date)}</span>
            </p>
            <h2 id={n === 0 ? 'wn-title' : undefined} class="title">{entry.title}</h2>
          </div>
          <ul>
            {#each entry.items as item, i (i)}
              {@const Icon = ICONS[item.icon] ?? Sparkles}
              <li style:animation-delay="{180 + i * 70}ms">
                <span class="ic" data-cat={CATS[i % CATS.length]}><Icon size={18} strokeWidth={2.2} /></span>
                <span>{item.text}</span>
              </li>
            {/each}
          </ul>
          {#if entry.note}<p class="note small" style:animation-delay="{180 + entry.items.length * 70}ms">{entry.note}</p>{/if}
        </section>
      {/each}
    </div>
    <footer>
      <button class="btn accent wide" onclick={onclose}>{history ? 'Chiudi' : 'Andiamo'}</button>
    </footer>
  </div>
</div>

<style>
  .scrim {
    position: fixed;
    inset: 0;
    z-index: 90;
    background: var(--scrim);
    backdrop-filter: blur(3px);
  }
  .wrap {
    position: fixed;
    inset: 0;
    z-index: 91;
    display: grid;
    place-items: center;
    padding: 20px 16px;
    pointer-events: none;
  }
  .modal {
    pointer-events: auto;
    width: 100%;
    max-width: 420px;
    max-height: min(640px, calc(100dvh - 40px));
    display: flex;
    flex-direction: column;
    background: var(--card);
    box-shadow: var(--shadow-card);
    border-radius: 24px;
    box-shadow: var(--shadow);
    overflow: hidden;
  }
  .scroll {
    overflow-y: auto;
    padding: 12px 12px 8px;
    display: flex;
    flex-direction: column;
    gap: 22px;
  }
  section > :not(.court) {
    margin-left: 12px;
    margin-right: 12px;
  }
  /* Il riquadro blu con i due anelli, come in Oggi. */
  .court {
    position: relative;
    padding: 20px 18px 18px;
    border-radius: 18px;
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
    top: -60px;
    right: -60px;
    width: 180px;
    height: 180px;
    opacity: 0.16;
  }
  .court::after {
    top: -26px;
    right: -26px;
    width: 112px;
    height: 112px;
    opacity: 0.24;
  }
  .court > * {
    position: relative;
    z-index: 1;
  }
  .when {
    opacity: 0.75;
  }
  section.older {
    padding-top: 20px;
    border-top: 1px solid var(--line);
  }
  .eyebrow {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
  }
  .ver {
    font-weight: 700;
  }
  .new {
    padding: 2px 8px;
    border-radius: 999px;
    background: #fff;
    color: #10151d;
    font-weight: 700;
    font-size: 11px;
    animation: pop 0.5s var(--spring) 0.25s both;
  }
  .title {
    margin: 8px 0 0;
    padding-right: 34px;
    font-family: var(--sans);
    font-size: 28px;
    font-weight: 800;
    letter-spacing: -0.03em;
    line-height: 1.1;
    text-wrap: balance;
  }
  .older .title {
    font-size: 20px;
  }
  ul {
    list-style: none;
    margin: 18px 0 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  li {
    display: flex;
    gap: 12px;
    align-items: flex-start;
    font-size: 15.5px;
    line-height: 1.4;
    animation: rise 0.5s var(--ease-out) both;
  }
  .ic {
    display: grid;
    place-items: center;
    flex: none;
    width: 36px;
    height: 34px;
    border-radius: 11px;
    background: var(--f);
    color: var(--f-on);
    box-shadow: 0 3px 0 var(--f-edge);
  }
  .older .ic {
    background: var(--sunk);
    color: var(--ink-2);
    box-shadow: none;
  }
  .note {
    margin-top: 18px;
    padding: 10px 12px;
    border-radius: var(--r-s);
    background: var(--sunk);
    color: var(--ink-2);
    animation: rise 0.5s var(--ease-out) both;
  }
  footer {
    padding: 16px 24px 22px;
  }
</style>
