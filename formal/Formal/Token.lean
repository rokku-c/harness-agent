namespace McpGateway

structure TokenRecord where
  tokenHash : String
  principalKey : String
  issuedAt : Nat
  expiresAt : Option Nat
  revokedAt : Option Nat
  lastUsedAt : Option Nat
deriving DecidableEq, Repr

abbrev Ledger := String → Option TokenRecord

def stands (now : Nat) (record : TokenRecord) : Bool :=
  !record.revokedAt.isSome &&
    (match record.expiresAt with
     | none => true
     | some deadline => decide (now < deadline))

def admits (now : Nat) (entry : Option TokenRecord) : Bool :=
  match entry with
  | none => false
  | some record => stands now record

def deadlineOf (entry : Option TokenRecord) : Option Nat :=
  match entry with
  | none => none
  | some record => record.expiresAt

def verify (now : Nat) (ledger : Ledger) (hash : String) : Option TokenRecord :=
  match ledger hash with
  | none => none
  | some found => if stands now found then some { found with lastUsedAt := some now } else none

def markUsed (now : Nat) (ledger : Ledger) (hash : String) : Ledger :=
  fun key => if key = hash then (ledger key).map fun found => { found with lastUsedAt := some now } else ledger key

def markRevoked (now : Nat) (ledger : Ledger) (hash : String) : Ledger :=
  fun key => if key = hash then (ledger key).map fun found => { found with revokedAt := some now } else ledger key

def revoke (now : Nat) (ledger : Ledger) (hash : String) : Option Ledger :=
  match ledger hash with
  | none => none
  | some found => if found.revokedAt.isSome then none else some (markRevoked now ledger hash)

theorem a_record_that_stands_is_not_revoked (now : Nat) (record : TokenRecord)
    (good : stands now record = true) : record.revokedAt = none := by
  cases held : record.revokedAt with
  | none => rfl
  | some deadline => simp [stands, held] at good

theorem a_record_that_stands_has_not_expired (now : Nat) (record : TokenRecord)
    (good : stands now record = true) : ∀ deadline, record.expiresAt = some deadline → now < deadline := by
  intro deadline expiry
  simp only [stands, expiry, Bool.and_eq_true] at good
  exact of_decide_eq_true good.2

theorem an_unknown_token_verifies_nowhere (now : Nat) (ledger : Ledger) (hash : String)
    (unknown : ledger hash = none) : verify now ledger hash = none := by
  simp only [verify, unknown]

theorem a_record_comes_back_only_when_it_is_neither_revoked_nor_expired (now : Nat)
    (ledger : Ledger) (hash : String) (record : TokenRecord)
    (came : verify now ledger hash = some record) :
    record.revokedAt = none ∧ (∀ deadline, record.expiresAt = some deadline → now < deadline) := by
  cases held : ledger hash with
  | none => simp only [verify, held] at came; nomatch came
  | some found =>
    by_cases good : stands now found = true
    · simp only [verify, held, if_pos good] at came
      have same : record = { found with lastUsedAt := some now } := (Option.some.inj came).symm
      rw [same]
      exact ⟨a_record_that_stands_is_not_revoked now found good,
        a_record_that_stands_has_not_expired now found good⟩
    · simp only [verify, held, if_neg good] at came; nomatch came

theorem a_record_that_stands_comes_back (now : Nat) (ledger : Ledger) (hash : String)
    (record : TokenRecord) (filed : ledger hash = some record) (good : stands now record = true) :
    verify now ledger hash = some { record with lastUsedAt := some now } := by
  simp only [verify, filed, if_pos good]

theorem a_verification_moves_no_expiry (now : Nat) (ledger : Ledger) (hash : String)
    (record : TokenRecord) (came : verify now ledger hash = some record) :
    ∃ filed, ledger hash = some filed ∧ record.expiresAt = filed.expiresAt ∧
      record.revokedAt = filed.revokedAt ∧ record.lastUsedAt = some now := by
  cases held : ledger hash with
  | none => simp only [verify, held] at came; nomatch came
  | some found =>
    by_cases good : stands now found = true
    · simp only [verify, held, if_pos good] at came
      refine ⟨found, rfl, ?_, ?_, ?_⟩ <;> rw [(Option.some.inj came).symm]
    · simp only [verify, held, if_neg good] at came; nomatch came

theorem a_verification_refuses_exactly_what_it_did (now later : Nat) (ledger : Ledger)
    (hash key : String) : admits later ((markUsed now ledger hash) key) = admits later (ledger key) := by
  by_cases same : key = hash
  · simp only [same, markUsed]
    cases held : ledger hash <;> rfl
  · simp only [markUsed, if_neg same]

theorem a_revoked_token_never_verifies_again (now later : Nat) (ledger : Ledger) (hash : String) :
    verify later (markRevoked now ledger hash) hash = none := by
  cases held : ledger hash with
  | none => simp [verify, markRevoked, held]
  | some found => simp [verify, markRevoked, held, stands]

theorem revoking_reports_whether_it_was_still_good (now : Nat) (ledger : Ledger) (hash : String)
    (record : TokenRecord) (filed : ledger hash = some record) :
    (revoke now ledger hash).isSome = !record.revokedAt.isSome := by
  cases held : record.revokedAt <;> simp [revoke, filed, held]

def renewing (ttl : Nat) (now : Nat) (ledger : Ledger) (hash : String) : Option TokenRecord :=
  match ledger hash with
  | none => none
  | some found =>
    if stands now found then some { found with expiresAt := some (now + ttl), lastUsedAt := some now } else none

def expiring : TokenRecord :=
  { tokenHash := "h", principalKey := "agent:a1", issuedAt := 0, expiresAt := some 10,
    revokedAt := none, lastUsedAt := none }

def usesExpiring : Ledger := fun _ => some expiring

theorem renewing_on_use_never_expires :
    deadlineOf (verify 5 usesExpiring "h") = some 10 ∧
      deadlineOf (renewing 10 5 usesExpiring "h") = some 15 := by
  decide

theorem a_token_dies_at_its_deadline :
    verify 10 usesExpiring "h" = none ∧ verify 11 usesExpiring "h" = none ∧
      (verify 9 usesExpiring "h").isSome = true := by
  decide

theorem revoking_is_not_the_clock_running_out :
    verify 20 (markRevoked 1 usesExpiring "h") "h" = none ∧
      verify 20 usesExpiring "h" = none ∧
      verify 5 (markRevoked 1 usesExpiring "h") "h" = none ∧
      verify 5 usesExpiring "h" ≠ none := by
  decide

end McpGateway
