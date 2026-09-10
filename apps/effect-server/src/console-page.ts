/**
 * HTTP integration: serve this string as text/html from the existing console route.
 * #rail + #panel are the ONLY id-bearing elements (client test pins doc order).
 */
export const consolePage: string = `<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="color-scheme" content="light dark">
<title>effect-agent · Console</title>
<script src="/console-client.js" defer></script></head><body data-shell-view="home">
<div class="status-bar" data-ui-role="status-bar"><button type="button" class="status-home" aria-label="Home">⌂</button><span class="status-title">effect-agent</span><span class="status-state">Loading system status…</span><span class="status-time" data-status-time></span><button type="button" class="status-theme" aria-label="Appearance">◐</button></div>
<main class="c-body" data-ui-role="workspace"><nav id="rail" class="c-nav ui-role-dock" data-ui-role="dock" aria-label="App navigation"></nav><section id="panel" class="c-panel" data-ui-role="app-surface" aria-label="App content"></section></main>
<button type="button" class="shell-menu" aria-label="Back to Home">☰</button>
</body></html>`
