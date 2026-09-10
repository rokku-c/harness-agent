import { z } from "zod"

export type RoleName = "Stack" | "Text" | "Button" | "Input" | "Switch" | "Select" | "Springboard" | "Dock" | "SettingsGroup" | "BottomTab" | "TopBar"
export type RadixBehavior = { primitiveId: string; description: string; events?: readonly string[] }
export type MinimalProjection = { role: RoleName; primitiveId: string; props: Record<string, unknown> }
export type RoleDefinition = {
  props: z.ZodObject<any>
  description: string
  radix: RadixBehavior
  minimalProjection: (props: unknown) => MinimalProjection
}

const projection = (role: RoleName, primitiveId: string, props: unknown): MinimalProjection => ({
  role, primitiveId, props: (props ?? {}) as Record<string, unknown>,
})

export const roleRegistry: Record<RoleName, RoleDefinition> = {
  Stack: {
    props: z.object({ direction: z.enum(["horizontal", "vertical"]).optional(), gap: z.number().optional(), role: z.string().optional() }),
    description: "Flex container that adapts to available width",
    radix: { primitiveId: "Primitive.div", description: "Layout container with stack semantics" },
    minimalProjection: props => projection("Stack", "Primitive.div", props),
  },
  Text: {
    props: z.object({ value: z.string().optional() }),
    description: "Static text",
    radix: { primitiveId: "Primitive.span", description: "Text content without interactive behavior" },
    minimalProjection: props => projection("Text", "Primitive.span", props),
  },
  Button: {
    props: z.object({ label: z.string().optional() }),
    description: "Button",
    radix: { primitiveId: "Button", description: "Keyboard-accessible pressable action", events: ["press"] },
    minimalProjection: props => projection("Button", "Button", props),
  },
  Input: {
    props: z.object({ label: z.string().optional(), value: z.string().optional(), placeholder: z.string().optional() }),
    description: "Text input",
    radix: { primitiveId: "Primitive.input", description: "Controlled text entry field", events: ["input"] },
    minimalProjection: props => projection("Input", "Primitive.input", props),
  },
  Switch: {
    props: z.object({ label: z.string().optional(), checked: z.boolean().optional(), description: z.string().optional() }),
    description: "Binary toggle switch",
    radix: { primitiveId: "Switch.Root", description: "Binary choice with switch keyboard behavior", events: ["change"] },
    minimalProjection: props => projection("Switch", "Switch.Root", props),
  },
  Select: {
    props: z.object({ label: z.string().optional(), value: z.string().optional(), placeholder: z.string().optional(), options: z.array(z.object({ value: z.string(), label: z.string().optional() })).optional() }),
    description: "Dropdown select from options",
    radix: { primitiveId: "Select.Root", description: "Single-value selection with listbox behavior", events: ["change"] },
    minimalProjection: props => projection("Select", "Select.Root", props),
  },
  Springboard: {
    props: z.object({ title: z.string().optional(), apps: z.array(z.object({ id: z.string(), title: z.string(), surface: z.enum(["home", "settings", "view", "config"]).optional(), persistent: z.boolean().optional() })).optional(), widgets: z.array(z.object({ id: z.string(), label: z.string(), value: z.string() })).optional() }),
    description: "Responsive home application grid",
    radix: { primitiveId: "Primitive.main", description: "Application launcher surface" },
    minimalProjection: props => projection("Springboard", "Primitive.main", props),
  },
  Dock: {
    props: z.object({ collapsed: z.boolean().optional(), items: z.array(z.object({ id: z.string(), title: z.string(), surface: z.enum(["home", "settings", "view", "config"]).optional(), persistent: z.boolean().optional() })).optional() }),
    description: "Collapsible application navigation dock",
    radix: { primitiveId: "NavigationMenu.Root", description: "Keyboard-navigable application navigation" },
    minimalProjection: props => projection("Dock", "NavigationMenu.Root", props),
  },
  SettingsGroup: {
    props: z.object({ title: z.string().optional(), items: z.array(z.object({ id: z.string(), title: z.string(), surface: z.enum(["home", "settings", "view", "config"]).optional(), persistent: z.boolean().optional() })).optional() }),
    description: "Grouped settings navigation",
    radix: { primitiveId: "Accordion.Root", description: "Accessible grouped settings disclosure" },
    minimalProjection: props => projection("SettingsGroup", "Accordion.Root", props),
  },
  BottomTab: {
    props: z.object({ selected: z.string().optional(), items: z.array(z.object({ id: z.string(), title: z.string(), surface: z.enum(["home", "settings", "view", "config"]).optional(), persistent: z.boolean().optional() })).optional() }),
    description: "Compact mobile bottom navigation",
    radix: { primitiveId: "Tabs.Root", description: "Accessible tab navigation for narrow screens" },
    minimalProjection: props => projection("BottomTab", "Tabs.Root", props),
  },
  TopBar: {
    props: z.object({ title: z.string().optional() }),
    description: "Minimal application toolbar",
    radix: { primitiveId: "Primitive.header", description: "Semantic toolbar container" },
    minimalProjection: props => projection("TopBar", "Primitive.header", props),
  },
}

export const getRole = (role: string): RoleDefinition => {
  const definition = roleRegistry[role as RoleName]
  if (!definition) throw new Error(`Unknown UI role: ${role}`)
  return definition
}

export const getRolePropsSchema = (role: string) => getRole(role).props
export const getRoleRadixMapping = (role: string) => getRole(role).radix
export const getRoleEvents = (role: string) => getRole(role).radix.events ?? []
export const getMinimalProjection = (role: string, props: unknown = {}) => getRole(role).minimalProjection(props)
