import { consoleBrowserScript } from "./console-browser.ts"
import { consoleStyle } from "./console-browser-style.ts"

/** HTTP integration: serve this string as text/html; no new static route/build. */
export const consolePage: string = `<!doctype html><html lang="zh-CN"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>effect-agent · Console</title><style>${consoleStyle}</style>
<script src="/console-client.js" defer></script></head><body>
<header><span class="brand-mark">e</span><b>effect-agent</b><span>WORKSPACE / CONSOLE</span></header>
<main><nav id="rail" aria-label="应用切换"></nav><section id="panel" aria-label="应用内容"></section></main>
<script>${consoleBrowserScript.replace(/<\/script/gi, "<\\/script")}</script></body></html>`
