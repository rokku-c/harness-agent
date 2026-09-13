# Current config and multiple upstreams (2026-09-08)

## Authoritative config

The default database is `.effect-agent/config.sqlite`, table `app_config` stores the full value, sources and revision.
The first creation of the config is validated as `schema defaults < effect.yaml config < explicit override` and then written to the database.
After that SQLite is authoritative; updating YAML does not overwrite saved values.

**No old-format support, no automatic migration, no automatic database drop.** When an old database structure or an old config field does not match the current contract it errors explicitly.
The operator decides whether to back up, rebuild or refill; tests never touch the real config database.

## Multiple named upstreams

```yaml
config:
  providers:
    - id: chat-a
      apiType: openai.chat
      baseURL: https://upstream-a.example.invalid/v1
      apiKey: YOUR_KEY_A
    - id: chat-b
      apiType: openai.chat
      baseURL: https://upstream-b.example.invalid/v1
      apiKey: YOUR_KEY_B
    - id: messages
      apiType: anthropic.message
      baseURL: https://messages.example.invalid
      apiKey: YOUR_KEY_C
```

- Unbounded count; id is unique; apiType may repeat, denoting a protocol rather than a vendor or a single-select upstream.
- `enabled:false` disables the entry. By default it filters by protocol and then round-robins; `x-upstream-id` selects explicitly.
- An explicit target that does not exist, is disabled, or has a mismatched protocol fails; it does not silently switch to another upstream.
- With no provider configured it returns 503, an unknown path returns 404, and there is no environment-variable or built-in URL fallback.
- Only after the upstream is chosen is the egress (local/main node) chosen through the SDK; see `platform-network.md`.
- Three protocol paths: `/v1/chat/completions`, `/v1/responses`, `/v1/messages`.
- Upstream auth is determined by apiType; the client request's credentials are not used to fill in config, and internal selection headers are not forwarded.
- baseURL may contain a prefix or a trailing /v1; streaming requests/responses are preserved; a failure is not replayed automatically.

## UI and taking effect

`/console` → CONFIGURATION → ai-gateway. providers is an array form that can be added to and removed from,
each entry fills in id, apiType, baseURL, key and enabled; several upstreams of the same protocol can be added at the same time.
The listening port is not part of ai-gateway config, it belongs to `platform-network`'s listeners; a standalone entry manages its own port.

- Save and apply: validate → SQLite → active config → reload.
- Save pending restart: writes SQLite only, the runtime keeps using the old active config.
- Apply saved config: an explicit switch; a restart also activates the saved value.
- Clearing an optional field uses unset; a field with a schema default is restored to its default rather than re-inheriting YAML.

HTTP:

- `GET /console/api/config/:id`: schema/value/sources/revision/pendingRestart.
- `POST /console/api/config/:id`: `{override,strategy:"apply"|"restart",unset?:string[]}`.
- `POST /console/api/config/:id/apply`: applies the saved value.

An array is replaced as a whole, ordinary fields are patched at the top level; an invalid save does not change the original config.
The config contains credentials, so the database and its backups should be protected as sensitive files. The agent config plane is not readable by default;
the operator config entry point is a trusted local management surface, not a management service with implemented remote authentication.
