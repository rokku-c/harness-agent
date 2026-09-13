/**
 * The config form's components.
 *
 * They carry the design system's names because a config field *is* a text field
 * or a select — it just also knows which schema kind it holds and which row of
 * an array it belongs to, so the form can read every value back out. Only the
 * config mount uses this registry; a view keeps the library's components.
 *
 * The two controls that are not the library's are deliberate: the config reader
 * reads the DOM, and `@radix-ui/themes` renders both a select and a checkbox as
 * buttons, which is not part of a form the reader submits.
 */

import * as React from "react"
import { Button, Flex, Text, TextField } from "@radix-ui/themes"
import type { ComponentRegistry, ComponentRenderProps } from "@json-render/react"

type Props = Record<string, unknown>
const propsOf = (ctx: ComponentRenderProps): Props => (ctx.element.props ?? {}) as Props
const marker = (key: string, value: unknown): Record<string, string> => value === undefined ? {} : { [key]: String(value) }

const optionOf = (option: unknown): { readonly value: string; readonly label: string } =>
  typeof option === "object" && option !== null
    ? { value: String((option as Props).value), label: String((option as Props).label ?? (option as Props).value) }
    : { value: String(option), label: String(option) }

const ConfigField = ({ ctx }: { ctx: ComponentRenderProps }) => {
  const props = propsOf(ctx), options = Array.isArray(props.options) ? props.options.map(optionOf) : []
  const value = props.value === undefined || props.value === null ? "" : String(props.value)
  const marks = { ...marker("data-ui", "input"), ...marker("data-path", props.fieldPath), ...marker("data-kind", props.fieldKind), ...marker("data-node", props.nodeId) }
  const control = props.inputType === "checkbox"
    ? <input type="checkbox" defaultChecked={props.checked === true} disabled={props.readOnly === true} />
    : props.inputType === "select"
      ? <select defaultValue={value} disabled={props.readOnly === true}>
          <option value="">{props.required === true ? "Select an option" : "Unset"}</option>
          {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      : <TextField.Root type={props.inputType === "number" ? "number" : "text"} defaultValue={value} readOnly={props.readOnly === true} />
  return <Flex asChild direction="column" gap="2">
    <label {...marks}>
      <Text size="2" weight="medium" color="gray">{String(props.label ?? "")}{props.required === true ? " *" : ""}</Text>
      {control}
    </label>
  </Flex>
}

/** Layout and copy pass through, minus the markers the form uses to read back. */
const ConfigFlex = ({ ctx }: { ctx: ComponentRenderProps }) => {
  const { direction, gap, align, justify, role, ...rest } = propsOf(ctx)
  return <Flex direction={direction as never ?? "column"} gap={gap as never ?? "3"} align={align as never} justify={justify as never} {...marker("data-ui-role", role)}>{ctx.children}</Flex>
}

const ConfigText = ({ ctx }: { ctx: ComponentRenderProps }) => <Text size="4" weight="bold">{propsOf(ctx).value as React.ReactNode}</Text>

const ConfigButton = ({ ctx }: { ctx: ComponentRenderProps }) => {
  const props = propsOf(ctx), restart = props.strategy === "restart"
  return <Button type="button" variant={restart ? "soft" : "solid"} color={restart ? "gray" : undefined}
    {...marker("data-strategy", props.strategy)} {...marker("data-array-action", props.arrayAction)}
    {...marker("data-array-node", props.arrayNode)} {...marker("data-array-index", props.arrayIndex)}>
    {props.value as React.ReactNode}
  </Button>
}

export const configComponents: ComponentRegistry = { Flex: ConfigFlex, Text: ConfigText, TextField: ConfigField, Button: ConfigButton }
