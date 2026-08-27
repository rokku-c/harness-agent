const build = await Bun.build({
  entrypoints: ["examples/webui/main.ts"],
  target: "browser",
  format: "esm",
  sourcemap: "inline"
})

if (!build.success || !build.outputs[0]) {
  for (const log of build.logs) console.error(log)
  throw new Error("Unable to build WebUI")
}

const javascript = await build.outputs[0].text()
const html = await Bun.file("examples/webui/index.html").text()
const port = Number(process.env.PORT ?? 4173)

const server = Bun.serve({
  port,
  fetch(request) {
    const path = new URL(request.url).pathname
    if (path === "/app.js") return new Response(javascript, { headers: { "content-type": "text/javascript; charset=utf-8" } })
    if (path === "/" || path === "/index.html") return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } })
    return new Response("Not found", { status: 404 })
  }
})

console.log(`WebUI: ${server.url}`)
