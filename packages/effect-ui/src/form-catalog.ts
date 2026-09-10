import { roleRegistry } from "./role-registry.ts"

/** Form catalog projection backed by the shared UI role registry. */
export const formComponents = Object.fromEntries(
  Object.entries(roleRegistry).map(([role, definition]) => [role, {
    props: definition.props,
    description: definition.description,
    ...(definition.radix.events ? { events: [...definition.radix.events] } : {}),
  }]),
)
