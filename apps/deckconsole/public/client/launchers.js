import { mk, btn, $, notice, requestRefresh } from "./dom.js";
import { api, post } from "./api.js";
import { state } from "./state.js";

export function renderLaunchers() {
  const el = $("#launchers"); el.innerHTML = "";
  if (!state.launchers.length) return;
  el.appendChild(mk("span", "pill", "快捷启动"));
  state.launchers.forEach(function(l){
    const chip = btn(l.label, "", "launch", { kind: l.kind, label: l.label, config: JSON.stringify(l.config || {}) });
    if (l.config) chip.title = "配置: " + JSON.stringify(l.config).slice(0, 120);
    el.appendChild(chip);
  });
}
export function addLauncher() {
  const kind = document.querySelector("#addKind").value;
  const label = document.querySelector("#addLabel").value.trim();
  if (!label) { notice("填个标签"); return; }
  const cfgRaw = document.querySelector("#addCfg").value.trim();
  let config;
  if (cfgRaw) {
    try { config = JSON.parse(cfgRaw); } catch (_e) { notice("配置JSON解析失败"); return; }
  }
  post("/api/launchers", { kind: kind, label: label, config: config }).then(function(j){ notice(j.ok ? "已添加 " + label : (j.detail || "")); requestRefresh(); });
}
export function removeLauncher(kind, label) {
  api("/api/launchers/" + encodeURIComponent(label) + "?kind=" + encodeURIComponent(kind), { method: "DELETE" }).then(function(j){ if (j.ok) notice("已移除 " + label); requestRefresh(); });
}
export function quickLaunch(kind, label, config) {
  const sid = kind + "-" + Date.now().toString(36);
  const cfg = { label: label };
  let extra = {};
  try { extra = config ? JSON.parse(config) : {}; } catch (_e) {}
  for (const k2 in extra) cfg[k2] = extra[k2];
  post("/api/session", { kind: kind, sessionId: sid, config: cfg }).then(function(j){ if (j.ok) notice("已开启 " + j.session.sessionId); requestRefresh(); });
}
