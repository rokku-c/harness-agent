namespace McpRegistry

structure Held where
  lease : String
  lastSeen : Nat
  registeredAt : Nat

def statusOf (held : Held) (now healthyUntil offlineAfter : Nat) : String :=
  if held.lease = "static" then "healthy"
  else if now - held.lastSeen ≥ offlineAfter then "offline"
  else if now - held.lastSeen ≥ healthyUntil then "warn"
  else "healthy"

def filed (now : Nat) (lease : String) : Held :=
  { lease, lastSeen := now, registeredAt := now }

def refile (held : Held) (lease : String) (renew : Bool) (now : Nat) : Held :=
  { held with lease, lastSeen := if renew then now else held.lastSeen }

def register (held : Held) (now : Nat) : Held := refile held "static" false now

def announce (held : Held) (now : Nat) : Held := refile held "dynamic" true now

theorem a_static_lease_is_healthy_at_any_age (held : Held) (now healthyUntil offlineAfter : Nat) :
    statusOf (register held now) now healthyUntil offlineAfter = "healthy" := by
  simp [statusOf, register, refile]

theorem a_registration_pins_a_server_that_had_gone_offline (held : Held) (now healthyUntil offlineAfter : Nat)
    (down : statusOf held now healthyUntil offlineAfter = "offline") (later : Nat) :
    statusOf held now healthyUntil offlineAfter = "offline" ∧
    statusOf (register held now) later healthyUntil offlineAfter = "healthy" ∧
    (register held now).lastSeen = held.lastSeen := by
  refine ⟨down, ?_, ?_⟩
  · simp [statusOf, register, refile]
  · simp [register, refile]

theorem a_registration_does_not_renew_what_the_record_says_it_last_saw (held : Held) (now : Nat) :
    (register held now).lastSeen = held.lastSeen ∧ (announce held now).lastSeen = now := by
  constructor <;> simp [register, announce, refile]

theorem a_heartbeat_cannot_move_a_pinned_record (held : Held) (now later healthyUntil offlineAfter : Nat) :
    statusOf { register held now with lastSeen := later } later healthyUntil offlineAfter = "healthy" := by
  simp [statusOf, register, refile]

def choosable (held : Held) (now healthyUntil offlineAfter : Nat) : Bool :=
  statusOf held now healthyUntil offlineAfter != "offline"

theorem a_registration_makes_an_offline_server_choosable_again (held : Held)
    (now healthyUntil offlineAfter later : Nat) (down : statusOf held now healthyUntil offlineAfter = "offline") :
    choosable held now healthyUntil offlineAfter = false ∧
    choosable (register held now) later healthyUntil offlineAfter = true := by
  refine ⟨?_, ?_⟩
  · simp [choosable, down]
  · simp [choosable, statusOf, register, refile]

theorem announcing_again_leaves_the_record_aging (held : Held) (now healthyUntil offlineAfter : Nat) :
    statusOf (announce held now) (now + offlineAfter) healthyUntil offlineAfter = "offline" ∧
    statusOf (register held now) (now + offlineAfter) healthyUntil offlineAfter = "healthy" := by
  constructor
  · simp [statusOf, announce, refile]
  · simp [statusOf, register, refile]

theorem registering_a_new_id_dates_it_and_a_known_one_does_not :
    (filed 100 "static").lastSeen = 100 ∧ (register ⟨"dynamic", 5, 1⟩ 100).lastSeen = 5 ∧
    (announce ⟨"dynamic", 5, 1⟩ 100).lastSeen = 100 := by
  decide

end McpRegistry
