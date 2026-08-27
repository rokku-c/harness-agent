# WebUI demo

```sh
bun run webui
```

Open `http://localhost:4173`. Override the port when needed:

```sh
PORT=8080 bun run webui
```

The browser bundle uses `@effect-agent/core`, `@effect-agent/builtin`,
`@effect-agent/repr`, and `@effect-agent/webui`; it does not import Node adapters.
