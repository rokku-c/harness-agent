/**
 * Uri decoupling: the uri convention (render/parse/normalize) is a pluggable
 * UriScheme, not core logic; a Container resolves through an injectable
 * UriResolver. External code defines its own uri system without touching core.
 */
import { describe, expect, test } from "bun:test"
import { Effect } from "effect"
import {
  Container, Uri, UriSpace, canonicalLookup, eaScheme, eaUri, exactLookup,
  makeBoard, makeGroup, normalizeLookup, defaultUriSpace
} from "@effect-agent/core"

const text = (s: string) => ({ _tag: "Text" as const, text: s })
const binding = (uri: string) => ({ uri, read: Effect.succeed(text("n")) })

describe("built-in ea scheme", () => {
  test("Uri.make keeps the legacy shape ea://<registry>/<kind>/<identity>[/<sub>]", () => {
    expect(Uri.make("mem", "notes", "ops")).toBe("ea://mem/notes/ops")
    expect(Uri.make("svc", "tracker", "main", "detail")).toBe("ea://svc/tracker/main/detail")
  })

  test("eaScheme render/parse round-trip, uri-encoding each segment", () => {
    const uri = eaUri("board", "my board/v1")
    expect(uri).toBe("ea://board/my%20board%2Fv1")
    expect(eaScheme.parse(uri)).toEqual({ scheme: "ea", segments: ["board", "my board/v1"] })
    expect(eaScheme.parse("mem://x")).toBeNull()
  })

  test("eaUri powers the shared resources", async () => {
    const board = await Effect.runPromise(makeBoard("daily"))
    const group = await Effect.runPromise(makeGroup("team", []))
    expect(board.uri).toBe("ea://board/daily")
    expect(group.uri).toBe("ea://group/team")
    expect(Uri.isEa(board.uri)).toBe(true)
  })
})

describe("custom uri schemes (external uri systems)", () => {
  /** an external "doc" convention: doc://<org>/<doc-id> */
  const docScheme = {
    scheme: "doc",
    render: (parts: { scheme: string; segments: readonly string[] }) =>
      "doc://" + parts.segments[0] + "/" + encodeURIComponent(parts.segments[1] ?? ""),
    parse: (uri: string) => {
      if (!uri.startsWith("doc://")) return null
      const [org, docId] = uri.slice("doc://".length).split("/")
      return { scheme: "doc", segments: [org, decodeURIComponent(docId ?? "")] }
    }
  }
  const space = new UriSpace([docScheme])

  test("a custom space renders, parses and normalizes its own scheme", () => {
    expect(space.render({ scheme: "doc", segments: ["acme", "readme v2"] })).toBe("doc://acme/readme%20v2")
    expect(space.parse("doc://acme/readme%20v2")).toEqual({ scheme: "doc", segments: ["acme", "readme v2"] })
    expect(space.normalize("doc://acme/readme%20v2")).toBe("doc://acme/readme%20v2")
    expect(space.parse("ea://mem/note/main")).toBeNull()
  })

  test("extend keeps the built-in ea scheme and adds custom ones", () => {
    const extended = defaultUriSpace.extend(docScheme)
    expect(extended.parse("ea://mem/note/main")).toEqual({ scheme: "ea", segments: ["mem", "note", "main"] })
    expect(extended.parse("doc://acme/x")).toEqual({ scheme: "doc", segments: ["acme", "x"] })
    expect(extended.render({ scheme: "doc", segments: ["acme", "x"] })).toBe("doc://acme/x")
  })

  test("rendering an unknown scheme fails loud", () => {
    expect(() => new UriSpace().render({ scheme: "nope", segments: [] })).toThrow(/unknown scheme 'nope'/)
  })
})

describe("Container resolution is injectable", () => {
  test("default resolver is exact key lookup (historical behavior)", () => {
    const container = new Container([binding("ea://mem/note/main")])
    expect(container.get("ea://mem/note/main")).toBeDefined()
    expect(container.get("ea://mem/note/other")).toBeUndefined()
  })

  test("exactLookup is the same default and can be passed explicitly", () => {
    const container = new Container([binding("ea://mem/note/main")], exactLookup)
    expect(container.get("ea://mem/note/main")).toBeDefined()
    expect(container.get("missing")).toBeUndefined()
  })

  test("normalizeLookup canonicalizes the query before lookup", () => {
    const space = defaultUriSpace
    const container = new Container(
      [binding("ea://board/my%20board")],
      normalizeLookup(space)
    )
    // both the canonical form and the human un-encoded form resolve
    expect(container.get("ea://board/my%20board")).toBeDefined()
    expect(container.get("ea://board/my board")).toBeDefined()
    // an unrelated uri still misses
    expect(container.get("ea://board/other")).toBeUndefined()
  })

  test("canonicalLookup matches by normalized identity on both sides", () => {
    const space = defaultUriSpace
    // registered under the encoded form; queried with the human form
    const container = new Container([binding("ea://mem/note/main%20thing")], canonicalLookup(space))
    expect(container.get("ea://mem/note/main thing")).toBeDefined()
    expect(container.get("ea://mem/note/other")).toBeUndefined()
  })

  test("a custom resolver implements aliasing for an external uri system", () => {
    // external system stores bindings under doc:// uris; a resolver maps the
    // query uri to the stored one (here: an alias table)
    const aliases: Record<string, string> = { "my://doc/readme": "doc://acme/readme" }
    const container = new Container(
      [binding("doc://acme/readme")],
      (uri, table) => table.get(aliases[uri] ?? uri)
    )
    expect(container.get("doc://acme/readme")).toBeDefined()
    expect(container.get("my://doc/readme")).toBeDefined() // alias resolves
    expect(container.get("my://doc/other")).toBeUndefined()
  })
})
