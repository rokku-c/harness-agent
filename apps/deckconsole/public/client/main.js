import { $, notice } from "./dom.js";
import { api } from "./api.js";
import { state } from "./state.js";
import { renderTables } from "./tables.js";
import { loadFlow } from "./flow.js";
import { detailSession } from "./detail.js";
import { loadPresets, previewConfig, loadSample } from "./config.js";
import { renderLaunchers, addLauncher, removeLauncher, quickLaunch } from "./launchers.js";
import { openSession, sendRow, demoAct, closeSession, closeAll, bulkDecide, decide } from "./actions.js";
export function refresh() {
  api("/api/deck", {}).then(function(d){
    if (!d || !d.kinds) return;
    state.launchers = d.launchers || [];
    state.samples = d.samples || {};
    $("#summary").textContent = "代理 " + d.kinds.length + " · 会话 " + d.sessions.length + " · 待批 " + d.pending.length;
    renderLaunchers();
    renderTables(d);
    loadFlow();
    loadPresets();
  });
}
document.addEventListener("click", function(ev){
  const t = ev.target;
  const b = t && t.closest ? t.closest("button[data-act]") : null;
  if (!b) return;
  const a = b.dataset;
  if (a.act === "demo") demoAct(a.id, a.text);
  else if (a.act === "close") closeSession(a.id);
  else if (a.act === "send") {
    const inp = b.closest("tr") && b.closest("tr").querySelector(".rowSend");
    if (inp && inp.value && inp.value.trim()) sendRow(a.id, inp.value.trim());
    else notice("先输入提示词");
  }
  else if (a.act === "detail") detailSession(a.id);
  else if (a.act === "bulk") bulkDecide(a.allow === "1");
  else if (a.act === "decide") decide(a.call, a.allow === "1");
  else if (a.act === "launch") quickLaunch(a.kind, a.label, a.config);
  else if (a.act === "rmlaunch") removeLauncher(a.kind, a.label);
});
document.querySelector("#cfgKind").addEventListener("change", loadSample);
Object.assign(globalThis, { refresh, openSession, closeAll, addLauncher, previewConfig, loadSample });
document.addEventListener("deck:refresh", refresh);
refresh();
setInterval(refresh, 2500);
