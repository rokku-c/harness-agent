import * as React from "react"
import { defineCatalog } from "@json-render/core"
import { schema } from "@json-render/react/schema"
import { defineRegistry, type ComponentRegistry } from "@json-render/react"
import { formComponents } from "@effect-agent/effect-ui"
import { Button, Input, Select, Stack, Switch, Text } from "./effect-ui-catalog-components.tsx"
import { BottomTab, Dock, SettingsGroup, Springboard, TopBar } from "./effect-ui-catalog-composites.tsx"

const catalog = defineCatalog(schema, { components: formComponents, actions: {} })
const defaultComponents = { Stack, Text, Button, Input, Switch, Select, Springboard, Dock, SettingsGroup, BottomTab, TopBar }

export const makeEffectUiRegistry = (components: Partial<ComponentRegistry> = {}): ComponentRegistry => defineRegistry(catalog, {
  components: { ...defaultComponents, ...components } as never,
}).registry
