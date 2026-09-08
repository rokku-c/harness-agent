import { existsSync, readFileSync } from "node:fs"

const root = new URL("./public/", import.meta.url)
const types: Record<string, string> = { html: "text/html; charset=utf-8", js: "text/javascript; charset=utf-8", css: "text/css; charset=utf-8", svg: "image/svg+xml" }
export const boardAsset = (path: string, basePath: string): Response | undefined => {
  const name = path === "/" ? "index.html" : path.slice(1)
  if (!/^[a-zA-Z0-9_-]+\.(html|js|css|svg)$/.test(name)) return undefined
  const file = new URL(name, root)
  if (!existsSync(file)) return undefined
  const content = name === "index.html" ? readFileSync(file, "utf8").replaceAll("__BASE__", basePath) : new Uint8Array(readFileSync(file))
  return new Response(content, { headers: { "content-type": types[name.split(".").at(-1)!] } })
}
