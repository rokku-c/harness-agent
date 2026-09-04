/**
 * Interactive approval cards: outTrackId encodes the callId, the button's
 * static payload is decoded from the TOPIC_CARD callback, and the deliverer
 * posts the right body to createAndDeliver (callbackType STREAM).
 */
import { describe, expect, test } from "bun:test"
import {
  approvalOutTrackId, callIdFromOutTrackId, openApiCardDeliverer, parseCardAction
} from "../src/hosts/dingtalk/dingtalk-card.ts"

describe("dingtalk-card: callback parsing", () => {
  test("decodes outTrackId + approve from a stream callback payload", () => {
    const action = parseCardAction({
      outTrackId: approvalOutTrackId("call-1"),
      cardTemplateId: "tmpl",
      cardActionData: { action: "approve" },
      userId: "u1"
    })
    expect(action).toEqual({ callId: "call-1", action: "approve" })
  })

  test("decodes deny and tolerates JSON-string fields", () => {
    const action = parseCardAction(JSON.stringify({
      outTrackId: approvalOutTrackId("call-2"),
      cardData: { cardParamMap: {} },
      cardPrivateData: { params: { key: '{"action":"deny"}' } }
    }))
    expect(action).toEqual({ callId: "call-2", action: "deny" })
  })

  test("no verdict token or no outTrackId -> undefined", () => {
    expect(parseCardAction({ outTrackId: approvalOutTrackId("c1"), userId: "u" })).toBeUndefined()
    expect(parseCardAction({ cardActionData: { action: "approve" } })).toBeUndefined()
    expect(parseCardAction("not json")).toBeUndefined()
  })

  test("outTrackId round-trips the call id", () => {
    expect(callIdFromOutTrackId(approvalOutTrackId("abc-9"))).toBe("abc-9")
  })
})

describe("dingtalk-card: deliverer posts createAndDeliver", () => {
  test("builds the STREAM-callback body with outTrackId = callId", async () => {
    const calls: Array<{ url: string; body: Record<string, unknown> }> = []
    const originalFetch = globalThis.fetch
    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      const text = String(url)
      if (text.includes("/oauth2/accessToken")) {
        return new Response(JSON.stringify({ accessToken: "tok-1", expireIn: 7200 }), { status: 200 })
      }
      calls.push({ url: text, body: JSON.parse(String(init?.body)) as Record<string, unknown> })
      return new Response(JSON.stringify({ ok: true }), { status: 200 })
    }) as typeof fetch
    try {
      const deliverer = openApiCardDeliverer({
        clientId: "client-1",
        clientSecret: "secret-1",
        cardTemplateId: "tmpl-9"
      })
      await deliverer.sendApproval(
        { kind: "direct", userId: "owner-1" },
        { tool: "note_write", input: { text: "x" }, callId: "call-7", text: "mantis needs your approval" }
      )
      expect(calls).toHaveLength(1)
      expect(calls[0]!.url).toContain("/v1.0/card/instances/createAndDeliver")
      const body = calls[0]!.body
      expect(body.cardTemplateId).toBe("tmpl-9")
      expect(body.outTrackId).toBe(approvalOutTrackId("call-7"))
      expect(body.callbackType).toBe("STREAM")
      expect(String(body.openSpaceId)).toContain("IM_ROBOT.owner-1")
      const params = (body.cardData as { cardParamMap: Record<string, string> }).cardParamMap
      expect(params.tool).toBe("note_write")
      expect(params.callId).toBe("call-7")
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  test("group target uses the group openSpace + deliver model", async () => {
    const calls: Array<{ body: Record<string, unknown> }> = []
    const originalFetch = globalThis.fetch
    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      if (String(url).includes("/oauth2/accessToken"))
        return new Response(JSON.stringify({ accessToken: "tok-1", expireIn: 7200 }), { status: 200 })
      calls.push({ body: JSON.parse(String(init?.body)) as Record<string, unknown> })
      return new Response(JSON.stringify({ ok: true }), { status: 200 })
    }) as typeof fetch
    try {
      const deliverer = openApiCardDeliverer({
        clientId: "client-1", clientSecret: "secret-1", cardTemplateId: "tmpl-9"
      })
      await deliverer.sendApproval(
        { kind: "group", conversationId: "cid-g" },
        { tool: "note_write", input: {}, callId: "call-8", text: "approve?" }
      )
      const body = calls[0]!.body
      expect(String(body.openSpaceId)).toContain("IM_GROUP.cid-g")
      expect((body.imGroupOpenDeliverModel as Record<string, unknown>).robotCode).toBe("client-1")
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})
