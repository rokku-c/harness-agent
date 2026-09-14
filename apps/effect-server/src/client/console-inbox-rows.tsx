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
