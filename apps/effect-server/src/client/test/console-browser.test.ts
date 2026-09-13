import { expect, test } from "bun:test"
import { consolePage } from "../../console-page.ts"

test("the console page ships one mount root, the bundle that fills it, and the stylesheet that paints it", async () => {
  const roots: string[] = [], scripts: Array<{ src: string | null; deferred: boolean; inline: boolean }> = [], styles: string[] = []
  await new HTMLRewriter()
    .on("[id]", { element: element => { roots.push(element.getAttribute("id")!) } })
    .on("script", { element: element => { scripts.push({
      src: element.getAttribute("src"), deferred: element.hasAttribute("defer"),
      // the appearance stamp has to run before the first paint, which means it
      // is inline and before the stylesheet — the bundle is deferred either way
      inline: element.getAttribute("src") === null }) } })
    .on('link[rel="stylesheet"]', { element: element => { styles.push(element.getAttribute("href")!) } })
    .transform(new Response(consolePage)).text()
  expect(roots).toEqual(["console-root"])
  expect(scripts).toEqual([{ src: null, deferred: false, inline: true }, { src: "/console-client.js", deferred: true, inline: false }])
  // the stylesheet is an asset the bundle emits; without the link the console renders unstyled
  expect(styles).toEqual(["/console-client.css"])
})
