/**
 * schema/render.tsx - the RENDERER catalog (渲染层): JSON spec -> Mantine.
 *
 * Every SpecType maps to a small view; unknown props are ignored. The
 * catalog is the ONLY place styles/visual decisions live for spec content,
 * so swapping to another skin means replacing this file's mappings.
 */
import { type JSX } from "react"
import { Badge, Button, Code, Divider, Group, Paper, Stack, Text } from "@mantine/core"
import { IconCheck, IconX } from "@tabler/icons-react"
import type { SpecAction, SpecNode } from "./types.ts"

export interface RenderCtx {
  /** dispatch a button action (name + opaque data) back to the product code */
  readonly onAction?: (action: SpecAction) => void
}

const anyP = (node: SpecNode): Record<string, unknown> => node.props ?? {}
// Mantine props are broad; this cast is the single exception site in the catalog.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const asAny = (p: unknown): any => p

export const renderNode = (node: SpecNode, ctx: RenderCtx): JSX.Element => {
  const p = anyP(node)
  const kids = (node.children ?? []).map((c) => renderNode(c, ctx))
  const fire = (): void => ctx.onAction?.({ name: p.action as string, data: p.data })
  const style = (p.style ?? {}) as Record<string, unknown>
  const text = (p.text as string) ?? ""
  switch (node.type) {
    case "text":
      return (
        <Text
          size={p.size as "xs" | "sm" | "md" | undefined}
          c={p.c as string | undefined}
          fw={p.fw as number | undefined}
          style={{
            ...style,
            ...(p.mono === true ? { fontFamily: "var(--mantine-font-family-monospace)" } : {}),
            ...(p.center === true ? { textAlign: "center" as const } : {}),
            ...(typeof p.mt === "number" ? { marginTop: p.mt } : {})
          }}
        >
          {text}
        </Text>
      )
    case "badge":
      return <Badge size={p.size as "xs" | undefined} variant={p.variant as "light" | "outline" | undefined} color={p.color as any}>{text}</Badge>
    case "code":
      return <Code block style={asAny(style)}>{text}</Code>
    case "button": {
      const left = p.icon === "check" ? <IconCheck size={13} /> : p.icon === "x" ? <IconX size={13} /> : undefined
      return (
        <Button size="compact-sm" color={p.color as any} variant={p.variant as "light" | "subtle" | "outline" | undefined} leftSection={left} onClick={fire}>
          {text}
        </Button>
      )
    }
    case "paper":
      return <Paper p={p.p as string | undefined} radius={p.radius as string | undefined} withBorder style={asAny(style)}>{kids}</Paper>
    case "row":
      return (
        <Group gap={p.gap as string | undefined} justify={p.justify as "space-between" | "flex-end" | "flex-start" | undefined} style={asAny(style)}>
          {kids}
        </Group>
      )
    case "col":
      return <Stack gap={p.gap as string | undefined} style={asAny(style)}>{kids}</Stack>
    case "divider":
      return <Divider my={p.my as number | undefined} />
    case "spacer":
      return <div style={{ flex: 1 }} />
  }
}
