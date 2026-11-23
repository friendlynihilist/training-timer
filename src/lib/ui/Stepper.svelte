<script>
  // Un numero con meno e più ai lati. `format` decide come si legge (secondi, serie, chili).
  import Minus from '@lucide/svelte/icons/minus';
  import Plus from '@lucide/svelte/icons/plus';
  import { buzz } from '../ui.svelte.js';

  let { value, min = 0, max = 999, step = 1, label, format = (v) => String(v), onchange } = $props();

  function set(next) {
    // I decimali (mezzo chilo) non devono lasciare code tipo 2.4999.
    const v = Math.min(max, Math.max(min, Math.round(next * 100) / 100));
    if (v === value) return;
    buzz();
    onchange?.(v);
  }
</script>

<div class="stepper" role="group" aria-label={label}>
  <button type="button" onclick={() => set(value - step)} disabled={value <= min} aria-label="Meno"><Minus size={18} strokeWidth={2.6} /></button>
  <output class="t-num" aria-live="polite">{format(value)}</output>
  <button type="button" onclick={() => set(value + step)} disabled={value >= max} aria-label="Più"><Plus size={18} strokeWidth={2.6} /></button>
</div>

<style>
  .stepper {
    display: inline-flex;
    align-items: center;
    flex: none;
    padding: 4px;
    border-radius: 999px;
    background: var(--sunk);
  }
  button {
    display: grid;
    place-items: center;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: var(--card);
    color: var(--ink);
    transition: transform 0.18s var(--ease);
  }
  button:active {
    transform: scale(0.9);
  }
  button:disabled {
    opacity: 0.35;
  }
  output {
    min-width: 64px;
    padding: 0 6px;
    text-align: center;
    font-weight: 700;
  }
</style>
