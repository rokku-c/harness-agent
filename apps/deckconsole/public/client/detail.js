import { mk, fmt, $, notice } from "./dom.js";
import { api } from "./api.js";

export function renderDetail(id, d) {
  const box = $("#detail");
  box.innerHTML = "";
  const head = mk("div", "row");
  head.appendChild(mk("strong", null, "会话详情 " + id));
  head.appendChild(mk("span", "pill", "turns " + d.turns.length + " · consent " + d.consent.length));
  box.appendChild(head);
  if (!d.turns.length && !d.consent.length) { box.appendChild(mk("p", "empty", "暂无记录")); return; }
  const t = mk("table");
  const thead = mk("thead");
  const hr = mk("tr");
  ["时间", "方向", "内容"].forEach(function(c){ const th = mk("th", null, c); hr.appendChild(th); });
  thead.appendChild(hr); t.appendChild(thead);
  const tb = mk("tbody");
  d.turns.slice(-6).forEach(function(turn){
    const tr = mk("tr");
    tr.appendChild(mk("td", null, fmt(turn.at)));
    tr.appendChild(mk("td", null, turn.role === "user" ? "用户" : "agent"));
    const cell = mk("td", null, turn.content);
    tr.appendChild(cell);
    tb.appendChild(tr);
  });
  d.consent.forEach(function(c2){
    const tr = mk("tr");
    tr.appendChild(mk("td", null, fmt(c2.decidedAt || c2.askedAt)));
    tr.appendChild(mk("td", null, c2.tool + " → " + c2.decision + (c2.by ? " by " + c2.by : "")));
    tr.appendChild(mk("td", null, JSON.stringify(c2.input)));
    tb.appendChild(tr);
  });
  t.appendChild(tb);
  box.appendChild(t);
}
export function detailSession(id) {
  api("/api/session/" + encodeURIComponent(id) + "/history", {}).then(function(d){
    if (d && d.ok) renderDetail(id, d); else notice(d.detail || "读取失败");
  });
}
