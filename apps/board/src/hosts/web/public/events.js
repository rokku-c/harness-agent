import { $, el, emptyState, showError } from "./dom.js";
import { readEvents } from "./api.js";
import { formatTime } from "./state.js";
export function createEventPanel() {
  const dialog = $("#events-dialog"), list = $("#event-list");
  let loading = false;
  async function refresh() {
    if (loading) return;
    loading = true; $("#events-refresh").disabled = true;
    list.setAttribute("aria-busy", "true"); showError($("#events-error"));
    try {
      const { events } = await readEvents();
      if (!Array.isArray(events)) throw new Error("事件响应格式不正确。");
      list.replaceChildren();
      $("#event-count").textContent = `${events.length} 条事件`;
      for (const event of [...events].sort((a, b) => b.seq - a.seq)) {
        const card = el("details", "event-card"), heading = el("summary", "event-heading", `#${event.seq} · ${event.kind}`);
        heading.append(el("span", "event-time", `${formatTime(event.at)} · ${event.taskId}`));
        card.append(heading, el("pre", "event-data", JSON.stringify(event.data, null, 2)));
        list.append(card);
      }
      if (!events.length) list.append(emptyState("暂无事件", "任务变更后，可在这里查看事件记录。"));
    } catch (error) { showError($("#events-error"), error); }
    finally { loading = false; $("#events-refresh").disabled = false; list.setAttribute("aria-busy", "false"); }
  }
  $("#events-button").addEventListener("click", () => {
    dialog.showModal();
    if (!list.childElementCount) list.append(el("p", "muted", "正在读取事件…"));
    void refresh();
  });
  $("#events-close").addEventListener("click", () => dialog.close());
  $("#events-refresh").addEventListener("click", refresh);
  return { refreshIfOpen: () => { if (dialog.open) void refresh(); } };
}
