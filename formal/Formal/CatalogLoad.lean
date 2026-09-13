/-
  Filling the catalog from live upstreams — `mcp-gateway/src/catalog-load.ts`.

  Listing is best-effort per server: one unreachable upstream must not take the
  gateway down, so the round records the failure and carries on. A server that
  failed keeps the tools it last advertised, because a transient blip must not
  make the surface flap — clients cache tool lists aggressively.

  **A failure is a no-op on the surface** —
  `a_failed_listing_leaves_the_surface_untouched`, and what the surface is left
  showing, `a_server_that_fails_keeps_what_it_last_advertised`. Emptied instead,
  a live server's tools go and nothing else changes:
  `clearing_on_failure_empties_a_live_surface`.

  **The report is the only place the failure is visible** —
  `a_report_names_only_servers_that_were_looked_at`,
  `every_server_looked_at_is_in_the_report`, `no_server_is_both_loaded_and_failed`.
  Take those away and the operator reads a stale surface as a fresh one:
  `swallowing_a_failure_hides_it`.

  Idealisation: the surface is the table `catalog.ts` keeps, one list of tool
  names per server id, without the advertised-name derivation — that is
  `Formal/ToolKey.lean`'s subject — and without the collision it refuses, which
  it checks before it writes, so a refused replace cannot be the one that moved
  the surface. A listing is `some tools` when it answered and `none` when it
  threw. The round installs them in the order the file lists the servers; what
  `Promise.all` interleaves does not matter, since each server owns one key.
-/

namespace McpGateway

/-- The catalog: one list of tool names per server id. -/
abbrev Surface := String → List String

/-- Installing one server's tools, whole, as `catalog.replace` does. -/
def replace (surface : Surface) (serverId : String) (tools : List String) : Surface :=
  fun id => if id = serverId then tools else surface id

/-- What one server's listing does to the surface: a listing that answered
installs what it listed, one that threw changes nothing. -/
def install (surface : Surface) (listing : String → Option (List String)) (serverId : String) : Surface :=
  match listing serverId with
  | some tools => replace surface serverId tools
  | none => surface

/-- A round over the servers, in the order the file hands them over. -/
def round (surface : Surface) (listing : String → Option (List String)) : List String → Surface
  | [] => surface
  | serverId :: rest => round (install surface listing serverId) listing rest

/-- The servers whose listing answered. -/
def loaded (listing : String → Option (List String)) (servers : List String) : List String :=
  servers.filter fun serverId => (listing serverId).isSome

/-- And the ones it did not — the failure the round reports rather than throws. -/
def failed (listing : String → Option (List String)) (servers : List String) : List String :=
  servers.filter fun serverId => (listing serverId).isNone

/-- A listing that threw leaves the surface as it was. This is the whole of "a
server that fails keeps the tools it last advertised", and the reason a blip
cannot flap the surface. -/
theorem a_failed_listing_leaves_the_surface_untouched (surface : Surface)
    (listing : String → Option (List String)) (serverId : String) (down : listing serverId = none) :
    install surface listing serverId = surface := by
  simp [install, down]

/-- What that leaves the server advertising: exactly what it last advertised. -/
theorem a_server_that_fails_keeps_what_it_last_advertised (surface : Surface)
    (listing : String → Option (List String)) (serverId : String) (down : listing serverId = none) :
    install surface listing serverId serverId = surface serverId := by
  simp [install, down]

/-- A listing that answered installs exactly what it listed. -/
theorem a_listing_that_answers_installs_exactly_what_it_listed (surface : Surface)
    (listing : String → Option (List String)) (serverId : String) (tools : List String)
    (up : listing serverId = some tools) :
    install surface listing serverId serverId = tools := by
  simp [install, up, replace]

/-- And it leaves every other server alone, so one upstream's answer cannot move
another's tools. -/
theorem a_listing_that_answers_leaves_every_other_server_alone (surface : Surface)
    (listing : String → Option (List String)) (serverId other : String) (tools : List String)
    (up : listing serverId = some tools) (elsewhere : other ≠ serverId) :
    install surface listing serverId other = surface other := by
  simp [install, up, replace, elsewhere]

