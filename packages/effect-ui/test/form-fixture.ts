import type { JsonSchema } from "../src/form.ts"

export const scalarSchema: JsonSchema = {
  type: "object",
  properties: {
    dataFile: { type: "string", default: ".effect-agent/board.jsonl" },
    webPort: { type: "integer", default: 3999, minimum: 1, maximum: 65535 },
    ratio: { type: "number" }, captureBodies: { type: "boolean", default: false },
    coordinator: { type: "string", enum: ["none", "deepseek"], default: "none" },
    optionalKey: { type: "string" }, optionalFlag: { type: "boolean" },
    optionalMode: { type: "string", enum: ["fast", "slow"] },
    numericEnum: { type: "number", enum: [0, 1] },
  },
  required: ["dataFile", "webPort", "captureBodies"],
}
export const protocols = ["openai.chat", "openai.responses", "anthropic.message"]
export const providerSchema: JsonSchema = {
  type: "object", required: ["providers"], properties: {
    providers: { type: "array", default: [], items: {
      type: "object", required: ["id", "apiType", "baseURL"], properties: {
        id: { type: "string", minLength: 1 },
        apiType: { type: "string", enum: protocols },
        baseURL: { type: "string", minLength: 1 }, apiKey: { type: "string" }, enabled: { type: "boolean" },
      },
    } },
  },
}
export const formElements = async (html: string, selector: string) => {
  const result: Record<string, string>[] = []
  await new HTMLRewriter().on(selector, { element(element) {
    result.push({ tag: element.tagName, ...Object.fromEntries(element.attributes) })
  } }).transform(new Response(html)).text()
  return result
}
