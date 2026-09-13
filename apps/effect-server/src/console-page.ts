/**
 * HTTP integration: serve this string as text/html from the existing console route.
 * The document is one empty root; every visible thing is a React tree the client
 * bundle builds, so the page and the app cannot describe two different consoles.
 *
 * The two inline bits exist because the bundle is large and the browser paints
 * before it runs. `color-scheme` decides the colour of the canvas the browser
 * paints *behind* the app, and the design system only sets it once its theme
 * element is in the DOM — so until then the canvas follows the operating system
 * rather than the reader's chosen appearance, and a reader who chose Light on a
 * dark machine sees the page flash dark on every load. Stamping the stored mode
 * on the document element before first paint, and reading it in CSS, closes that
 * window. The stamp uses the same rule the console uses: only an explicit
 * "light" or "dark" is a decision, anything else is the system's.
 */
const bootMode = `try{var m=localStorage.getItem("effect-theme");if(m==="light"||m==="dark")document.documentElement.dataset.themeMode=m}catch(e){}`

export const consolePage: string = `<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="color-scheme" content="light dark">
<title>effect-agent · Console</title>
<script>${bootMode}</script>
<link rel="stylesheet" href="/console-client.css">
<style>
html,body{height:100%;margin:0}#console-root{height:100%}
html[data-theme-mode="light"]{color-scheme:light}
html[data-theme-mode="dark"]{color-scheme:dark}
</style>
<script src="/console-client.js" defer></script></head><body><div id="console-root"></div></body></html>`