/-- The same frame for a listing that threw — together, these are what make the
servers independent of one another inside one round. -/
theorem an_install_leaves_every_other_server_alone (surface : Surface)
    (listing : String → Option (List String)) (serverId other : String) (elsewhere : other ≠ serverId) :
    install surface listing serverId other = surface other := by
  simp only [install]
  cases held : listing serverId with
  | some tools => simp [replace, elsewhere]
  | none => rfl

/-- A round only touches the servers it was handed: a server it was not given
keeps its tools. -/
theorem a_round_leaves_an_unlisted_server_alone (surface : Surface)
    (listing : String → Option (List String)) (servers : List String) (other : String)
    (absent : other ∉ servers) : round surface listing servers other = surface other := by
  induction servers generalizing surface with
  | nil => rfl
  | cons serverId rest ih =>
    have elsewhere : other ≠ serverId := fun same => absent (by simp [same])
    simp only [round]
    rw [ih (install surface listing serverId) fun there => absent (by simp [there])]
    exact an_install_leaves_every_other_server_alone surface listing serverId other elsewhere

/-- Neither list names a server the round was not given. -/
theorem a_report_names_only_servers_that_were_looked_at (listing : String → Option (List String))
    (servers : List String) (serverId : String) :
    (serverId ∈ loaded listing servers → serverId ∈ servers) ∧
    (serverId ∈ failed listing servers → serverId ∈ servers) :=
  ⟨fun there => (List.mem_filter.mp there).1, fun there => (List.mem_filter.mp there).1⟩

/-- Every server the round was given is in one of the two lists: a failure is
reported, never dropped on the floor. -/
theorem every_server_looked_at_is_in_the_report (listing : String → Option (List String))
    (servers : List String) (serverId : String) (there : serverId ∈ servers) :
    serverId ∈ loaded listing servers ∨ serverId ∈ failed listing servers := by
  cases held : listing serverId with
  | some tools =>
    exact Or.inl (List.mem_filter.mpr ⟨there, by simp [held]⟩)
  | none =>
    exact Or.inr (List.mem_filter.mpr ⟨there, by simp [held]⟩)

/-- And no server is in both: one whose listing answered is not reported as one
that failed. -/
theorem no_server_is_both_loaded_and_failed (listing : String → Option (List String))
    (servers : List String) (serverId : String)
    (both : serverId ∈ loaded listing servers ∧ serverId ∈ failed listing servers) : False := by
  have up : (listing serverId).isSome = true := (List.mem_filter.mp both.1).2
  have down : (listing serverId).isNone = true := (List.mem_filter.mp both.2).2
  cases held : listing serverId <;> simp [held] at up down

/-- The install with the failure taken out: a server whose listing threw is
emptied instead of kept — "best-effort" read as "drop what could not be
refreshed", which is what makes a surface flap. -/
def installEmptying (surface : Surface) (listing : String → Option (List String)) (serverId : String) : Surface :=
  match listing serverId with
  | some tools => replace surface serverId tools
  | none => replace surface serverId []

/-- The control: emptying loses a live server's tools, keeping them does not, and
the report names the failure either way — it is computed from the listing, so it
cannot say which of the two happened. -/
theorem clearing_on_failure_empties_a_live_surface :
    installEmptying (fun _ => ["read"]) (fun _ => none) "gh" "gh" = [] ∧
    install (fun _ => ["read"]) (fun _ => none) "gh" "gh" = ["read"] ∧
    failed (fun _ => none) ["gh"] = ["gh"] := by
  decide

/-- The report with the catch taken out — the failure swallowed, so a stale
surface and a fresh one read the same. -/
def failedQuietly (_ : String → Option (List String)) (_ : List String) : List String := []

/-- The control: swallowing leaves the surface exactly where the honest round
leaves it and empties the report, so nothing distinguishes the two. -/
theorem swallowing_a_failure_hides_it :
    round (fun _ => ["read"]) (fun _ => none) ["gh"] "gh" = ["read"] ∧
    failed (fun _ => none) ["gh"] = ["gh"] ∧
    failedQuietly (fun _ => none) ["gh"] = [] := by
  decide

end McpGateway
