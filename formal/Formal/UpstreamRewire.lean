namespace McpGateway

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

structure Signature where
  transport : String
  endpoint : String
  command : String
  args : List String
  env : List (String × String)
  headers : List (String × String)
deriving DecidableEq, Repr

def signatureOf (server : UpstreamServer) : Signature :=
  ⟨server.transport, server.endpoint, server.command, server.args, server.env, server.headers⟩

def wiringOf (server : UpstreamServer) : List String :=
  if server.transport = "stdio" then
    server.command :: (server.args ++ server.env.map fun entry => entry.1 ++ "=" ++ entry.2)
  else
    server.endpoint :: server.headers.map fun header => header.1 ++ ":" ++ header.2

theorem signatureOf_splits_into_the_fields_it_names (a b : UpstreamServer)
    (same : signatureOf a = signatureOf b) :
    a.transport = b.transport ∧ a.endpoint = b.endpoint ∧ a.command = b.command ∧
    a.args = b.args ∧ a.env = b.env ∧ a.headers = b.headers := by
  simpa only [signatureOf, Signature.mk.injEq] using same

theorem an_unchanged_signature_is_the_same_wiring (a b : UpstreamServer)
    (same : signatureOf a = signatureOf b) : wiringOf a = wiringOf b := by
  have parts := signatureOf_splits_into_the_fields_it_names a b same
  simp only [wiringOf]
  rw [parts.1, parts.2.1, parts.2.2.1, parts.2.2.2.1, parts.2.2.2.2.1, parts.2.2.2.2.2]

structure Wired where
  key : Signature
  built : UpstreamServer
deriving DecidableEq

abbrev Table := String → Option Wired

def put (table : Table) (serverId : String) (entry : Option Wired) : Table :=
  fun id => if id = serverId then entry else table id

structure Wiring where
  table : Table
  closed : List String

def Consistent (wiring : Wiring) : Prop :=
  ∀ serverId entry, wiring.table serverId = some entry → entry.key = signatureOf entry.built

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

theorem an_unchanged_signature_reuses_what_is_filed (wiring : Wiring) (serverId : String)
    (server : UpstreamServer) (entry : Wired) (filed : wiring.table serverId = some entry)
    (same : entry.key = signatureOf server) : current wiring serverId server = (wiring, entry) := by
  simp only [current, filed, if_pos same]

theorem a_changed_signature_rebuilds_and_closes (wiring : Wiring) (serverId : String)
    (server : UpstreamServer) (entry : Wired) (filed : wiring.table serverId = some entry)
    (changed : entry.key ≠ signatureOf server) :
    current wiring serverId server =
      ({ table := put wiring.table serverId (some ⟨signatureOf server, server⟩),
         closed := serverId :: wiring.closed },
       ⟨signatureOf server, server⟩) := by
  simp only [current, filed, if_neg changed]

theorem a_reuse_keeps_the_invariant (wiring : Wiring) (serverId : String) (server : UpstreamServer)
    (entry : Wired) (held : Consistent wiring) (filed : wiring.table serverId = some entry)
    (same : entry.key = signatureOf server) : Consistent (current wiring serverId server).1 := by
  rw [an_unchanged_signature_reuses_what_is_filed wiring serverId server entry filed same]
  exact held

theorem a_rebuild_keeps_the_invariant (wiring : Wiring) (serverId : String)
    (server : UpstreamServer) (entry : Wired) (held : Consistent wiring)
    (filed : wiring.table serverId = some entry) (changed : entry.key ≠ signatureOf server) :
    Consistent (current wiring serverId server).1 := by
  rw [a_changed_signature_rebuilds_and_closes wiring serverId server entry filed changed]
  exact filing_keeps_the_invariant wiring serverId server held

def drop (wiring : Wiring) (serverId : String) : Wiring :=
  { wiring with table := put wiring.table serverId none }

