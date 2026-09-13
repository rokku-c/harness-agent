/**
 * weblui — render the agent's language UI (lui) back to a human, interactively.
 *
 * One page per app shows exactly what an agent sees: the view description, the
 * live state, and one form per action (same tools an agent would call). A
 * human's click/submit executes the SAME tool call an agent would make.
 */

import { interactiveSpec } from "./interactive.ts"
import type { ParityAppView } from "./types.ts"

export interface WebluiOptions {
  /** where POST {tool,args} is handled (same authorize as the agent). */
  readonly submitUrl: string
}

export const interactivePage = (view: ParityAppView, options: WebluiOptions): string => `
<!doctype html><html lang="en"><head><meta charset="utf-8"><title>weblui · ${view.ns}::${view.appId}</title>
<style>
body{margin:0;font:14px system-ui;background:#fdfdfc;color:#111;padding:18px}
h2{font-size:15px}
.row{display:grid;grid-template-columns:1fr 1fr;gap:14px}
@media(max-width:900px){.row{grid-template-columns:1fr}}
section{border:1px solid #ebe9e4;border-radius:10px;padding:10px 12px;background:#fff;margin-top:10px}
h3{margin:0 0 6px;font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#9a968e}
pre{white-space:pre-wrap;font-family:ui-monospace,monospace;font-size:11px;margin:0}
form{display:flex;flex-direction:column;gap:6px;margin:10px 0;border:1px solid #ebe9e4;border-radius:9px;padding:8px}
label{display:flex;flex-direction:column;gap:3px;font-size:12px;color:#333}
input,select{border:1px solid #d9d6cf;border-radius:6px;padding:5px 7px;font:inherit}
button{border:1px solid #237a4b;background:#237a4b;color:#fff;border-radius:7px;padding:6px 12px;cursor:pointer}
#out{margin-top:10px;font-family:ui-monospace,monospace;font-size:11px;white-space:pre-wrap;color:#2f6f43}
</style></head><body>
<h2>weblui · ${view.ns}::${view.appId} <small style="color:#9a968e">(what the agent sees, made clickable)</small></h2>
${view.actions.length > 0
  ? `<p style="color:#6e6b66">actions = agent's tools, same authorize · ${view.actions.length}</p>`
  : `<p style="color:#9a968e">no agent actions</p>`}
<div class="row"><div>${interactiveSpec(view)}</div><div>
<section><h3>agent actions</h3><div id="forms">(${view.actions.length} forms on the left, rendered from the same tool schemas the agent calls)</div></section>
</div></div>
<div id="out"></div>
<script>
const submitUrl = ${JSON.stringify(options.submitUrl)};
document.addEventListener('submit', async (e) => {
  const form = e.target.closest('form[data-action]');
  if (!form) return;
  e.preventDefault();
  const tool = form.getAttribute('data-action');
  const args = {};
  new FormData(form).forEach((v, k) => { args[k] = v; });
  const out = document.getElementById('out');
  out.textContent = 'running ' + tool + ' …';
  try {
    const res = await fetch(submitUrl, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ tool, args }) });
    out.textContent = tool + ' → ' + JSON.stringify(await res.json(), null, 2);
  } catch (err) { out.textContent = String(err); }
});
</script>
</body></html>`
