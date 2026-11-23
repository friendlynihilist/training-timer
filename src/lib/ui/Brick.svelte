<script>
  // Il mattoncino di un esercizio: colore pieno della categoria, nome, volume e durata grande.
  let { cat = 'altro', name, sub = '', time, unit = 'min', onclick = null } = $props();
</script>

<svelte:element this={onclick ? 'button' : 'div'} class="brick" class:raise={onclick} data-cat={cat} {onclick} role={onclick ? undefined : 'group'}>
  <span class="txt">
    <span class="name">{name}</span>
    {#if sub}<span class="sub">{sub}</span>{/if}
  </span>
  <span class="min"><b class="t-num">{time}</b><small class="t-label">{unit}</small></span>
</svelte:element>

<style>
  .brick {
    display: flex;
    align-items: center;
    gap: 14px;
    width: 100%;
    min-height: 76px;
    padding: 12px 18px;
    border-radius: var(--r-brick);
    background: var(--f);
    color: var(--f-on);
    text-align: left;
  }
  .txt {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .name {
    font-size: 17px;
    font-weight: 750;
    letter-spacing: -0.01em;
    line-height: 1.2;
  }
  .sub {
    font-size: 13px;
    font-weight: 550;
    opacity: 0.85;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .min {
    display: flex;
    flex-direction: column;
    align-items: center;
    flex: none;
    line-height: 1;
  }
  .min b {
    font-size: 26px;
    font-weight: 600;
    letter-spacing: -0.04em;
  }
  .min small {
    font-size: 10px;
    margin-top: 3px;
    opacity: 0.85;
  }
</style>
