import { z, type ConfigDeclaration } from "@effect-agent/effect-config"

const port = z.object({ id: z.string().min(1), hostname: z.string().default("127.0.0.1"),
  port: z.number().int().min(0).max(65535), apps: z.array(z.string()).optional(),
}).strict()
export const networkSchema = z.object({
  role: z.enum(["main", "peer"]).default("main"),
  listeners: z.array(port).default([{ id: "main", hostname: "127.0.0.1", port: 8080 }]),
  main: z.object({ url: z.string().url(), token: z.string().min(16) }).strict().optional(),
  relayToken: z.string().min(16).optional(),
  localAvailable: z.boolean().default(true),
}).strict().superRefine((config, ctx) => {
  const ids = new Set<string>()
  config.listeners.forEach((listener, index) => {
    if (ids.has(listener.id)) ctx.addIssue({ code: "custom", path: ["listeners", index, "id"], message: "Duplicate listener id" })
    ids.add(listener.id)
  })
})
export const networkConfig: ConfigDeclaration = {
  appId: "platform-network", title: "平台网络", schema: networkSchema,
  description: "监听入口、共享路由、出口节点彼此独立；内置应用不监听端口。",
}
