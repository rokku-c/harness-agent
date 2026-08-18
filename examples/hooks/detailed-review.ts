import { Effect } from "effect"
import { Harness, type HarnessEvent } from "effect-agent"

const started = performance.now()
const toolStarted = new Map<string, number>()

const elapsed = () => `${((performance.now() - started) / 1000).toFixed(2)}s`

const preview = (value: unknown, limit = 1200): unknown => {
  if (typeof value === "string") return value.length <= limit
    ? value
    : `${value.slice(0, limit)}\n… <${value.length - limit} chars omitted; total ${value.length}>`
  if (Array.isArray(value)) return value.length <= 100
    ? value.map((item) => preview(item, limit))
    : [...value.slice(0, 100).map((item) => preview(item, limit)), `… <${value.length - 100} items omitted>`]
  if (value && typeof value === "object") return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, preview(item, limit)])
  )
  return value
}

const write = (event: string, detail?: unknown) => {
  const heading = `[agent ${elapsed()}] ${event}`
  if (detail === undefined) return console.error(heading)
  console.error(`${heading}\n${JSON.stringify(preview(detail), null, 2)}`)
}

/**
 * 通用 detail hook：打印一次 agent run 的完整细节。
 * 适用于任意 driver（Claude Code、Codex、Pi、Vercel），不绑定特定场景。
 *
 *   const agent = Harness.withHooks(driver, DetailHook)
 *
 * 输出：
 *   - RunStarted     初始 context（always / current / until）
 *   - DriverPrepared 驱动配置详情
 *   - ToolStarted / ToolCompleted  工具调用过程
 *   - Detail         驱动暴露的内部过程（thinking / text / toolCall）
 *   - Output         最终结构化输出
 *   - RunFailed / RunCompleted     运行结束
 */
export const DetailHook = Harness.hook("detail", (event: HarnessEvent) => Effect.sync(() => {
  switch (event._tag) {
    case "RunStarted":
      write(`run started: ${event.agent}`, {
        always: event.context.always.map((entry) => entry.text),
        current: event.context.current.map((entry) =>
          entry._tag === "Text" ? entry.text : `Object: ${preview(entry.value)}`),
        until: event.context.until?._tag ?? "Stop"
      })
      break
    case "DriverPrepared":
      write(`driver prepared: ${event.runtime}`, event.details)
      break
    case "ToolStarted": {
      toolStarted.set(event.callId, performance.now())
      write(`tool call → ${event.tool}`, { callId: event.callId, tool: event.tool, input: event.input })
      break
    }
    case "ToolCompleted": {
      const toolStart = toolStarted.get(event.callId)
      toolStarted.delete(event.callId)
      write(`tool result ← ${event.tool}`, {
        callId: event.callId,
        tool: event.tool,
        durationMs: toolStart === undefined ? undefined : Math.round(performance.now() - toolStart),
        output: event.output
      })
      break
    }
    case "Detail":
      write(`detail: ${event.detail._tag}`, event.detail)
      break
    case "Output":
      write("structured output", event.output)
      break
    case "RunFailed":
      write(`run failed: ${event.agent}`, {
        tag: event.error._tag,
        message: "message" in event.error ? event.error.message : undefined,
        error: String(event.error)
      })
      break
    case "RunCompleted":
      write(`run completed: ${event.agent}`)
      break
  }
}))
