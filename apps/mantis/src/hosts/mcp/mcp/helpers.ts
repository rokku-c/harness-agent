import { z } from "zod"

export const chatId = z.string().min(1).max(200)

export const text = (value: string) => ({ content: [{ type: "text" as const, text: value }] })
export const err = (value: string) => ({ content: [{ type: "text" as const, text: "error: " + value }], isError: true })
