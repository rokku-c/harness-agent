# Capability Script Sandbox (@effect-agent/script) — a self-bootstrapping TS/JS tool component

> Idea: the API available inside the sandbox = the set of toolcalls exported to the agent;
> an agent writes scripts that compose existing toolcalls into **higher-level toolcalls**,
> and the new toolcall joins the API set. This raises four questions that must be answered:
> **visibility** (dependency closure), **compatibility** (graded adjudication), **versioning**
> (git-class), and **configuration** (system/agent isomorphic + derived narrowing).
> Design claim: these four questions are not four mechanisms but **four instances of one
> mechanism**.

---

## 0. Core claim: one recursive mechanism

The whole design revolves around one pattern, applied recursively at every layer:

    scope (range) + closure (closure/pruning) + policy (strategy)

| Layer | what scope is | what closure does | what policy adjudicates |
|---|---|---|---|
| Tool layer | api allowlist/denylist | deps dependency-closure propagation | tool visibility |
| Version layer | set of version refs | content-addressed hash chain | strong/weak deps, upgrade path |
| Config layer | allowAgentConfig paths | merge/restrict pruning | whether the agent may override, how wide |
| Agent layer | api + permission scope at derivation | parent-policy pruning | the child agent's capability surface |

The **same restrict(scope) mechanism** runs through all four layers: the visible tool set,
the version resolution surface, the config merge rule, and the agent derivation scope.
That is the homoiconic/recursive/derivational elegance the design asks for — not four
subsystems but one recursive function instantiated over different data.

---

## 1. Core concept: ToolDef (one unified tool model)

Every tool — native, scripted, composed — is the same data shape (**homoiconic: code is data**):

    interface ToolDef {
      name: string
      description: string
      input: JSONSchema
      output: JSONSchema
      /** deps: anchor of visibility closure + runtime injection surface (object-capability) */
      deps: string[]
      /** implementation: native direct / script sandbox / composed */
      impl: Impl
      /** compatibility declaration (optional; supplements diff adjudication) */
      compat?: Partial<CompatPolicy>
    }

    type Impl =
      | { kind: "native";  execute: (ctx, input) => Promise<unknown> }
      | { kind: "script"; lang: "ts" | "js"; source: string }
      | { kind: "composed"; steps: ComposedStep[] }

- **deps is the soul field**: it anchors the closure visibility and is the least-privilege
  injection surface at runtime (a script only gets the deps it declares, never the whole API —
  object capability).
- **Script tools self-bootstrap**: inside a script, defineTool({...}) (or the return.define
  convention, see §2) defines a new tool → host registers it into the registry → other
  scripts/agents can depend on it immediately → **the API set grows**. That is the tool-level
  recursion.

---

## 2. Sandbox execution model (ScriptRuntime)

    interface ScriptRuntime {
      readonly execute: (source, env: Record<string, ToolApi>, host, timeoutMs?) => Promise<unknown>
      readonly runtime: "quickjs" | "graaljs" | "node-vm" | "isolated-vm"
    }

- **Default implementation IsolatedVmRuntime** (isolated-vm — a real, separate V8 isolate):
  - independent heap + memoryLimit: a script cannot OOM the host or share host objects;
  - cross-isolate injection goes through Callback/Reference only — no host objects inside the
    context, so the **constructor-chain escape surface disappears** (the same malicious script
    escapes node:vm and reaches the host process; see the A/B check in
    scripts/isolated-vm-smoke.ts);
  - restricted injection: the host console is not exposed; only an explicit log is given.
- **NodeVmRuntime** (node:vm) stays as the zero-dependency fallback skeleton — **vm is not a
  real sandbox**: after injecting host objects the constructor chain can escape; it is only
  for mechanism demos and environments without native dependencies.
