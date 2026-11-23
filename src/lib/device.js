// Suoni brevi, vibrazione e schermo sempre acceso durante la sessione.

let ctx = null;

/** Da chiamare dentro un tocco dell'utente: i browser sbloccano l'audio solo così. */
export function unlockAudio() {
  try {
    ctx ??= new (window.AudioContext ?? window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
  } catch {}
}

/** Una o più note in sequenza. `len` è la durata di ogni nota, `gain` il volume. */
export function chime(notes = [880, 1318], { len = 0.32, gap = 0.16, gain = 0.22 } = {}) {
  if (!ctx) return;
  try {
    notes.forEach((freq, i) => {
      const t = ctx.currentTime + i * gap;
      const osc = ctx.createOscillator();
      const vol = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      vol.gain.setValueAtTime(0.0001, t);
      vol.gain.exponentialRampToValueAtTime(gain, t + 0.02);
      vol.gain.exponentialRampToValueAtTime(0.0001, t + len);
      osc.connect(vol).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + len + 0.03);
    });
  } catch {}
}

/** Un tocco secco: gli ultimi secondi, le fasi del ritmo. */
export const tick = (freq = 660, gain = 0.16) => chime([freq], { len: 0.12, gain });

export function vibrate(pattern = 8) {
  try {
    navigator.vibrate?.(pattern);
  } catch {}
}

/** Tiene acceso lo schermo finché non si chiama la funzione restituita. */
export function keepAwake() {
  let lock = null;
  let active = true;

  const acquire = async () => {
    if (!active || document.hidden || !('wakeLock' in navigator)) return;
    try {
      lock = await navigator.wakeLock.request('screen');
    } catch {}
  };
  // Il sistema rilascia il blocco quando la pagina va in secondo piano: lo si richiede al ritorno.
  const onVisible = () => {
    if (!document.hidden) acquire();
  };

  acquire();
  document.addEventListener('visibilitychange', onVisible);

  return () => {
    active = false;
    document.removeEventListener('visibilitychange', onVisible);
    lock?.release?.().catch(() => {});
  };
}

export const reducedMotion = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

let loading = null;
/** I coriandoli alla fine della sessione (canvas-confetti, caricata solo la prima volta). */
export async function confetti(options = {}) {
  if (reducedMotion()) return;
  try {
    loading ??= import('canvas-confetti').then((m) => m.default);
    const fire = await loading;
    fire({ disableForReducedMotion: true, zIndex: 120, particleCount: 90, spread: 75, origin: { y: 0.7 }, ...options });
  } catch {}
}

/** Fa scaricare un file di testo. */
export function download(name, text, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
