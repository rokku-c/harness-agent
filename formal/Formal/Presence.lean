/-
  The lease table behind a node's presence — `packages/agentd/src/presence-table.ts`.

  The table answers whether a node is online, and the centre dispatches work on
  that answer. Two of its rules fail silently when they are wrong: a dead node
  keeps reading online and is sent work, and "up since" quietly counts the time the
  node was down.

  **A backwards clock cannot extend a lease** —
  `stepping_the_wall_clock_back_cannot_revive_a_lapsed_lease`. The age is the
  larger of the two readings, and the monotonic reading cannot be walked backwards,
  so no wall-clock step can shrink an age below the monotonic one. Read the wall
  clock alone and a step back revives a node that has been silent for as long as
  the step: `reading_only_the_wall_clock_lets_a_step_back_revive_a_dead_node`.
  The maximum is safe in the other direction too, so it is not a trade:
  `a_forward_step_never_keeps_a_lapsed_lease_alive` — a step forward only expires
  leases early, which is the fail-closed way for this to go wrong.

  **A lapsed presence is a new presence** — `a_lapsed_presence_starts_over`, with
  `a_live_presence_keeps_its_start` for the other direction, since a start that is
  never carried across would make "up since" always the last heartbeat. Carry it
  across the lapse and the time the node was down reads as uptime:
  `continuing_a_lapsed_presence_claims_the_time_it_was_down_as_uptime`.

  **A nudge is not a hello** — `a_nudge_is_not_a_hello`, against
  `a_live_node_hears_its_nudge`. A withdrawal is meant to be an ending, and a
  heartbeat that renewed one would put the node back to `online` with no announce
  in between and nothing to say a presence had been re-established.

  Idealisation: a millisecond is a natural number, so `Math.max(0, …)` is the
  truncating subtraction rather than a third term. A withdrawn lease's
  `presentSince` is modelled as a value although the file leaves it undefined —
  it is unobservable, because `lapsed` is true of a withdrawn lease and the next
  sighting therefore starts over.
-/

namespace Agentd

abbrev Millis := Nat

/-- One node's lease: when it was last heard from on each clock, and when the
presence it is renewing began. -/
structure Lease where
  lastSeen : Millis
  seenAtMono : Millis
  presentSince : Millis
  withdrawn : Bool
deriving DecidableEq, Repr

/-- `ageOf` — the larger of the two ages. The monotonic reading cannot be walked
backwards, which is the whole of why the maximum is taken. -/
def ageOf (now monoNow : Millis) (l : Lease) : Millis :=
  max (now - l.lastSeen) (monoNow - l.seenAtMono)

/-- `lapsed` — withdrawn, or older than the TTL. -/
def lapsed (ttl now monoNow : Millis) (l : Lease) : Bool :=
  l.withdrawn || decide (ttl ≤ ageOf now monoNow l)

/-- What the table reports about a node. -/
def online (ttl now monoNow : Millis) (l : Lease) : Bool :=
  !l.withdrawn && decide (ageOf now monoNow l < ttl)

/-- `announce` and `heartbeat` — a sighting. The presence continues only while the
previous one is still live. -/
def seen (ttl now monoNow : Millis) (previous : Option Lease) : Lease :=
  { lastSeen := now, seenAtMono := monoNow, withdrawn := false,
    presentSince :=
      match previous with
      | none => now
      | some p => if lapsed ttl now monoNow p then now else p.presentSince }

/-- The header's claim: a lease the monotonic clock has run out on reads offline,
whatever the wall clock says. Quantified over every wall reading, which is what
"cannot be extended by the clock moving backwards" means — the step is one of the
readings, and none of them revives the lease. -/
theorem stepping_the_wall_clock_back_cannot_revive_a_lapsed_lease
    (ttl : Millis) (l : Lease) (now monoNow : Millis) (gone : ttl ≤ monoNow - l.seenAtMono) :
    online ttl now monoNow l = false := by
  have age : ttl ≤ ageOf now monoNow l := Nat.le_trans gone (Nat.le_max_right _ _)
  have notYoung : ¬ ageOf now monoNow l < ttl := Nat.not_lt.mpr age
  simp [online, notYoung]

/-- The other direction, so that "never online" is not what was proved: a node
inside its lease reads online. -/
theorem a_node_inside_its_lease_reads_online (ttl : Millis) (l : Lease) (now monoNow : Millis)
    (awake : l.withdrawn = false) (young : ageOf now monoNow l < ttl) :
    online ttl now monoNow l = true := by
  simp [online, awake, young]

/-- The mirror, and why the maximum is safe to take: a wall-clock step forward
only ever expires leases early. Nothing here reads online that the wall clock
alone would have called dead. -/
theorem a_forward_step_never_keeps_a_lapsed_lease_alive (ttl : Millis) (l : Lease)
    (now monoNow : Millis) (gone : ttl ≤ now - l.lastSeen) : online ttl now monoNow l = false := by
  have age : ttl ≤ ageOf now monoNow l := Nat.le_trans gone (Nat.le_max_left _ _)
  simp [online, Nat.not_lt.mpr age]

