namespace Agentd

abbrev Millis := Nat

structure Lease where
  lastSeen : Millis
  seenAtMono : Millis
  presentSince : Millis
  withdrawn : Bool
deriving DecidableEq, Repr

def ageOf (now monoNow : Millis) (l : Lease) : Millis :=
  max (now - l.lastSeen) (monoNow - l.seenAtMono)

def lapsed (ttl now monoNow : Millis) (l : Lease) : Bool :=
  l.withdrawn || decide (ttl ≤ ageOf now monoNow l)

def online (ttl now monoNow : Millis) (l : Lease) : Bool :=
  !l.withdrawn && decide (ageOf now monoNow l < ttl)

def seen (ttl now monoNow : Millis) (previous : Option Lease) : Lease :=
  { lastSeen := now, seenAtMono := monoNow, withdrawn := false,
    presentSince :=
      match previous with
      | none => now
      | some p => if lapsed ttl now monoNow p then now else p.presentSince }

theorem stepping_the_wall_clock_back_cannot_revive_a_lapsed_lease
    (ttl : Millis) (l : Lease) (now monoNow : Millis) (gone : ttl ≤ monoNow - l.seenAtMono) :
    online ttl now monoNow l = false := by
  have age : ttl ≤ ageOf now monoNow l := Nat.le_trans gone (Nat.le_max_right _ _)
  have notYoung : ¬ ageOf now monoNow l < ttl := Nat.not_lt.mpr age
  simp [online, notYoung]

theorem a_node_inside_its_lease_reads_online (ttl : Millis) (l : Lease) (now monoNow : Millis)
    (awake : l.withdrawn = false) (young : ageOf now monoNow l < ttl) :
    online ttl now monoNow l = true := by
  simp [online, awake, young]

theorem a_forward_step_never_keeps_a_lapsed_lease_alive (ttl : Millis) (l : Lease)
    (now monoNow : Millis) (gone : ttl ≤ now - l.lastSeen) : online ttl now monoNow l = false := by
  have age : ttl ≤ ageOf now monoNow l := Nat.le_trans gone (Nat.le_max_left _ _)
  simp [online, Nat.not_lt.mpr age]

theorem a_first_sighting_starts_the_presence (ttl now monoNow : Millis) :
    (seen ttl now monoNow none).presentSince = now := by
  simp [seen]

theorem a_sighting_is_a_live_lease (ttl now monoNow : Millis) (previous : Option Lease) :
    (seen ttl now monoNow previous).withdrawn = false ∧
    (seen ttl now monoNow previous).lastSeen = now ∧
    (seen ttl now monoNow previous).seenAtMono = monoNow := by
  simp [seen]

theorem a_lapsed_presence_starts_over (ttl now monoNow : Millis) (p : Lease)
    (gone : lapsed ttl now monoNow p = true) :
    (seen ttl now monoNow (some p)).presentSince = now := by
  simp [seen, gone]

theorem a_live_presence_keeps_its_start (ttl now monoNow : Millis) (p : Lease)
    (live : lapsed ttl now monoNow p = false) :
    (seen ttl now monoNow (some p)).presentSince = p.presentSince := by
  simp [seen, live]

def heartbeat (ttl now monoNow : Millis) (previous : Option Lease) : Option Lease :=
  match previous with
  | none => none
  | some p => if p.withdrawn then none else some (seen ttl now monoNow (some p))

theorem a_nudge_is_not_a_hello (ttl now monoNow : Millis) (p : Lease)
    (gone : p.withdrawn = true) : heartbeat ttl now monoNow (some p) = none := by
  simp [heartbeat, gone]

theorem a_nudge_from_a_stranger_is_not_a_hello (ttl now monoNow : Millis) :
    heartbeat ttl now monoNow none = none := rfl

theorem a_live_node_hears_its_nudge (ttl now monoNow : Millis) (p : Lease)
    (awake : p.withdrawn = false) :
    heartbeat ttl now monoNow (some p) = some (seen ttl now monoNow (some p)) := by
  simp [heartbeat, awake]

def onlineByTheWallClock (ttl now : Millis) (l : Lease) : Bool :=
  !l.withdrawn && decide (now - l.lastSeen < ttl)
theorem reading_only_the_wall_clock_lets_a_step_back_revive_a_dead_node :
    onlineByTheWallClock 30 100 { lastSeen := 100, seenAtMono := 100, presentSince := 100, withdrawn := false } = true ∧
    online 30 100 200 { lastSeen := 100, seenAtMono := 100, presentSince := 100, withdrawn := false } = false := by
  decide

def seenContinuing (now monoNow : Millis) (previous : Option Lease) : Lease :=
  { lastSeen := now, seenAtMono := monoNow, withdrawn := false,
    presentSince := match previous with | none => now | some p => p.presentSince }

theorem continuing_a_lapsed_presence_claims_the_time_it_was_down_as_uptime :
    (seen 30 700 700 (some ({ lastSeen := 100, seenAtMono := 100, presentSince := 100, withdrawn := false } : Lease))).presentSince = 700 ∧
    (seenContinuing 700 700 (some ({ lastSeen := 100, seenAtMono := 100, presentSince := 100, withdrawn := false } : Lease))).presentSince = 100 := by
  decide

end Agentd
