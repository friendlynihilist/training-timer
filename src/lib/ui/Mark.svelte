<script>
  // Il marchio: tre blocchi impilati su fondo blu.
  let { size = 32 } = $props();
</script>

<svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
  <rect width="32" height="32" rx="9" fill="var(--court)" />
  <rect x="7" y="7" width="18" height="5" rx="2.5" fill="#fff" />
  <rect x="7" y="13.5" width="12" height="5" rx="2.5" fill="#fff" fill-opacity="0.72" />
  <rect x="7" y="20" width="18" height="5" rx="2.5" fill="#fff" fill-opacity="0.45" />
</svg>
