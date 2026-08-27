# TUI demo

```sh
bun run tui
```

Keys:

- `j` / `k`: select a connection
- `i`: invoke its first capability with an empty object
- `r`: refresh
- `x`: close the selected connection session
- `c`: clear the event ledger
- `q`: quit

The Node host imports `@effect-agent/tui/node`; the renderer itself remains available
from the platform-neutral `@effect-agent/tui` entry point.
