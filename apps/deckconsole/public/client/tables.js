import { mk, btn, fmt, statusLabel, $ } from "./dom.js";
import { sendRow } from "./actions.js";

export function renderTables(d) {
  const tb = document.querySelector("#sessions tbody"); tb.innerHTML = "";
  if (!d.sessions.length) { const tr = mk("tr"); const td = mk("td", "empty", "还没有会话：上方选个 agent 开启"); td.colSpan = 5; tr.appendChild(td); tb.appendChild(tr); }
  d.sessions.forEach(function(s){
    const tr = mk("tr");
    tr.appendChild(mk("td", null, s.sessionId));
    tr.appendChild(mk("td", null, s.kind));
    tr.appendChild(mk("td", null, statusLabel(s.status)));
    tr.appendChild(mk("td", null, fmt(s.lastActivityAt)));
    const ops = mk("td");
    const sendIn = document.createElement("input");
    sendIn.className = "rowSend";
    sendIn.placeholder = "输入提示词后回车或点发送";
    sendIn.addEventListener("keydown", function(ev){ if (ev.key === "Enter") sendRow(s.sessionId, sendIn.value); });
    ops.appendChild(sendIn);
    ops.appendChild(btn("发送", "ok", "send", { id: s.sessionId }));
    ops.appendChild(btn("问候", "", "demo", { id: s.sessionId, text: "hi", label: "问候" }));
    ops.appendChild(btn("触发审批", "", "demo", { id: s.sessionId, text: "ask:note_write {\"text\":\"需要你同意\"}", label: "审批" }));
    ops.appendChild(btn("关闭", "no", "close", { id: s.sessionId }));
    ops.appendChild(btn("详情", "", "detail", { id: s.sessionId }));
    tr.appendChild(ops); tb.appendChild(tr);
  });
  const cb = document.querySelector("#consent tbody"); cb.innerHTML = "";
  if (!d.mapping.length) { const tr = mk("tr"); const td = mk("td", "empty", "暂无 session→同意 记录"); td.colSpan = 5; tr.appendChild(td); cb.appendChild(tr); }
  d.mapping.forEach(function(m2){
    const tr = mk("tr");
    tr.appendChild(mk("td", null, m2.sessionId));
    tr.appendChild(mk("td", null, String(m2.entries)));
    const pcell = mk("td"); const pill = mk("span", "pill red", String(m2.pending)); pcell.appendChild(pill); tr.appendChild(pcell);
    tr.appendChild(mk("td", null, String(m2.allowed)));
    tr.appendChild(mk("td", null, String(m2.denied)));
    cb.appendChild(tr);
  });
  const pd = $("#pending"); pd.innerHTML = "";
  if (!d.pending.length) pd.appendChild(mk("p", "empty", "没有等待操作者的调用"));
  d.pending.forEach(function(p){
    const row = mk("div", "row");
    const who = mk("span", "pill", p.sessionId);
    row.appendChild(who);
    row.appendChild(mk("span", null, p.tool));
    row.appendChild(mk("code", null, JSON.stringify(p.input)));
    row.appendChild(btn("同意", "ok", "decide", { call: p.callId, allow: "1" }));
    row.appendChild(btn("拒绝", "no", "decide", { call: p.callId, allow: "0" }));
    pd.appendChild(row);
  });
}
