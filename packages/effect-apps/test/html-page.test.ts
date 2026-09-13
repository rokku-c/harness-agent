import { expect, test } from "bun:test"
import { defineApp } from "../src/define.ts"
import { composeHtmlPage, defineHtmlPage } from "../src/html-page.ts"

test("composeHtmlPage injects page CSS and client code", () => {
  const page = composeHtmlPage({ html: "<style>/*__PAGE_CSS__*/</style><script>/*__PAGE_CLIENT__*/</script>", css: "body{}", client: "run()" })
  expect(page).toBe("<style>body{}</style><script>run()</script>")
})

test("composeHtmlPage rejects an incomplete page shell", () => {
  expect(() => composeHtmlPage({ html: "<style>/*__PAGE_CSS__*/</style>", css: "body{}", client: "run()" })).toThrow("/*__PAGE_CLIENT__*/")
})

test("defineHtmlPage owns the HTML response decision", () => {
  const page = defineHtmlPage({ html: "<p>/*__PAGE_CSS__*/ /*__PAGE_CLIENT__*/</p>", css: "css", client: "js" })
  expect(page.respond(new Request("http://app", { headers: { accept: "application/json" } }))).toBeUndefined()
  expect(page.respond(new Request("http://app", { headers: { accept: "text/html" } }))?.headers.get("content-type")).toBe("text/html; charset=utf-8")
})

test("defineApp derives a prefix route from path and preserves explicit routes", () => {
  expect(defineApp({ id: "demo", path: "/demo/", createPlugin: () => ({ id: "demo", load: async () => ({ handle: async () => new Response() }) }) }).routes).toEqual([{ path: "/demo", match: "prefix" }])
  const routes = [{ path: "/custom", match: "prefix" as const }]
  expect(defineApp({ id: "demo", path: "/demo", routes, createPlugin: () => ({ id: "demo", load: async () => ({ handle: async () => new Response() }) }) }).routes).toBe(routes)
})
