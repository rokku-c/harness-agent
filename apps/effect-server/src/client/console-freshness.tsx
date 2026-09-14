import * as React from "react"
import { Button, Flex, Text, Tooltip } from "@radix-ui/themes"
import { readAt, type SourceState } from "./console-source.ts"

const Tone = ({ tone, children }: { readonly tone: "live" | "stale" | "failed"; readonly children: React.ReactNode }) =>
  <Text size="1" color={tone === "live" ? "gray" : tone === "stale" ? "amber" : "red"}>{children}</Text>

export const Freshness = ({ state, onRetry }: { readonly state: SourceState<unknown>; readonly onRetry: () => void }) => {
  if (state.status === "loading") return <Tone tone="live">Reading…</Tone>
  if (state.status === "ready") return <Tone tone="live">{`live · read at ${readAt(state.at)}`}</Tone>
  return <Flex align="center" gap="2" wrap="wrap">
    <Tone tone={state.value === undefined ? "failed" : "stale"}>
      {`${state.value === undefined ? "failed" : `stale · last read at ${state.at === undefined ? "never" : readAt(state.at)}`} · ${state.error}`}
    </Tone>
    <Tooltip content="Read this source again now">
      <Button size="1" variant="soft" color="gray" onClick={onRetry}>Retry now</Button>
    </Tooltip>
  </Flex>
}