- **Runtime differences**: isolated-vm is a native module (compiled against node's V8 ABI),
  so **bun cannot load it** (lazy load throws an explicit error); bun environments fall back
  to NodeVmRuntime automatically, node environments get real isolation. The demo probes
  automatically. Real-isolation check: node --experimental-strip-types
  scripts/isolated-vm-smoke.ts.
- **Implementation notes (isolated-vm 7.x)**: Callback arguments are copied with
  ExternalCopy (functions cannot cross), so async dep calls go through a __call sync bridge +
  __pending id channel, with the host calling back through a callable proxy obtained via
  getSync; isolate→host object results cannot be transferred directly (eval's result.copy /
  result.reference work only for primitives), so results cross via a JSON serialization
  channel. defineTool / dep apis are injected as Callbacks (they become plain functions once
  transferred into the isolate).
- The world a script sees = the injected env = the deps it declares (pruning happens before
  injection).
- Two conventions for defining tools (homoiconic, pick either):
  - **return is data** (recommended): the script ends with return { ... }; an object that
    carries a define field declares a new tool — the host extracts it from the return value
    and registers it; the remaining fields are the script result. The return value is the API.
  - the defineTool global: the script calls defineTool({...}) to register (env-global form).
  - Either way the host validates the ToolDef (schema sanity, deps all present in env,
    no name clash) before registering.
- **Recursion boundary**: the ToolDef a script defines may depend on "another script tool just
  defined"; closure visibility is recomputed at registration — a new tool is either wholly
  visible or wholly invisible.

---

## 3. Visibility = dependency closure

**Rule**: v ∈ V ⟹ v.deps ⊆ V. A visible set must be closed under deps; a tool that violates
closure (depends on an invisible tool) is **itself invisible** — this is the formal version of
"if a toolcall/api depends on another tool that is not visible to the agent, this one is not
visible either".

    function visibleTools(registry, policy): string[] {
      const seed = policy.api.mode === "allowlist" ? policy.api.scope : allExcept(registry, policy.api.scope)
      const visible = new Set<string>()
      const queue = [...seed]
      while (queue.length) {
        const name = queue.pop()!
        if (visible.has(name)) continue
        const tool = registry.get(name)
        if (tool === undefined) continue
        visible.add(name)
        for (const dep of tool.deps) queue.push(dep)   // closure propagation
      }
      return [...visible]
    }

- **allowlist** (default, safe): whitelist seeds + expand the closure along deps.
- **denylist**: full set - exclusions, then iteratively delete tools that break the closure
  (excluding a dep → every tool that depends on it is chained-removed).
- Both modes converge on the same invariant: **the result set is closed under deps**.
- Visibility applies in three places: ① the agent's tool surface (bridged into core
  Bindings); ② the script's env injection surface; ③ the version resolution surface
  (a version ref of an invisible tool simply fails to resolve).

---

## 4. Versioning = content addressing (git-class)

### 4.1 Version object and Merkle hash

    interface Version {
      tool: string
      revision: number               // monotonically increasing
      hash: string                   // SHA-256(canonical content + deps' hash list)
      parent?: string                // version DAG (git-class)
      message: string                // commit message
      content: ToolDef               // immutable snapshot
      createdAt: number
      hidden?: boolean               // version visibility: experimental versions can hide from agents
    }

    hash = sha256(canonical({ content, deps: deps.map(d => resolveHash(d)) }))

**Key property**: the hash includes the deps' hashes ⟹ **tool@hash locks the versions of the
whole dependency closure**. A strong dep declaring one hash equals declaring "this tool + the
exact version set of every tool it depends on" — stronger than an npm lockfile (a lockfile is
an external file; here it is content addressing built into the version object).

### 4.2 Version refs and resolution

    type Ref =
      | { kind: "latest" }
      | { kind: "revision"; n: number }
      | { kind: "hash"; hash: string }        // exact (strong dep)
      | { kind: "range"; spec: string }       // ^1.2 / >=1 — compatibility match (weak dep)

- **Strong deps**: a dep declares a hash → before running, the actual injected hash is checked
  against the declared hash, **fail loud on mismatch** (no silent upgrade).
- **Weak deps**: a dep declares a range → inferred by compatibility adjudication along the
  version path (see §5) — "if no strong dependency is declared, follow what was before": look
  at the full history of diffs from the currently-used version to the target and check them
  against the policy.

### 4.3 Default versions and version visibility

- Each agent's policy can set version.defaults: { tool: "latest" | "rev:3" | "hash:..." }.
- Version visibility: version.visibility: { tool: "public" | "hidden" | "restricted" } — the
  config layer decides which versions are visible to which agents; invisible versions fail to
  resolve (the same restrict mechanism as tool visibility).

---

## 5. Compatibility = graded adjudication

### 5.1 Four levels of breakage (descending severity)

| Level | change | how it is detected | default policy |
|---|---|---|---|
| schema | input/output schema changed | structural diff | strict (breaks callers/scripts) |
| deps | dependency set changed | set diff | strict (breaks closure visibility) |
| description | description changed | string diff | warn (affects model cognition, not execution) |
| behavior | behavior changed | cannot be auto-detected, must be declared | require-declaration |

