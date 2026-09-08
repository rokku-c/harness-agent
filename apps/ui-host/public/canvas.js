export const renderUrl = (id, moduleUrl = import.meta.url) => {
  const url = new URL("./api/render", moduleUrl);
  url.searchParams.set("canvasId", id);
  return url;
};
export const mountCanvas = (document, fetch) => {
  const app = document.querySelector("#app"), back = document.querySelector("#back"), history = [];
  const bind = id => app.querySelectorAll("[data-canvas-ref]").forEach(el => {
    el.onclick = () => { history.push(id); return show(el.dataset.canvasRef); };
  });
  const show = async id => {
    const response = await fetch(renderUrl(id));
    app.innerHTML = await response.text();
    back.hidden = history.length === 0;
    bind(id);
  };
  back.onclick = () => { const id = history.pop(); if (id) return show(id); };
  bind("root");
};
if (typeof document !== "undefined") mountCanvas(document, fetch);
