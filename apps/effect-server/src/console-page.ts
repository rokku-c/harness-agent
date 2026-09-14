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
