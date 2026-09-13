/**
 * One argument, as the control its type calls for.
 *
 * The layout is the config form's: a label, the control, and a description the
 * tool's schema wrote. The control is the library's own, unchecked — a string
 * is a `TextField`, a choice is a `Select`, a flag is a `Switch`, and anything
 * with a shape inside (an object, an array) is JSON the operator writes, which
 * we do not pretend to be a form.
 */

import * as React from "react"
import { Flex, Select, Switch, Text, TextArea, TextField } from "@radix-ui/themes"
import type { InspectorField as Field } from "./inspector-types.ts"

type Props = { readonly field: Field; readonly value: string; readonly onChange: (next: string) => void }

const Control = ({ field, value, onChange }: Props) => {
  if (field.type === "choice") {
    return <Select.Root value={value} onValueChange={onChange}>
      <Select.Trigger placeholder="Unset" />
      <Select.Content>{field.choices?.map((choice) => <Select.Item key={choice} value={choice}>{choice}</Select.Item>)}</Select.Content>
    </Select.Root>
  }
  if (field.type === "boolean") {
    return <Switch checked={value === "true"} onCheckedChange={(checked) => onChange(String(checked))} />
  }
  if (field.type === "json") {
    return <TextArea resize="vertical" rows={4} value={value} placeholder={field.fallback}
      onChange={(event) => onChange(event.target.value)} />
  }
  return <TextField.Root type={field.type === "number" ? "number" : "text"} value={value} placeholder={field.fallback}
    onChange={(event) => onChange(event.target.value)} />
}

export const InspectorField = ({ field, value, onChange }: Props) => (
  <Flex asChild direction="column" gap="2">
    <label>
      <Text size="2" weight="medium" color="gray">{field.name}{field.required ? " *" : ""}</Text>
      {field.description === undefined ? null : <Text size="1" color="gray">{field.description}</Text>}
      <Control field={field} value={value} onChange={onChange} />
    </label>
  </Flex>
)
