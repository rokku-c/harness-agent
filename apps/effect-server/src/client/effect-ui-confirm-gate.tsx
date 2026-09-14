import { AlertDialog, Button, Flex } from "@radix-ui/themes"
import { answerConfirm, useConfirm } from "./effect-ui-confirm.ts"

export const ConfirmGate = () => {
  const question = useConfirm()
  return <AlertDialog.Root open={question !== null}>
    <AlertDialog.Content maxWidth="480px" aria-describedby={undefined}>
      <AlertDialog.Title>{question?.say}</AlertDialog.Title>
      <Flex gap="3" mt="4" justify="end">
        <Button variant="soft" color="gray" onClick={() => answerConfirm(false)}>Cancel</Button>
        <Button color="red" onClick={() => answerConfirm(true)}>{question?.press}</Button>
      </Flex>
    </AlertDialog.Content>
  </AlertDialog.Root>
}
