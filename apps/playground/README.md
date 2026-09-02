# app-playground

L5 application example: assembles the layers (model/channel/tools/state/memory/gate/schedule)
into a runnable agent via `@effect-agent/assembly`'s `defaultLayers()`.

```
bun apps/playground/src/main.ts
```

Flow: registry registers tools (API-as-data) → bridged into core Bindings →
Agent.define(...).uses(...).implementedBy(driver) → run →
write memory → deliver via Delivery → observe (tool table / recalls / delivery history).
