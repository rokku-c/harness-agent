/**
 * mcp/helpers.ts - MCP TOOL REPLY HELPERS.
 *
 * Concept: every mantis MCP tool answers with the same JSON text content
 * envelope; err() marks tool failures (isError) so MCP clients surface them
 * as real tool errors rather than reply text.
 */
import { z } from "zod"

/** conversation ids are bounded so ids stay small over the wire */
export const chatId = z.string().min(1).max(200)

export const text = (value: string) => ({ content: [{ type: "text" as const, text: value }] })
export const err = (value: string) => ({ content: [{ type: "text" as const, text: "error: " + value }], isError: true })
