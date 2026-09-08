const publicDir = new URL("../../public/", import.meta.url)
const modules = new Set(["main", "api", "dom", "state", "tables", "flow", "detail", "config", "launchers", "actions"])

export const assets = async (request: Request, path: string, basePath: string) => {
  if (request.method !== "GET" && request.method !== "HEAD") return
  if (path === "/" || path === "/index.html") {
    const page = await Bun.file(new URL("index.html", publicDir)).text()
    return new Response(request.method === "HEAD" ? null : page.replaceAll("__DECK_BASE__", basePath), {
      headers: { "content-type": "text/html; charset=utf-8" },
    })
  }
  const module = /^\/client\/([a-z]+)\.js$/.exec(path)?.[1]
  if (path !== "/app.css" && (!module || !modules.has(module))) return
  const file = Bun.file(new URL(path.slice(1), publicDir))
  return new Response(request.method === "HEAD" ? null : file, {
    headers: { "content-type": path.endsWith(".js") ? "text/javascript; charset=utf-8" : "text/css; charset=utf-8" },
  })
}
