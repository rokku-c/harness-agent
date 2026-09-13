/-
  Reusing an upstream across server re-reads — `mcp-gateway/src/registry-upstream.ts`.

  One upstream is kept per server id and rebuilt only when the server's
  *signature* changed — the six fields the file lists. Everything rests on that
  list being the whole of what an upstream is wired from: `connect` hands the
  endpoint and headers to the HTTP transport, and the command, args and env to the
  stdio one, so a field read there and left out of the signature is a server that
  changed and is not rebuilt. The call still goes to the old endpoint, and nothing
  says so — `README.md`'s rule of thumb for what belongs here.

  **The signature covers what the upstream is wired from** —
  `an_unchanged_signature_is_the_same_wiring`, over
  `signatureOf_splits_into_the_fields_it_names`. That is what the reuse decision
  is worth, and `a_reuse_is_wired_like_a_fresh_build` is the decision read
  through it. Leave one field out and the reuse hands back an upstream wired for
  another server: `a_signature_that_drops_a_field_reuses_a_stale_upstream`,
  `a_signature_that_drops_the_endpoint_reuses_a_stale_upstream` — each with the
  file's own signature telling the two apart, which is the whole difference.

  **The table's own invariant** — every entry's key is the signature of the
  server that entry was wired from — `filing_keeps_the_invariant`, kept by both
  branches (`a_reuse_keeps_the_invariant`, `a_rebuild_keeps_the_invariant`) and
  by the 404 path (`dropping_keeps_the_invariant`).

  **Displacing an entry closes it** — `a_changed_signature_rebuilds_and_closes`;
  a reuse moves nothing — `an_unchanged_signature_reuses_what_is_filed`. Without
  the remove in front of the rebuild the table ends up identical and only the
  running client differs: `forgetting_the_remove_leaks_it`. Without the remove on
  the 404 path a server the resolver stopped answering for keeps its client:
  `an_unanswered_server_keeps_its_upstream_without_the_remove`.

  Idealisation: the signature is the tuple the file hands to `JSON.stringify`,
  read as a comparison of the tuple. Under `McpGatewayServer`'s own types that
  reading is sound — no field can be `null`, which is what `undefined` encodes
  to, so nothing collapses; a record's key order gives two equal objects two
  strings, and that slack runs the safe way, a needless rebuild and never a
  stale reuse. `name`, `era` and `serverId` are outside the signature, and the
  upstream reads none of the first two — the third it does index by, which
  `the_signature_does_not_see_the_id_the_upstream_indexes_by` states and which
  answers 404 rather than the wrong server, so it is a test there and not this.
  The upstream is modelled as the server it was wired from, since a call's answer
  depends on what `connect` was handed and on nothing else the row keeps.
-/

namespace McpGateway

/-- A server as the gateway hands it to an upstream: `McpGatewayServer`'s fields,
with the ones its own resolver fills in made explicit rather than optional. -/
structure UpstreamServer where
  serverId : String
  name : String
  era : String
  transport : String
  endpoint : String
  command : String
  args : List String
  env : List (String × String)
  headers : List (String × String)
deriving DecidableEq

/-- The six fields `registry-upstream.ts` signs, in the order it lists them. -/
structure Signature where
  transport : String
  endpoint : String
  command : String
  args : List String
  env : List (String × String)
  headers : List (String × String)
deriving DecidableEq, Repr

/-- What the file signs: `JSON.stringify` of these six. -/
def signatureOf (server : UpstreamServer) : Signature :=
  ⟨server.transport, server.endpoint, server.command, server.args, server.env, server.headers⟩

/-- What a built upstream talks to, which is the whole of what `connect` reads:
the endpoint and headers for an HTTP server, the command line and environment for
a stdio one. -/
def wiringOf (server : UpstreamServer) : List String :=
  if server.transport = "stdio" then
    server.command :: (server.args ++ server.env.map fun entry => entry.1 ++ "=" ++ entry.2)
  else
    server.endpoint :: server.headers.map fun header => header.1 ++ ":" ++ header.2

