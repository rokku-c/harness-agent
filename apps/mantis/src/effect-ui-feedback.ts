import { failureBadge, row, toneBadge, type UiNodeSpec } from "@effect-agent/effect-ui"

export const refusedBadge = (result: string): UiNodeSpec => failureBadge(`${result}/detail`)

export const failedBadge = (result: string): UiNodeSpec => failureBadge(`${result}/error`)

export const refusedWriteBadge = (result: string): UiNodeSpec => ({
  ...row([failureBadge(`${result}/detail`)]),
  visible: { source: { state: `${result}/ok` }, equals: false },
})

export const outcome = (result: string, accepted: string, label: string): readonly UiNodeSpec[] =>
  [{ ...toneBadge("ok", label), visible: { source: { state: accepted }, equals: true } },
    refusedBadge(result), failedBadge(result)]
