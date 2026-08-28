# Wiring a runtime: SDK adapter or wire protocol? (P7)

Audience: builders connecting an agent runtime to effect-agent. There are two
integration surfaces - a **direct SDK adapter** (wrap the vendor's in-process
SDK, like the dsh adapter) and a **wire-protocol adapter** (speak a protocol
to an out-of-process runtime; the ACP direction is the open second-wire
decision). Four rules decide which one fits. The rules compose: a runtime can
start behind an SDK adapter and gain a wire later; both surfaces end in the
same connection layer.

## Rule 1 - The runtime has an official in-process SDK: use a SDK adapter

If the vendor ships a supported SDK for your host language, wrap it. The SDK
already solves authentication, retries, streaming, and lifecycle - a wire
would re-implement the vendor's client. The dsh adapter is the reference:
lazy SDK loader, a minimal config surface, and notifications passed through.

## Rule 2 - The runtime is cross-language or must stay out-of-process: use a wire protocol

When there is no in-process SDK (or the runtime must be isolated from the
host), a wire protocol (stdio/HTTP JSON-RPC) decouples the runtime's language
and lifecycle from yours. An SDK binding ties the integration to the vendor's
host language; a wire treats the runtime as a process with a protocol. This is
the ACP direction - naming and failover semantics are open decisions
(docs/dsh-connection.md §7), not a settled mechanism yet.

## Rule 3 - You need failover or runtime redundancy: compose at the connection layer

Failover is a connection-layer mechanism (the kernel compiles an agent as a
connection graph over adapters and fails over between them; first-open is
single-flight). A single SDK binding has no failover semantics - do not
hard-code fallbacks inside a driver or adapter; register a second adapter at
the connection layer and let the graph fail over.

## Rule 4 - The runtime is a black box you only observe: keep the capability surface minimal

For a runtime you cannot look into, expose ONE invoke capability plus the
event stream (the dsh pattern: a single `dsh.agent.run` capability and
notifications passed through 1:1, verbatim). Do not design a wide capability
surface for a black box: the stream carries what the runtime did, and
consumers filter it (step graphs and trace views are consumer-side, not
architecture - see the dsh event classification reference in
docs/dsh-connection.md §6).

## Pointers

- SDK adapter reference: `packages/builtin/src/adapters/dsh-sdk.ts`
  (+ docs/dsh-connection.md for the config surface and event namespace).
- Connection layer / failover: the kernel adapters (`packages/core`) and
  docs/events.md.
- Driver side (in-process agent runs): docs/driver.md.
