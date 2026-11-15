// THE TWO CUTS (his, 2026-09-25: "have a mobile-first cut and a server-first cut… I do both"). A phone gets the phone
// cut (mobile.js: a thumb-first shell, its own layout); anything else gets the desktop console (desk.js). The phone's
// More › "Open the full console" switches to the desktop cut on purpose, and the desktop's "Phone view" switches back.
let want = null
try { want = localStorage.getItem('lacuna.cut') } catch { /* private mode */ }
const phone = window.matchMedia('(max-width: 760px)').matches
if ((phone && want !== 'desk') || want === 'phone') import('./mobile.js').then((m) => m.init())
else import('./desk.js')
