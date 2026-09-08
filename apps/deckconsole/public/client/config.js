import { notice } from "./dom.js";
import { api } from "./api.js";
import { state } from "./state.js";

export function loadPresets() {
  api("/api/presets", {}).then(function(d){
    if (!d || !d.ok) return;
    const dynamic = d.presets.filter(function(p){ return !p.builtin; });
    if (!dynamic.length) return;
    const openSel = document.querySelector("#openKind");
    const addSel = document.querySelector("#addKind");
    const cfgSel = document.querySelector("#cfgKind");
    [openSel, addSel, cfgSel].forEach(function(sel){
      dynamic.forEach(function(p){
        if (![...sel.options].some(function(o){ return o.value === p.kind; })) {
          const o = document.createElement("option");
          o.value = p.kind;
          o.textContent = p.kind + "（动态方言）";
          sel.appendChild(o);
        }
      });
    });
  });
}
export function previewConfig() {
  const kind = document.querySelector("#cfgKind").value;
  const raw = document.querySelector("#cfgRaw").value;
  try { JSON.parse(raw); } catch (e) { notice("原始配置不是合法 JSON"); return; }
  api("/api/config/preview?kind=" + encodeURIComponent(kind) + "&raw=" + encodeURIComponent(raw), {}).then(function(j){
    if (j.ok) {
      const el = document.querySelector("#cfgOut");
      let text = "统一配置:\n" + JSON.stringify(j.unified, null, 2);
      if (j.invocation) text += "\n\n调用计划 (spawn):\n" + j.invocation.file + " " + j.invocation.argv.map(function(a){ return a.indexOf(" ") >= 0 ? JSON.stringify(a) : a; }).join(" ");
      else if (j.unified && (j.unified.kind === "effect" || j.unified.kind === "claude-cc" || j.unified.kind === "demo")) text += "\n\n运行方式: 进程内驱动（非 spawn）";
      el.textContent = text;
    }
  });
}
export function loadSample() {
  const kind = document.querySelector("#cfgKind").value;
  const sample = state.samples[kind];
  if (sample !== undefined) document.querySelector("#cfgRaw").value = sample;
  previewConfig();
}