theorem dropping_keeps_the_invariant (wiring : Wiring) (serverId : String)
    (held : Consistent wiring) : Consistent (drop wiring serverId) := by
  intro id entry filed
  by_cases same : id = serverId
  · simp only [drop, put, if_pos same] at filed
    exact absurd filed (by simp)
  · simp only [drop, put, if_neg same] at filed
    exact held id entry filed

theorem a_reuse_is_wired_like_a_fresh_build (wiring : Wiring) (serverId : String)
    (server : UpstreamServer) (entry : Wired) (held : Consistent wiring)
    (filed : wiring.table serverId = some entry) (same : entry.key = signatureOf server) :
    wiringOf entry.built = wiringOf server :=
  an_unchanged_signature_is_the_same_wiring entry.built server
    ((held serverId entry filed).symm.trans same)

def stdioA : UpstreamServer :=
  ⟨"gh", "github", "v1", "stdio", "stdio:", "npx", ["-y", "gh-mcp"], [], []⟩
def stdioB : UpstreamServer :=
  ⟨"gh", "github", "v1", "stdio", "stdio:", "node", ["-y", "gh-mcp"], [], []⟩

def httpA : UpstreamServer :=
  ⟨"gh", "github", "v1", "streamable-http", "https://a/mcp", "", [], [], []⟩
def httpB : UpstreamServer :=
  ⟨"gh", "github", "v1", "streamable-http", "https://b/mcp", "", [], [], []⟩

structure NoCommand where
  transport : String
  endpoint : String
  args : List String
  env : List (String × String)
  headers : List (String × String)
deriving DecidableEq

def withoutCommand (server : UpstreamServer) : NoCommand :=
  ⟨server.transport, server.endpoint, server.args, server.env, server.headers⟩

structure NoEndpoint where
  transport : String
  command : String
  args : List String
  env : List (String × String)
  headers : List (String × String)
deriving DecidableEq

def withoutEndpoint (server : UpstreamServer) : NoEndpoint :=
  ⟨server.transport, server.command, server.args, server.env, server.headers⟩

theorem a_signature_that_drops_a_field_reuses_a_stale_upstream :
    withoutCommand stdioA = withoutCommand stdioB ∧
    wiringOf stdioA ≠ wiringOf stdioB ∧
    signatureOf stdioA ≠ signatureOf stdioB := by
  decide

theorem a_signature_that_drops_the_endpoint_reuses_a_stale_upstream :
    withoutEndpoint httpA = withoutEndpoint httpB ∧
    wiringOf httpA ≠ wiringOf httpB ∧
    signatureOf httpA ≠ signatureOf httpB := by
  decide

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

theorem forgetting_the_remove_leaks_it :
    (current { table := fun _ => some ⟨signatureOf stdioA, stdioA⟩, closed := [] } "gh" stdioB).1.table "gh"
      = (currentLeaking { table := fun _ => some ⟨signatureOf stdioA, stdioA⟩, closed := [] } "gh" stdioB).1.table "gh" ∧
    (current { table := fun _ => some ⟨signatureOf stdioA, stdioA⟩, closed := [] } "gh" stdioB).1.closed = ["gh"] ∧
    (currentLeaking { table := fun _ => some ⟨signatureOf stdioA, stdioA⟩, closed := [] } "gh" stdioB).1.closed = [] := by
  decide

def dropLeaking (wiring : Wiring) (_ : String) : Wiring := wiring

theorem an_unanswered_server_keeps_its_upstream_without_the_remove :
    (drop { table := fun _ => some ⟨signatureOf stdioA, stdioA⟩, closed := [] } "gh").table "gh" = none ∧
    (dropLeaking { table := fun _ => some ⟨signatureOf stdioA, stdioA⟩, closed := [] } "gh").table "gh"
      = some ⟨signatureOf stdioA, stdioA⟩ := by
  decide

theorem the_signature_does_not_see_the_id_the_upstream_indexes_by :
    signatureOf { stdioA with serverId := "other" } = signatureOf stdioA := by
  decide

end McpGateway
