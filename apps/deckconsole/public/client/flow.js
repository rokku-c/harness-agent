import { mk, btn, fmt, $ } from "./dom.js";
import { api } from "./api.js";

export function loadFlow() {
  api("/api/consent", {}).then(function(d){
    const box = $("#flow");
    box.innerHTML = "";
    if (!d || !d.ok) { box.appendChild(mk("p", "empty", "读取失败")); return; }
    const list = d.entries || [];
    if (!list.length) { box.appendChild(mk("p", "empty", "暂无同意记录：demo 会话里点「触发审批」会产生")); return; }
    const head = mk("div", "row");
    head.appendChild(mk("span", "pill", "共 " + list.length + " 条"));
    head.appendChild(mk("span", "pill", "待批 " + list.filter(function(e){ return e.decision === "pending"; }).length));
    const bAll = btn("全部同意（批量）", "ok", "bulk", { allow: "1" });
    head.appendChild(bAll);
    box.appendChild(head);
    const t = mk("table");
    const thead = mk("thead");
    const hr = mk("tr");
    ["时间", "session", "工具", "决议", "by", "输入"].forEach(function(c){ thead.appendChild(mk("th", null, c)); });
    t.appendChild(thead);
    const tb = mk("tbody");
    list.slice(0, 20).forEach(function(e){
      const tr = mk("tr");
      tr.appendChild(mk("td", null, fmt(e.decidedAt || e.askedAt)));
      tr.appendChild(mk("td", null, e.sessionId));
      tr.appendChild(mk("td", null, e.tool));
      const pillCls = e.decision === "allow" ? "pill ok" : e.decision === "deny" ? "pill no" : "pill red";
      const dcell = mk("td"); dcell.appendChild(mk("span", pillCls, e.decision)); tr.appendChild(dcell);
      tr.appendChild(mk("td", null, e.by || "-"));
      tr.appendChild(mk("td", null, JSON.stringify(e.input)));
      if (e.decision === "pending") {
        const ops = mk("td");
        ops.appendChild(btn("同意", "ok", "decide", { call: e.callId, allow: "1" }));
        ops.appendChild(btn("拒绝", "no", "decide", { call: e.callId, allow: "0" }));
        tr.appendChild(ops);
      }
      tb.appendChild(tr);
    });
    t.appendChild(tb);
    box.appendChild(t);
  });
}
