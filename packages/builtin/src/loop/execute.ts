/** Tool primitives: safe decode diagnostics, unchanged business execution, and tool feedback. */
import { Effect, ParseResult, type SchemaAST } from "effect"
import { decode, type AgentEvent, type Op } from "@effect-agent/core"
import type { RunBox } from "./types.ts"
import type { WireToolCall } from "../wire.ts"

/** Schema-owned labels only: no actual values, literal values, annotations, or custom messages. */
const typeNames: Partial<Record<SchemaAST.AST["_tag"], string>> = {
  StringKeyword: "string", NumberKeyword: "number", BooleanKeyword: "boolean", BigIntKeyword: "bigint",
  TypeLiteral: "object", TupleType: "array", Literal: "declared literal", Union: "declared union",
  Enums: "declared enum", Refinement: "refined value", Transformation: "transformed value"
}
const typeLabel = (ast: SchemaAST.AST): string => typeNames[ast._tag] ?? "declared type"

/** Dynamic record keys can contain credentials; only declared fields and array indices are printable. */
const fieldPath = (path: ParseResult.Path, parent?: SchemaAST.AST): string => {
  const keys: ReadonlyArray<PropertyKey> = Array.isArray(path) ? path : [path as PropertyKey]
  return keys.map((key) => {
    const property = parent?._tag === "TypeLiteral" ? parent.propertySignatures.find((p) => p.name === key) : undefined
    const index = parent?._tag === "TupleType" && typeof key === "number" && Number.isSafeInteger(key) && key >= 0
    parent = property?.type
    return property && typeof key !== "symbol" ? "." + key : index ? `[${key}]` : "[key]"
  }).join("")
}

/** Reduce native parse issues to bounded field/type diagnostics, never stringify a decode failure. */
export const causeDetail = (error: unknown): string => {
  const cause = (error as { cause?: unknown })?.cause
  if (!ParseResult.isParseError(cause)) return "Tool input does not match the declared schema"
  const details: string[] = []
  const visit = (issue: ParseResult.ParseIssue, path = "$", parent?: SchemaAST.AST): void => {
    if (details.length >= 4) return
    switch (issue._tag) {
      case "Pointer": return visit(issue.issue, path + fieldPath(issue.path, parent), parent)
      case "Composite": {
        const children = "_tag" in issue.issues ? [issue.issues] : issue.issues
        for (const child of children) visit(child, path, issue.ast)
        return
      }
      case "Refinement": case "Transformation": return visit(issue.issue, path, issue.ast.from)
      case "Type": details.push(`${path}: expected ${typeLabel(issue.ast)}`); return
      case "Missing": details.push(`${path}: missing required field`); return
      case "Unexpected": details.push(`${path}: unexpected field`); return
      case "Forbidden": details.push(`${path}: value cannot be decoded`)
    }
  }
  visit(cause.issue)
  return "Invalid tool input: " + details.join("; ")
}

export interface FeedbackEnv {
  readonly agentName: string
  readonly emit: (event: AgentEvent) => Effect.Effect<void>
}

/** decoded + executed outcome of one call against one op */
export const runOp = <O>(op: Op<any, O, any, any>, input: unknown): Effect.Effect<{ ok: true; output: O } | { ok: false; detail: string }, never, any> =>
  decode(op.input as never, input).pipe(
    Effect.mapError((error) => ({ ok: false as const, detail: causeDetail(error) })),
    Effect.flatMap((typed) =>
      op.execute(typed as never).pipe(
        Effect.map((output) => ({ ok: true as const, output })),
        Effect.mapError((error) => {
          const inner = (error as { cause?: unknown })?.cause
          return { ok: false as const, detail: inner !== undefined ? String(inner) : String(error) }
        })
      )
    ),
    Effect.catchAll((failure) => Effect.succeed(failure))
  )

/** put a tool failure back as the model's next input (tool role message) */
export const feedBack = (env: FeedbackEnv, box: RunBox, call: WireToolCall, detail: string): Effect.Effect<void, never, any> =>
  Effect.gen(function* () {
    const text = call.name + " error: " + detail
    box.lastToolError = detail
    box.thread.push({ role: "tool", id: call.id, name: call.name, content: text })
    box.context = box.context.append({ _tag: "ToolResult", id: call.id, name: call.name, output: { error: text } })
    yield* env.emit({ _tag: "ToolResult", agent: env.agentName, tool: call.name, output: { error: text } })
  })
