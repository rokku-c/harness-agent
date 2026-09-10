import { expect, test } from "bun:test"
import { consolePage } from "../../console-page.ts"

test("console page exposes stable roots and one deferred browser bundle", async () => {
  const roots: string[] = [], menuLabels: string[] = [], scripts: Array<{ src: string | null; defer: string | null }> = []
  await new HTMLRewriter().on("[id]", { element: element => { roots.push(element.getAttribute("id")!) } })
    .on(".shell-menu", { element: element => { menuLabels.push(element.getAttribute("aria-label")!) } })
    .on("script", { element: element => { scripts.push({ src: element.getAttribute("src"), defer: element.getAttribute("defer") }) } })
    .transform(new Response(consolePage)).text()
  expect(roots).toEqual(["rail", "panel"])
  expect(menuLabels).toEqual(["Back to Home"])
  expect(scripts).toEqual([{ src: "/console-client.js", defer: null }])
})