### 5.2 Adjudication and configuration

    interface CompatPolicy {
      schema: "strict" | "warn" | "ignore"
      deps: "strict" | "warn" | "ignore"
      description: "strict" | "warn" | "ignore"
      behavior: "require-declaration" | "ignore"
    }

    function assessUpgrade(store, from: Ref, to: Ref, policy): UpgradeReport
    // diff version-by-version along the path: strict violation → reject;
    // warn violation → record and continue; ignore → skip

- **Configurable ignoring**: schema and description are the two levels the original idea
  named; this design completes them into four (deps is strict by default for safety but is
  still configurable).
- **Strong deps skip inference**: deps that declare a hash go through runtime checks, not
  compatibility inference.
- **Upgrade direction**: old→new (apply the new version) and new→old (rollback) use the same
  adjudication function.

---

## 6. Configuration = one Policy type (the homoiconic core)

### 6.1 Policy shape

    interface Policy {
      api:      { mode: "allowlist" | "denylist"; scope: string[] }
      version:  { defaults: Record<string, Ref>; visibility: Record<string, VersionVisibility> }
      compat:   CompatPolicy
      sandbox:  { runtime: "isolated-vm" | "node-vm" | ...; timeoutMs: number; memoryMb: number }
      /** fine-grained whitelist: config paths an agent may override (dot paths) */
      allowAgentConfig: string[]
    }

### 6.2 System config and agent config: one type, two sources

- **Homoiconic**: the system policy and the agent-declared overrides are the same Policy type.
- **Merge**: mergePolicy(system, agentOverride) — an agent may only override paths listed in
  allowAgentConfig ("compat.schema", "version.defaults.foo"…); paths not listed are rejected
  (or ignored, per config). **The system switch is granular down to each item.**
- **Derivation**: when the root agent derives a child agent, restrictPolicy(parent, childScope):
  - api.scope ← intersection (the child cannot gain apis the parent lacks)
  - allowAgentConfig ← intersection (the child cannot configure items the parent forbids)
  - version.visibility and compat ← inherited (unless the parent lets the child override)
- **Recursion**: a child deriving its own child — the same function, scope narrowing layer by
  layer. The configuration method is uniform: derivation = restrict, override = merge, and the
  two are isomorphic at every layer.

### 6.3 Meta-tools: the tool that controls capabilities is itself a tool

restrictPolicy, visibleTools, resolve and assessUpgrade can all be exposed as toolcalls
(registered as native tools). An agent can therefore compose "tools that control its own
capability surface" with scripts — e.g. a high-level tool that derives a restricted child
agent is itself a script tool composed from restrict + spawn. **The highest form of
homoiconicity: the mechanism that manages mechanisms can itself be managed.**

---

## 7. Relationship to the existing packages

| Position | Reuse |
|---|---|
| sandbox executor | isolated-vm (default) / node:vm (fallback skeleton); agenthost QuickJS/GraalJS Layer is a swappable alternative (M1) |
| ToolDef | @effect-agent/tools's ToolDescriptor (ToolDef is its superset: +deps/version/compat/impl) |
| tool-surface bridging | visible tool set → core Bindings (reuses tools' toCoreOp) |
| schema | core Op's Schema (compat diff uses structured JSON Schema comparison) |
| version storage | can sit on @effect-agent/state's Store (swappable) |
| configuration | isomorphic to @effect-agent/assembly's profile (both are data-driven assembly) |

Package placement: @effect-agent/script (capability sandbox — a cross-cutting capability
layer between the L1 base and the L3 core), depends on tools/state; assembly wires the
sandbox runtime into its default composition.

---

## 8. Why this stays simple

1. **One recursive type** (ToolDef data) + **one derivation function** (restrict) + **one
   merge function** (merge) + **one adjudication function** (compat) — four concepts cover
   the whole requirement.
2. **Visibility/compatibility/versioning/config are not four subsystems**: visibility is a
   closure over a scope; compatibility is diff adjudication along a version path; versioning
   is Merkle addressing of content; config is hierarchical merging of one policy. All are the
   "scope + policy" pattern.
3. **Open-box by default**: allowlist mode + latest versions + strict schema/description +
   isolated-vm (node) / node-vm (bun fallback) — zero config runs; loosen item by item when
   flexibility is needed.
4. **The trust boundary is clear**: node:vm is a fallback skeleton (not a real sandbox; the
   constructor chain escapes — demonstrated); production must use isolated-vm or
   QuickJS/GraalJS — sandbox isolation is a runtime-implementation problem (swappable Layer),
   not a conceptual one.
5. **fail loud**: strong-dep hash mismatch, invisible dependencies, schema violations — all
   error at registration/run time, never degrade silently (M3 throughout).
