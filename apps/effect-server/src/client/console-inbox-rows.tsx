/**
 * The queue's two row kinds: a decision, and an action item.
 *
 * They are rows in the same list and they are not the same row, which is the
 * whole of §1.5: a decision needs a verdict and is addressable at `#inbox/<id>`,
 * so its row is a press that opens it and its current state is a press away from
 * being answered. An action item needs one recovery action and is not addressable
 * at all, so its row is not pressable and says what the action is — a row that
 * could not be opened would be a control that does nothing.
 */

import { Button, Flex, Text } from "@radix-ui/themes"
import type { ActionItem } from "./console-decision.ts"

export const ItemRow = ({ label, detail, active, open }: {
  readonly label: string
  readonly detail: string
  readonly active: boolean
  readonly open: () => void
}) =>
  <Button size="2" variant={active ? "soft" : "ghost"} color={active ? "jade" : "gray"}
    style={{ justifyContent: "flex-start", height: "auto", paddingBlock: "var(--space-2)" }} onClick={open}>
    <Flex direction="column" align="start" gap="1">
      <Text size="2" weight="medium">{label}</Text>
      <Text size="1" color="gray">{detail}</Text>
    </Flex>
  </Button>

export const ActionRow = ({ item }: { readonly item: ActionItem }) =>
  <Flex direction="column" gap="1">
    <Text size="2" weight="medium">{item.title}</Text>
    {item.detail === undefined ? null : <Text size="1" color="gray">{item.detail}</Text>}
    <Text size="1" color="gray">{item.app === undefined ? item.action : `${item.app} · ${item.action}`}</Text>
  </Flex>