/-- The signature splits back into the six fields it names: there is none it
covers by accident and none it covers only in part. -/
theorem signatureOf_splits_into_the_fields_it_names (a b : UpstreamServer)
    (same : signatureOf a = signatureOf b) :
    a.transport = b.transport ∧ a.endpoint = b.endpoint ∧ a.command = b.command ∧
    a.args = b.args ∧ a.env = b.env ∧ a.headers = b.headers := by
  simpa only [signatureOf, Signature.mk.injEq] using same

/-- Two servers that sign alike are wired alike. This is the claim the whole file
rests on, and the only reason a matching signature is a reason to reuse. -/
theorem an_unchanged_signature_is_the_same_wiring (a b : UpstreamServer)
    (same : signatureOf a = signatureOf b) : wiringOf a = wiringOf b := by
  have parts := signatureOf_splits_into_the_fields_it_names a b same
  simp only [wiringOf]
  rw [parts.1, parts.2.1, parts.2.2.1, parts.2.2.2.1, parts.2.2.2.2.1, parts.2.2.2.2.2]

/-- One row of the table: the signature it was filed under, and the server the
upstream it holds was wired from. -/
structure Wired where
  key : Signature
  built : UpstreamServer
deriving DecidableEq

/-- The table: one row per server id, absent when that server holds none. -/
abbrev Table := String → Option Wired

/-- Filing one row, as `entries.set` does; `none` is what `entries.delete` leaves. -/
def put (table : Table) (serverId : String) (entry : Option Wired) : Table :=
  fun id => if id = serverId then entry else table id

/-- The table and the ids whose upstream was closed on the way — the file's
`remove` closes the row it deletes, and nothing else in it observes a close. -/
structure Wiring where
  table : Table
  closed : List String

/-- Every row's key is the signature of the server that row was wired from. Filed
any other way, a matching key would say nothing about what the row holds. -/
def Consistent (wiring : Wiring) : Prop :=
  ∀ serverId entry, wiring.table serverId = some entry → entry.key = signatureOf entry.built

/-- `current`: reuse the row whose key matches, otherwise rebuild — closing what
the rebuild displaces. -/
def current (wiring : Wiring) (serverId : String) (server : UpstreamServer) : Wiring × Wired :=
  match wiring.table serverId with
  | some old =>
    if old.key = signatureOf server then (wiring, old)
    else ({ table := put wiring.table serverId (some ⟨signatureOf server, server⟩),
            closed := serverId :: wiring.closed },
          ⟨signatureOf server, server⟩)
  | none =>
    ({ table := put wiring.table serverId (some ⟨signatureOf server, server⟩),
       closed := wiring.closed },
     ⟨signatureOf server, server⟩)

/-- Filing a fresh row keeps the invariant: the key filed with a row is its own
server's signature, by construction. Both branches of `current` go through here. -/
theorem filing_keeps_the_invariant (wiring : Wiring) (serverId : String) (server : UpstreamServer)
    (held : Consistent wiring) :
    Consistent { wiring with table := put wiring.table serverId (some ⟨signatureOf server, server⟩) } := by
  intro id entry filed
  by_cases same : id = serverId
  · simp only [put, if_pos same] at filed
    have h : (⟨signatureOf server, server⟩ : Wired) = entry := Option.some.inj filed
    rw [← h]
  · simp only [put, if_neg same] at filed
    exact held id entry filed

/-- A server whose signature did not change is handed the row already filed for
it, and the table is not moved. -/
theorem an_unchanged_signature_reuses_what_is_filed (wiring : Wiring) (serverId : String)
    (server : UpstreamServer) (entry : Wired) (filed : wiring.table serverId = some entry)
    (same : entry.key = signatureOf server) : current wiring serverId server = (wiring, entry) := by
  simp only [current, filed, if_pos same]

