import { $, notify, showError } from "./dom.js";
import { createTask, updateTask, deleteTask } from "./api.js";
import { fillEditor, readEditor } from "./editor-fields.js";
export function createEditor(getTasks, onChange) {
  const dialog = $("#task-dialog"), form = $("#task-form");
  let current, busy = false;
  function setBusy(value) {
    busy = value;
    $("#editor-fields").disabled = value;
    for (const id of ["save-button", "delete-button", "editor-close", "editor-cancel"]) $("#" + id).disabled = value;
    $("#save-button").textContent = value ? "正在保存…" : current ? "保存修改" : "创建任务";
  }
  function close() { if (!busy) dialog.close(); }
  $("#editor-close").addEventListener("click", close);
  $("#editor-cancel").addEventListener("click", close);
  dialog.addEventListener("cancel", event => { if (busy) event.preventDefault(); });
  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (busy) return;
    showError($("#editor-error"));
    try {
      const body = readEditor(Boolean(current));
      setBusy(true);
      const task = current ? await updateTask(current.id, body) : await createTask(body);
      dialog.close(); notify(current ? "任务已更新" : "任务已创建");
      onChange({ task });
    } catch (error) { showError($("#editor-error"), error); }
    finally { setBusy(false); }
  });
  $("#delete-button").addEventListener("click", async () => {
    if (busy || !current || !window.confirm(`确定删除「${current.title}」？此操作无法撤销。`)) return;
    showError($("#editor-error")); setBusy(true);
    try {
      await deleteTask(current.id);
      dialog.close(); notify("任务已删除"); onChange({ deletedId: current.id });
    } catch (error) { showError($("#editor-error"), error); }
    finally { setBusy(false); }
  });
  return {
    open(task, defaults = {}) {
      current = task;
      fillEditor(task, getTasks(), defaults);
      $("#editor-heading").textContent = task ? "编辑任务" : "新建任务";
      $("#editor-kicker").textContent = task ? "TASK DETAILS" : "NEW TASK";
      $("#delete-button").hidden = !task;
      showError($("#editor-error")); setBusy(false);
      dialog.showModal(); form.elements.title.focus();
    },
  };
}
