export const $ = (s) => document.querySelector(s);
export const notice = (text) => { const n = $("#notice"); n.textContent = text; n.style.display = "block"; setTimeout(function(){ n.style.display = "none"; }, 2600); };
export const statusLabel = (s) => s === "running" ? "运行中" : s === "idle" ? "空闲" : s === "opening" ? "开启中" : s === "failed" ? "失败" : s;
export const fmt = (t) => t ? new Date(t).toLocaleTimeString("zh-CN", { hour12: false }) : "-";
export const mk = (tag, cls, text) => { const el = document.createElement(tag); if (cls) el.className = cls; if (text != null) el.textContent = text; return el; };
export const btn = (label, cls, act, data) => { const b = mk("button", cls, label); b.dataset.act = act; for (const k in data) b.dataset[k] = data[k]; return b; };
export const requestRefresh = () => document.dispatchEvent(new Event("deck:refresh"));
