import { expect, test } from "bun:test"
import { Script } from "node:vm"
import { consolePage } from "../../console-page.ts"
import { consoleBrowserScript } from "../../console-browser.ts"

test("no-build inline script runs its real boot path without bundler/import globals", async () => {
  const blocks: { textContent?: string; className?: string; dataset: object; setAttribute: (...args: unknown[]) => void }[] = []
  const panel = { replaceChildren() {}, append(block: typeof blocks[number]) { blocks.push(block) } }
  const calls: string[] = []
  const fetcher = async (url: string) => { calls.push(url); return new Response(null, { status: 503 }) }
  const context = {
    window: { fetch: fetcher }, fetch: fetcher,
    document: { getElementById: () => panel, createElement: () => ({ dataset: {}, setAttribute() {} }) },
  }
  new Script(consoleBrowserScript).runInNewContext(context)
  await new Promise(resolve => setTimeout(resolve, 0))
  expect(calls).toEqual(["/-/apps"])
  expect(blocks[0].textContent).toBe("应用列表读取失败：HTTP 503")
})

test("page exposes stable navigation roots, bundled view script and executable inline code", async () => {
  const roots: string[] = [], scripts: (string | null)[] = []
  await new HTMLRewriter().on("[id]", { element: element => { roots.push(element.getAttribute("id")!) } })
    .on("script", { element: element => { scripts.push(element.getAttribute("src")) } })
    .transform(new Response(consolePage)).text()
  expect(roots).toEqual(["rail", "panel"])
  expect(scripts).toEqual(["/console-client.js", null])
})
