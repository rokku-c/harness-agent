import { expect, test } from "bun:test"
import { makeAiGatewayHandler } from "../src/handler.ts"
import { paths, providers, request, stubFetch } from "./helpers.ts"

const bases = [
  ["https://upstream.test", "/v1"],
  ["https://upstream.test/", "/v1"],
  ["https://upstream.test/v1", "/v1"],
  ["https://upstream.test/v1/", "/v1"],
  ["https://upstream.test/team/proxy", "/team/proxy/v1"],
  ["https://upstream.test/team/proxy/", "/team/proxy/v1"],
  ["https://upstream.test/team/proxy/v1/", "/team/proxy/v1"],
  ["https://upstream.test/team/v10", "/team/v10/v1"],
  ["https://upstream.test/team%20a/v1", "/team%20a/v1"],
]

test("origin, /v1, and prefixed base URLs preserve route and repeated query parameters", async () => {
  for (const [baseURL, prefix] of bases) {
    const stub = stubFetch()
    const handle = makeAiGatewayHandler({ send: stub.send,
      getConfig: () => ({ providers: providers.map((provider) => ({ ...provider, baseURL })) }),
    })
    for (const [index, path] of paths.entries()) {
      await handle(request(`${path}?tag=a%2Fb&tag=c+d`))
      expect(stub.requests[index].url).toBe(`https://upstream.test${prefix}${path.slice(3)}?tag=a%2Fb&tag=c+d`)
    }
  }
})

test("base query and request query survive URL assembly", async () => {
  const stub = stubFetch()
  const handle = makeAiGatewayHandler({ send: stub.send, getConfig: () => ({ providers: [
    { ...providers[0], baseURL: "https://upstream.test/prefix/v1/?region=east#ignored" },
  ] }) })
  await handle(request("/v1/chat/completions?stream=true"))
  expect(stub.requests[0].url).toBe("https://upstream.test/prefix/v1/chat/completions?region=east&stream=true")
})
