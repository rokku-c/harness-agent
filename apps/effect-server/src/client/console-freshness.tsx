/**
 * The freshness marker: a time and a state, the same control on every surface
 * that reads a source.
 *
 * It is not decoration. §2's shared state rules make it the thing that makes H12
 * possible: a reader looking at rows needs to know whether they are live, how old
 * they are when they are not, and — the affordance today's console has nowhere at
 * all — what to press to try again. `live` and `stale` are the two answers to
 * "are these rows true", and the difference between them is whether the last read
 * succeeded, not how long ago it was.
 */

import * as React from "react"
import { Button, Flex, Text, Tooltip } from "@radix-ui/themes"
import { readAt, type SourceState } from "./console-source.ts"

const Tone = ({ tone, children }: { readonly tone: "live" | "stale" | "failed"; readonly children: React.ReactNode }) =>
  <Text size="1" color={tone === "live" ? "gray" : tone === "stale" ? "amber" : "red"}>{children}</Text>

export const Freshness = ({ state, onRetry }: { readonly state: SourceState<unknown>; readonly onRetry: () => void }) => {
  if (state.status === "loading") return <Tone tone="live">Reading…</Tone>
  if (state.status === "ready") return <Tone tone="live">{`live · read at ${readAt(state.at)}`}</Tone>
  // A failure with rows under it is stale, not failed: the rows are still the last
  // thing that was true, and the reason is reported without taking them away.
  return <Flex align="center" gap="2" wrap="wrap">
    <Tone tone={state.value === undefined ? "failed" : "stale"}>
      {`${state.value === undefined ? "failed" : `stale · last read at ${state.at === undefined ? "never" : readAt(state.at)}`} · ${state.error}`}
    </Tone>
    <Tooltip content="Read this source again now">
      <Button size="1" variant="soft" color="gray" onClick={onRetry}>Retry now</Button>
    </Tooltip>
  </Flex>
}
