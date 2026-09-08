import { notice, requestRefresh } from "./dom.js";
import { post } from "./api.js";
import { detailSession } from "./detail.js";

export function openSession() {
  const kind = document.querySelector("#openKind").value;
  const label = document.querySelector("#openLabel").value || "session";
  const sid = kind + "-" + Date.now().toString(36);
  const autoRaw = document.querySelector("#openAuto").value;
  const auto = autoRaw.split(",").map(function(s){ return s.trim(); }).filter(Boolean);
  const dflt = document.querySelector("#openDefault").value;
  const config = { label: label };
  if (auto.length || dflt !== "ask") config.consent = { autoApproveTools: auto, defaultDecision: dflt };
  post("/api/session", { kind: kind, sessionId: sid, config: config }).then(function(j){ if (j.ok) notice("已开启 " + j.session.sessionId); requestRefresh(); });
}
export function sendRow(id, text) {
  post("/api/session/" + encodeURIComponent(id) + "/send", { text: text }).then(function(j){
    if (j.ok) { notice("回复: " + String(j.text || "").slice(0, 120)); detailSession(id); }
    else if (j.awaiting && j.awaiting.length) notice("已挂起等审批: " + j.awaiting.join(","));
    else notice(j.detail || "失败");
    requestRefresh();
  });
}
export function demoAct(id, text) {
  post("/api/session/" + encodeURIComponent(id) + "/send", { text: text }).then(function(j){ notice(j.text || j.detail || "done"); requestRefresh(); });
}
export function closeSession(id) { post("/api/session/" + encodeURIComponent(id) + "/close", {}).then(function(){ notice("已关闭 " + id); requestRefresh(); }); }
export function closeAll() { post("/api/sessions/close-all", {}).then(function(j){ notice(j.ok ? ("已全部关闭 " + (j.closed || 0) + " 个会话") : (j.detail || "")); requestRefresh(); }); }
export function bulkDecide(allow) {
  post("/api/consent/bulk", { allow: allow }).then(function(j){ notice(j.ok ? ("已批量处理 " + (j.decided || 0) + " 条") : (j.detail || "")); requestRefresh(); });
}
export function decide(callId, allow) {
  post("/api/consent/" + encodeURIComponent(callId), { allow: allow }).then(function(j){ notice(j.ok ? (allow ? "已同意" : "已拒绝") : (j.detail || "")); requestRefresh(); });
}