/-- A server whose signature changed is rebuilt, and what it displaced is closed:
the file's `remove` in front of the rebuild, read as what it leaves behind. -/
theorem a_changed_signature_rebuilds_and_closes (wiring : Wiring) (serverId : String)
    (server : UpstreamServer) (entry : Wired) (filed : wiring.table serverId = some entry)
    (changed : entry.key ≠ signatureOf server) :
    current wiring serverId server =
      ({ table := put wiring.table serverId (some ⟨signatureOf server, server⟩),
         closed := serverId :: wiring.closed },
       ⟨signatureOf server, server⟩) := by
  simp only [current, filed, if_neg changed]

/-- A reused row leaves the invariant as it found it. -/
theorem a_reuse_keeps_the_invariant (wiring : Wiring) (serverId : String) (server : UpstreamServer)
    (entry : Wired) (held : Consistent wiring) (filed : wiring.table serverId = some entry)
    (same : entry.key = signatureOf server) : Consistent (current wiring serverId server).1 := by
  rw [an_unchanged_signature_reuses_what_is_filed wiring serverId server entry filed same]
  exact held

/-- And so does a rebuilt one, since the row it files carries its own server's
signature. -/
theorem a_rebuild_keeps_the_invariant (wiring : Wiring) (serverId : String)
    (server : UpstreamServer) (entry : Wired) (held : Consistent wiring)
    (filed : wiring.table serverId = some entry) (changed : entry.key ≠ signatureOf server) :
    Consistent (current wiring serverId server).1 := by
  rw [a_changed_signature_rebuilds_and_closes wiring serverId server entry filed changed]
  exact filing_keeps_the_invariant wiring serverId server held

/-- The 404 path's `remove`: a server the resolver did not answer for is left
holding nothing. -/
def drop (wiring : Wiring) (serverId : String) : Wiring :=
  { wiring with table := put wiring.table serverId none }

/-- Dropping a row cannot invent one. -/
theorem dropping_keeps_the_invariant (wiring : Wiring) (serverId : String)
    (held : Consistent wiring) : Consistent (drop wiring serverId) := by
  intro id entry filed
  by_cases same : id = serverId
  · simp only [drop, put, if_pos same] at filed
    exact absurd filed (by simp)
  · simp only [drop, put, if_neg same] at filed
    exact held id entry filed

/-- The reuse decision read through the invariant: the upstream handed back is
wired exactly as a fresh build would be. This is the whole of what a matching
signature buys. -/
theorem a_reuse_is_wired_like_a_fresh_build (wiring : Wiring) (serverId : String)
    (server : UpstreamServer) (entry : Wired) (held : Consistent wiring)
    (filed : wiring.table serverId = some entry) (same : entry.key = signatureOf server) :
    wiringOf entry.built = wiringOf server :=
  an_unchanged_signature_is_the_same_wiring entry.built server
    ((held serverId entry filed).symm.trans same)

/-- Two servers whose commands differ and whose signatures do not — what the
signature is for. -/
def stdioA : UpstreamServer :=
  ⟨"gh", "github", "v1", "stdio", "stdio:", "npx", ["-y", "gh-mcp"], [], []⟩
def stdioB : UpstreamServer :=
  ⟨"gh", "github", "v1", "stdio", "stdio:", "node", ["-y", "gh-mcp"], [], []⟩

/-- And two whose endpoints differ. -/
def httpA : UpstreamServer :=
  ⟨"gh", "github", "v1", "streamable-http", "https://a/mcp", "", [], [], []⟩
def httpB : UpstreamServer :=
  ⟨"gh", "github", "v1", "streamable-http", "https://b/mcp", "", [], [], []⟩

/-- The six fields with `command` left out: the signature as it stands the moment
a field the stdio upstream runs is added to the server and not to it. -/
structure NoCommand where
  transport : String
  endpoint : String
  args : List String
  env : List (String × String)
  headers : List (String × String)
deriving DecidableEq

def withoutCommand (server : UpstreamServer) : NoCommand :=
  ⟨server.transport, server.endpoint, server.args, server.env, server.headers⟩

