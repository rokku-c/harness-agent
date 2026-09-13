import { expect, test } from "bun:test"

import { htmlOf, languagesOf, specOf, type EffectUiView, type UiDocument } from "../src/index.ts"

const view: EffectUiView = { viewId: "demo", title: "Demo", nodes: [{ component: "Text", props: { value: "hello" } }] }
const html: UiDocument = { lang: "html", html: "<section>hello <b>html</b></section>" }

test("descriptions are language-neutral: same document in effect-ui / json-render / html", () => {
  const docView: UiDocument = { lang: "effect-ui", view }
  const docSpec = specOf(docView)
  expect(docSpec?.root).toBe("root")

  const docJson: UiDocument = { lang: "json-render", spec: docSpec! }
  expect(specOf(docJson)).toBe(docSpec)

  expect(specOf(html)).toBeUndefined()
  expect(htmlOf(html)).toContain("<b>html</b>")
  expect(htmlOf(docView)).toContain("hello")
})

test("languagesOf lists the representations a document can be generated into", () => {
  const docView: UiDocument = { lang: "effect-ui", view }
  expect(languagesOf(docView)).toEqual(["effect-ui", "json-render", "html"])
  expect(languagesOf({ lang: "json-render", spec: specOf(docView)! })).toEqual(["json-render"])
  expect(languagesOf(html)).toEqual(["html"])
})
