import { $, el, emptyState, showError } from "./dom.js";
import { readEvents } from "./api.js";
import { formatTime } from "./dates.js";
export function createEventPanel() {
  const dialog = $("#events-dialog"), list = $("#event-list");
  let loading = false;
  async function refresh() {
    if (loading) return;
    loading = true; $("#events-refresh").disabled = true;
    list.setAttribute("aria-busy", "true"); showError($("#events-error"));
    try {
      const { events } = await readEvents();
      if (!Array.isArray(events)) throw new Error("Unexpected events response.");
      list.replaceChildren();
      $("#event-count").textContent = `${events.length} event${events.length === 1 ? "" : "s"}`;
      for (const event of [...events].sort((a, b) => b.seq - a.seq)) {
        const card = el("details", "event-card"), heading = el("summary", "event-heading", `#${event.seq} · ${event.kind}`);
        heading.append(el("span", "event-time", `${formatTime(event.at)} · ${event.taskId}`));
        card.append(heading, el("pre", "event-data", JSON.stringify(event.data, null, 2)));
        list.append(card);
      }
      if (!events.length) list.append(emptyState("No events yet", "Changes to tasks appear here."));
    } catch (error) { showError($("#events-error"), error); }
    finally { loading = false; $("#events-refresh").disabled = false; list.setAttribute("aria-busy", "false"); }
  }
  $("#events-button").addEventListener("click", () => {
    dialog.showModal();
    if (!list.childElementCount) list.append(el("p", "muted", "Reading events…"));
    void refresh();
  });
  $("#events-close").addEventListener("click", () => dialog.close());
  $("#events-refresh").addEventListener("click", refresh);
  return { refreshIfOpen: () => { if (dialog.open) void refresh(); } };
}
