/-
  What the registry keeps about one server — `mcp-registry/src/store.ts`,
  `contract.ts`.

  A record carries a lease, and the lease decides how the record ages. A
  `dynamic` one — a server that announced itself — goes `warn` and then `offline`
  the longer it stays silent. A `static` one — a trusted local registration — is
  healthy at any age: `statusFor` answers `healthy` before it looks at the clock.

  `upsert` writes the lease of whichever caller ran last, so the two callers do
  not just differ in how they are made, they *re-make* each other's records. A
  registration naming an id that announced goes on to be a static record, and
  since a static record never ages, a server that had gone offline reads healthy
  from then on — for as long as it is left alone, and `heartbeat` cannot move it
  because a static record does not read the clock at all. Nothing in the record
  says the lease moved: `lastSeen` is still the old reading, only `status` has
  changed, and `register` does not renew it.

  **A registration pins a server that had gone offline** —
  `a_registration_pins_a_server_that_had_gone_offline`, and what that is worth at
  the one place a status is acted on, `a_registration_makes_an_offline_server_choosable_again`:
  `choose` refuses a preferred id that reads `offline`, and there is no longer one
  to refuse. Announcing instead leaves the record aging — the control,
  `announcing_again_leaves_the_record_aging`.

  **The status and the timestamp disagree afterwards** —
  `a_registration_does_not_renew_what_the_record_says_it_last_saw`, so a record
  can read `healthy` over a `lastSeen` no reader would call recent, and
  `a_heartbeat_cannot_move_a_pinned_record`.

  **One call, two dates** — `registering_a_new_id_dates_it_and_a_known_one_does_not`:
  the fresh branch of `upsert` dates the record `now` whatever the caller asked
  for, the existing branch moves `lastSeen` only for the caller that renews. So
  the same call means "first seen now" for an unknown id and "seen whenever it
  was last seen" for a known one.

  Idealisation: the clock is a `Nat` and `Math.max(0, now - lastSeen)` is
  truncated subtraction, which is what makes the age a `Nat`. `upsert`'s
  `ownerId` carry-over, the runtime config, the authorization check and the
  `heartbeat`-as-`touch` step are left out — none of them reads or writes the
  lease or the age, and the subject here is that they are not what decides a
  record's status. A record is its lease and the two readings it keeps.
-/

namespace McpRegistry

/-- What the registry keeps about one server id: the lease it is held under, when
it was last seen, and when it was first filed. -/
structure Held where
  lease : String
  lastSeen : Nat
  registeredAt : Nat

/-- `statusFor`: a static lease is healthy before the clock is read at all; a
dynamic one ages out. -/
def statusOf (held : Held) (now healthyUntil offlineAfter : Nat) : String :=
  if held.lease = "static" then "healthy"
  else if now - held.lastSeen ≥ offlineAfter then "offline"
  else if now - held.lastSeen ≥ healthyUntil then "warn"
  else "healthy"

/-- `upsert`'s fresh branch: a record for an id nothing is filed under, dated
`now` — the caller's `renew` is not read. -/
def filed (now : Nat) (lease : String) : Held :=
  { lease, lastSeen := now, registeredAt := now }

/-- `upsert`'s existing branch: the lease becomes the caller's, and `lastSeen`
moves only for the caller that renews. -/
def refile (held : Held) (lease : String) (renew : Bool) (now : Nat) : Held :=
  { held with lease, lastSeen := if renew then now else held.lastSeen }

/-- `register`: the trusted local path — a static lease, no renewal. -/
def register (held : Held) (now : Nat) : Held := refile held "static" false now

/-- `announce`: the authenticated remote path — a dynamic lease, renewed. -/
def announce (held : Held) (now : Nat) : Held := refile held "dynamic" true now

/-- A static lease is healthy at any age: the clock is not consulted. -/
theorem a_static_lease_is_healthy_at_any_age (held : Held) (now healthyUntil offlineAfter : Nat) :
    statusOf (register held now) now healthyUntil offlineAfter = "healthy" := by
  simp [statusOf, register, refile]

/-- So a registration naming a server that had gone offline reads healthy from
then on, however long it is left alone — and that is not a reading of its age,
which has not moved. -/
theorem a_registration_pins_a_server_that_had_gone_offline (held : Held) (now healthyUntil offlineAfter : Nat)
    (down : statusOf held now healthyUntil offlineAfter = "offline") (later : Nat) :
    statusOf held now healthyUntil offlineAfter = "offline" ∧
    statusOf (register held now) later healthyUntil offlineAfter = "healthy" ∧
    (register held now).lastSeen = held.lastSeen := by
  refine ⟨down, ?_, ?_⟩
  · simp [statusOf, register, refile]
  · simp [register, refile]

/-- A registration does not renew what the record says it last saw, so a record
can read healthy over a reading no one would call recent. The two readings
disagree, and no field says the lease moved. -/
theorem a_registration_does_not_renew_what_the_record_says_it_last_saw (held : Held) (now : Nat) :
    (register held now).lastSeen = held.lastSeen ∧ (announce held now).lastSeen = now := by
  constructor <;> simp [register, announce, refile]

/-- And a heartbeat cannot move a pinned record: it writes `lastSeen`, which a
static status does not read. -/
theorem a_heartbeat_cannot_move_a_pinned_record (held : Held) (now later healthyUntil offlineAfter : Nat) :
    statusOf { register held now with lastSeen := later } later healthyUntil offlineAfter = "healthy" := by
  simp [statusOf, register, refile]

/-- `choose` with a preferred id reads the record and refuses one that is
offline. -/
def choosable (held : Held) (now healthyUntil offlineAfter : Nat) : Bool :=
  statusOf held now healthyUntil offlineAfter != "offline"

/-- The payoff at the one place a status is acted on: a server that had gone
offline is refused as a choice, and after a registration there is nothing to
refuse. -/
theorem a_registration_makes_an_offline_server_choosable_again (held : Held)
    (now healthyUntil offlineAfter later : Nat) (down : statusOf held now healthyUntil offlineAfter = "offline") :
    choosable held now healthyUntil offlineAfter = false ∧
    choosable (register held now) later healthyUntil offlineAfter = true := by
  refine ⟨?_, ?_⟩
  · simp [choosable, down]
  · simp [choosable, statusOf, register, refile]

/-- The control: announcing again instead leaves the record a dynamic one, so it
ages out and is refused again once it falls silent. The two callers, on one id,
do not agree about whether the server is there. -/
theorem announcing_again_leaves_the_record_aging (held : Held) (now healthyUntil offlineAfter : Nat) :
    statusOf (announce held now) (now + offlineAfter) healthyUntil offlineAfter = "offline" ∧
    statusOf (register held now) (now + offlineAfter) healthyUntil offlineAfter = "healthy" := by
  constructor
  · simp [statusOf, announce, refile]
  · simp [statusOf, register, refile]

/-- One call, two dates: the fresh branch dates an unknown id `now` whatever the
caller asked for, the existing branch moves `lastSeen` only for the caller that
renews. -/
theorem registering_a_new_id_dates_it_and_a_known_one_does_not :
    (filed 100 "static").lastSeen = 100 ∧ (register ⟨"dynamic", 5, 1⟩ 100).lastSeen = 5 ∧
    (announce ⟨"dynamic", 5, 1⟩ 100).lastSeen = 100 := by
  decide

end McpRegistry