/-- A first sighting begins the presence now. -/
theorem a_first_sighting_starts_the_presence (ttl now monoNow : Millis) :
    (seen ttl now monoNow none).presentSince = now := by
  simp [seen]

/-- A sighting renews the lease on both clocks and clears the withdrawal. -/
theorem a_sighting_is_a_live_lease (ttl now monoNow : Millis) (previous : Option Lease) :
    (seen ttl now monoNow previous).withdrawn = false ∧
    (seen ttl now monoNow previous).lastSeen = now ∧
    (seen ttl now monoNow previous).seenAtMono = monoNow := by
  simp [seen]

/-- The claim the table's `lapsed` test is there for: a presence that had lapsed
starts over, so "up since" does not include the time the node was down. -/
theorem a_lapsed_presence_starts_over (ttl now monoNow : Millis) (p : Lease)
    (gone : lapsed ttl now monoNow p = true) :
    (seen ttl now monoNow (some p)).presentSince = now := by
  simp [seen, gone]

/-- And the other direction: a presence still inside its lease continues, so
"up since" is the start of the presence rather than of the last heartbeat. -/
theorem a_live_presence_keeps_its_start (ttl now monoNow : Millis) (p : Lease)
    (live : lapsed ttl now monoNow p = false) :
    (seen ttl now monoNow (some p)).presentSince = p.presentSince := by
  simp [seen, live]

/-- `heartbeat` — a nudge renews a presence that exists and has not been
withdrawn, and is nothing at all otherwise. -/
def heartbeat (ttl now monoNow : Millis) (previous : Option Lease) : Option Lease :=
  match previous with
  | none => none
  | some p => if p.withdrawn then none else some (seen ttl now monoNow (some p))

/-- The rule the guard is there for: a node that said goodbye does not come back
by being nudged. Read as a plain renewal it would return to `online` without ever
announcing, and nothing would say a presence had been re-established. -/
theorem a_nudge_is_not_a_hello (ttl now monoNow : Millis) (p : Lease)
    (gone : p.withdrawn = true) : heartbeat ttl now monoNow (some p) = none := by
  simp [heartbeat, gone]

/-- And a nudge from a node that never announced is not a hello either. -/
theorem a_nudge_from_a_stranger_is_not_a_hello (ttl now monoNow : Millis) :
    heartbeat ttl now monoNow none = none := rfl

/-- The other direction: a live node does hear its nudge, so the guard has not
made `heartbeat` a no-op. -/
theorem a_live_node_hears_its_nudge (ttl now monoNow : Millis) (p : Lease)
    (awake : p.withdrawn = false) :
    heartbeat ttl now monoNow (some p) = some (seen ttl now monoNow (some p)) := by
  simp [heartbeat, awake]

/-- The wall clock read alone — the shape the maximum rules out. -/
def onlineByTheWallClock (ttl now : Millis) (l : Lease) : Bool :=
  !l.withdrawn && decide (now - l.lastSeen < ttl)
/-- The control. The node was last heard from at wall time 100 and monotonic 100;
the wall clock has since stepped back to 100 while 100ms of monotonic time passed
on the same lease. Read alone, the wall clock says it was just seen and the node
reads online; read as the file reads it, the lease has aged 100ms against a 30ms
TTL and the node is offline — and every dispatch to it is being sent to nothing. -/
theorem reading_only_the_wall_clock_lets_a_step_back_revive_a_dead_node :
    onlineByTheWallClock 30 100 { lastSeen := 100, seenAtMono := 100, presentSince := 100, withdrawn := false } = true ∧
    online 30 100 200 { lastSeen := 100, seenAtMono := 100, presentSince := 100, withdrawn := false } = false := by
  decide

/-- The lapse read as a continuation: renew the clocks, keep the start. -/
def seenContinuing (now monoNow : Millis) (previous : Option Lease) : Lease :=
  { lastSeen := now, seenAtMono := monoNow, withdrawn := false,
    presentSince := match previous with | none => now | some p => p.presentSince }

/-- The control. The node was down from 100 to 700, far past a 30ms TTL; the next
sighting is a new presence and starts at 700. Read as a continuation it starts at
100, so "up since" reports 600ms of downtime as uptime — the number a caller uses
to decide whether the node is worth dispatching to. -/
theorem continuing_a_lapsed_presence_claims_the_time_it_was_down_as_uptime :
    (seen 30 700 700 (some ({ lastSeen := 100, seenAtMono := 100, presentSince := 100, withdrawn := false } : Lease))).presentSince = 700 ∧
    (seenContinuing 700 700 (some ({ lastSeen := 100, seenAtMono := 100, presentSince := 100, withdrawn := false } : Lease))).presentSince = 100 := by
  decide

end Agentd
