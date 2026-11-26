<script>
  // A cosa serve una routine (mobilità, ipertrofia, altro): un'etichetta con il pallino del suo
  // colore, lo stesso che ha nei progressi. Sta sulla scheda di ogni routine e di ogni seduta.
  import { TYPE } from '../model.js';

  /** `onblue` sul riquadro blu di Oggi. */
  let { type = 'altro', onblue = false } = $props();
  const t = $derived(TYPE[type] ?? TYPE.altro);
</script>

<span class="tag type" class:onblue data-type={t.id}><i></i>{t.name}</span>

<style>
  .type {
    flex: none;
    gap: 6px;
    align-self: flex-start;
  }
  i {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--t);
  }
  .onblue {
    background: rgba(255, 255, 255, 0.18);
    color: #fff;
  }
  .onblue i {
    background: #fff;
  }
</style>