/-- And with `endpoint` left out, which is the same mistake on the other half. -/
structure NoEndpoint where
  transport : String
  command : String
  args : List String
  env : List (String × String)
  headers : List (String × String)
deriving DecidableEq

def withoutEndpoint (server : UpstreamServer) : NoEndpoint :=
  ⟨server.transport, server.command, server.args, server.env, server.headers⟩

/-- The control: one field short, the signature calls two commands one server —
so the reuse fires and the call runs what the first row was wired with. The
file's own signature tells the two apart, which is the whole difference. -/
theorem a_signature_that_drops_a_field_reuses_a_stale_upstream :
    withoutCommand stdioA = withoutCommand stdioB ∧
    wiringOf stdioA ≠ wiringOf stdioB ∧
    signatureOf stdioA ≠ signatureOf stdioB := by
  decide

/-- The same control on the HTTP half: an endpoint is what the transport dials,
and a signature that does not carry it cannot see it move. -/
theorem a_signature_that_drops_the_endpoint_reuses_a_stale_upstream :
    withoutEndpoint httpA = withoutEndpoint httpB ∧
    wiringOf httpA ≠ wiringOf httpB ∧
    signatureOf httpA ≠ signatureOf httpB := by
  decide

/-- `current` with the remove taken out: the rebuild files the new row without
noting that it displaced one. -/
def currentLeaking (wiring : Wiring) (serverId : String) (server : UpstreamServer) : Wiring × Wired :=
  match wiring.table serverId with
  | some old =>
    if old.key = signatureOf server then (wiring, old)
    else ({ table := put wiring.table serverId (some ⟨signatureOf server, server⟩),
            closed := wiring.closed },
          ⟨signatureOf server, server⟩)
  | none =>
    ({ table := put wiring.table serverId (some ⟨signatureOf server, server⟩),
       closed := wiring.closed },
     ⟨signatureOf server, server⟩)

/-- The control: a rebuild that does not close what it displaces leaves the table
exactly where the honest one leaves it, so nothing the file reads distinguishes
them — only the client still running does. -/
theorem forgetting_the_remove_leaks_it :
    (current { table := fun _ => some ⟨signatureOf stdioA, stdioA⟩, closed := [] } "gh" stdioB).1.table "gh"
      = (currentLeaking { table := fun _ => some ⟨signatureOf stdioA, stdioA⟩, closed := [] } "gh" stdioB).1.table "gh" ∧
    (current { table := fun _ => some ⟨signatureOf stdioA, stdioA⟩, closed := [] } "gh" stdioB).1.closed = ["gh"] ∧
    (currentLeaking { table := fun _ => some ⟨signatureOf stdioA, stdioA⟩, closed := [] } "gh" stdioB).1.closed = [] := by
  decide

/-- The 404 path with the remove taken out: the row outlives the answer. -/
def dropLeaking (wiring : Wiring) (_ : String) : Wiring := wiring

/-- The control: without it a server the resolver stopped answering for keeps its
row — and with it, a server that goes away stops holding a client. -/
theorem an_unanswered_server_keeps_its_upstream_without_the_remove :
    (drop { table := fun _ => some ⟨signatureOf stdioA, stdioA⟩, closed := [] } "gh").table "gh" = none ∧
    (dropLeaking { table := fun _ => some ⟨signatureOf stdioA, stdioA⟩, closed := [] } "gh").table "gh"
      = some ⟨signatureOf stdioA, stdioA⟩ := by
  decide

/-- And the gap that is not a defect: the signature does not see `serverId`, which
the upstream's own index does read. A resolver that moves it under a standing
signature is answered 404 "MCP server not found" for the id the row is filed
under — loud, so a test covers it and this does not. -/
theorem the_signature_does_not_see_the_id_the_upstream_indexes_by :
    signatureOf { stdioA with serverId := "other" } = signatureOf stdioA := by
  decide

end McpGateway
