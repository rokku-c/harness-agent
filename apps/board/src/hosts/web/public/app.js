import { $, emptyState, showError } from "./dom.js";
import { readAgents, readRuns, readState } from "./api.js";
import { store, states } from "./state.js";
import { render } from "./render.js";
import { createEditor } from "./editor.js";
import { createEventPanel } from "./events.js";
import { loadDocuments } from "./doc-view.js";
const events = createEventPanel();
const editor = createEditor(() => store.tasks, change => {
  if (change.deletedId) store.tasks = store.tasks.filter(task => task.id !== change.deletedId);
  else {
    const index = store.tasks.findIndex(task => task.id === change.task.id);
    if (index === -1) store.tasks.push(change.task);
    else store.tasks[index] = change.task;
  }
  store.loaded = true; redraw(); void refresh();
});
const edit = task => editor.open(task), create = defaults => editor.open(undefined, defaults);
const redraw = () => { if (store.loaded) render(edit, create, redraw); };
let refreshing = false, refreshAgain = false;
async function refresh() {
  if (refreshing) { refreshAgain = true; return; }
  refreshing = true; $("#refresh-button").disabled = true;
  $("#content").setAttribute("aria-busy", "true"); showError($("#load-error"));
  $("#sync-status").textContent = "Syncing…";
  try {
    const [data, agentData, runData] = await Promise.all([readState(), readAgents(), readRuns()]);
    if (!Array.isArray(data.tasks)) throw new Error("Unexpected task response.");
    store.tasks = data.tasks; store.counts = data.counts; store.loaded = true;
    store.agents = agentData.agents ?? [];
    store.runs = new Map((runData.runs ?? []).filter(run => run.status === "running").map(run => [run.nodeId, run]));
    redraw(); $("#sync-status").textContent = "Synced · " + new Date().toLocaleTimeString("en-US", { hour12: false });
    const online = store.agents.filter(agent => agent.presence === "online").length;
    $("#agents-status").textContent = store.agents.length
      ? `${online}/${store.agents.length} agent${store.agents.length === 1 ? "" : "s"} online`
      : "No agents connected";
    events.refreshIfOpen();
  } catch (error) {
    showError($("#load-error"), error); $("#sync-status").textContent = "Sync failed — refresh to retry";
    if (!store.loaded) $("#content").replaceChildren(emptyState("Tasks unavailable", "Check the connection, then refresh."));
  } finally {
    refreshing = false; $("#refresh-button").disabled = false;
    $("#content").setAttribute("aria-busy", "false");
    if (refreshAgain) { refreshAgain = false; void refresh(); }
  }
}
for (const state of states) $("#state-filter").add(new Option(state.label, state.id));
for (const tab of document.querySelectorAll("[data-view]")) tab.addEventListener("click", () => {
  store.view = tab.dataset.view; redraw();
  // outlines are fetched the first time the view is opened, not on every page load
  if (store.view === "documents" && !store.docLoaded) {
    void loadDocuments().then(redraw).catch(error => showError($("#load-error"), error));
  }
});
$("#search").addEventListener("input", event => { store.query = event.target.value; redraw(); });
$("#state-filter").addEventListener("change", event => { store.state = event.target.value; redraw(); });
$("#create-button").addEventListener("click", () => create());
$("#refresh-button").addEventListener("click", refresh);
void refresh();
