/-
  Whether a bearer token is still good — `packages/mcp-gateway/src/token.ts`.

  The file's header names three ways a token stops working and one clause that
  covers all of them: *every failure returns undefined — the caller denies.* That
  clause is worth proving because one of its readings is silent in the dangerous
  direction: a `verify` that stamped a fresh lifetime onto the record as it used
  it would leave an expiry that never arrives, and nothing on screen would say so.

  **Only a live record comes back** —
  `a_record_comes_back_only_when_it_is_neither_revoked_nor_expired`, from
  `a_record_that_stands_is_not_revoked` and
  `a_record_that_stands_has_not_expired`. The second one pins the boundary: the
  clock reading that would have refused a token is strictly *before* its expiry,
  so the moment a token reaches its own deadline it is dead. A hash the store has
  never seen is the same clause at the lookup — `an_unknown_token_verifies_nowhere`
  — and `a_record_that_stands_comes_back` says the clause is not vacuous.

  **Revoking outlives the clock** — `a_revoked_token_never_verifies_again`,
  whatever the reading, because revocation is checked before the clock is
  consulted at all. `revoking_reports_whether_it_was_still_good` is why a caller
  learns that a second revoke did nothing.

  **Verifying is not a renewal** — `a_verification_moves_no_expiry`: what comes
  back differs from what was filed only in `lastUsedAt`. That is also why the store
  `verify` writes the touched record back into cannot have changed its mind, which
  `a_verification_refuses_exactly_what_it_did` says. Read the other way — stamp a
  lifetime on as the record is used — `renewing_on_use_never_expires`, and a token
  used once per lifetime never reaches the end of one.

  Idealisation: the store is the hash-to-record lookup `records.get` performs, so
  the raw token is not a value in this model at all — a property of the type rather
  than a theorem, which is the strongest form "stored only as its SHA-256 hash"
  could take. `stands` names the two refusals the file writes as successive `if`s,
  in that order: revocation first, then the clock, refusing at `≤` and so not
  granting the deadline itself. `issue` is not modelled, and nothing here reads the
  token that was minted — only the record it left behind. `revoke` returns an
  `Option` where the file returns a `boolean`: `none` is the `false` that says
  there was nothing left to revoke.
-/

namespace McpGateway

/-- A token record as the store files it, under the hash of the token itself. -/
structure TokenRecord where
  tokenHash : String
  principalKey : String
  issuedAt : Nat
  expiresAt : Option Nat
  revokedAt : Option Nat
  lastUsedAt : Option Nat
deriving DecidableEq, Repr

/-- The store, as `records.get` reads it: a hash to the record filed under it. -/
abbrev Ledger := String → Option TokenRecord

/-- The two refusals, in the order the file checks them. -/
def stands (now : Nat) (record : TokenRecord) : Bool :=
  !record.revokedAt.isSome &&
    (match record.expiresAt with
     | none => true
     | some deadline => decide (now < deadline))

/-- `stands` read at a lookup rather than at a record, which is the shape the
store has: a hash with nothing filed under it is refused like any other. -/
def admits (now : Nat) (entry : Option TokenRecord) : Bool :=
  match entry with
  | none => false
  | some record => stands now record

/-- The deadline a lookup answers with, which is what a caller renewing a token
would have to move. -/
def deadlineOf (entry : Option TokenRecord) : Option Nat :=
  match entry with
  | none => none
  | some record => record.expiresAt

/-- `verify`: the lookup, the two refusals, and — when it answers — the record
with the moment it was asked for written onto it. -/
def verify (now : Nat) (ledger : Ledger) (hash : String) : Option TokenRecord :=
  match ledger hash with
  | none => none
  | some found => if stands now found then some { found with lastUsedAt := some now } else none

/-- What `verify` files back — `records.set(touched.tokenHash, touched)`. -/
def markUsed (now : Nat) (ledger : Ledger) (hash : String) : Ledger :=
  fun key => if key = hash then (ledger key).map fun found => { found with lastUsedAt := some now } else ledger key

/-- `revoke` with the marking applied. Every other hash is left as it was. -/
def markRevoked (now : Nat) (ledger : Ledger) (hash : String) : Ledger :=
  fun key => if key = hash then (ledger key).map fun found => { found with revokedAt := some now } else ledger key

/-- `revoke`: nothing when the hash is unknown or already revoked, and the marked
store otherwise — which is what the returned `false` is telling the caller. -/
def revoke (now : Nat) (ledger : Ledger) (hash : String) : Option Ledger :=
  match ledger hash with
  | none => none
  | some found => if found.revokedAt.isSome then none else some (markRevoked now ledger hash)

/-- A record that stands is not revoked. -/
theorem a_record_that_stands_is_not_revoked (now : Nat) (record : TokenRecord)
    (good : stands now record = true) : record.revokedAt = none := by
  cases held : record.revokedAt with
  | none => rfl
  | some deadline => simp [stands, held] at good

/-- And the clock has not reached it: the reading that would refuse is strictly
before the expiry. -/
theorem a_record_that_stands_has_not_expired (now : Nat) (record : TokenRecord)
    (good : stands now record = true) : ∀ deadline, record.expiresAt = some deadline → now < deadline := by
  intro deadline expiry
  simp only [stands, expiry, Bool.and_eq_true] at good
  exact of_decide_eq_true good.2

/-- A hash the store has never seen verifies nowhere. -/
theorem an_unknown_token_verifies_nowhere (now : Nat) (ledger : Ledger) (hash : String)
    (unknown : ledger hash = none) : verify now ledger hash = none := by
  simp only [verify, unknown]

/-- Whatever comes back was neither revoked nor expired when it was asked for, so
a caller may read those two fields off what it was handed. -/
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

/-- A record that still stands comes back. The refusals are refusals, not the
whole of the function. -/
theorem a_record_that_stands_comes_back (now : Nat) (ledger : Ledger) (hash : String)
    (record : TokenRecord) (filed : ledger hash = some record) (good : stands now record = true) :
    verify now ledger hash = some { record with lastUsedAt := some now } := by
  simp only [verify, filed, if_pos good]

/-- What comes back is what was filed, with the moment it was asked for written
on it and nothing else: the expiry and the revocation are the store's, not the
caller's. -/
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

/-- The store `verify` writes back refuses exactly what the store it read refused:
the one field it moved is a field no refusal reads. -/
theorem a_verification_refuses_exactly_what_it_did (now later : Nat) (ledger : Ledger)
    (hash key : String) : admits later ((markUsed now ledger hash) key) = admits later (ledger key) := by
  by_cases same : key = hash
  · simp only [same, markUsed]
    cases held : ledger hash <;> rfl
  · simp only [markUsed, if_neg same]

/-- Once revoked, never again: the marking is read before the clock is, so no
later reading revives the token. -/
theorem a_revoked_token_never_verifies_again (now later : Nat) (ledger : Ledger) (hash : String) :
    verify later (markRevoked now ledger hash) hash = none := by
  cases held : ledger hash with
  | none => simp [verify, markRevoked, held]
  | some found => simp [verify, markRevoked, held, stands]

/-- A revoke says whether there was still something to revoke. -/
theorem revoking_reports_whether_it_was_still_good (now : Nat) (ledger : Ledger) (hash : String)
    (record : TokenRecord) (filed : ledger hash = some record) :
    (revoke now ledger hash).isSome = !record.revokedAt.isSome := by
  cases held : record.revokedAt <;> simp [revoke, filed, held]

/-- `verify` with a fresh lifetime stamped on as the record is used — the control,
and what "the clock is read, not the record" means read the other way. -/
def renewing (ttl : Nat) (now : Nat) (ledger : Ledger) (hash : String) : Option TokenRecord :=
  match ledger hash with
  | none => none
  | some found =>
    if stands now found then some { found with expiresAt := some (now + ttl), lastUsedAt := some now } else none

/-- One token, ten ticks of life, first used halfway through it. -/
def expiring : TokenRecord :=
  { tokenHash := "h", principalKey := "agent:a1", issuedAt := 0, expiresAt := some 10,
    revokedAt := none, lastUsedAt := none }

def usesExpiring : Ledger := fun _ => some expiring

/-- The control: used at the halfway mark, the live `verify` hands back an expiry
that has not moved, while the renewing one hands back a later deadline — so a
token used once per lifetime never reaches the end of one, and nothing says so. -/
theorem renewing_on_use_never_expires :
    deadlineOf (verify 5 usesExpiring "h") = some 10 ∧
      deadlineOf (renewing 10 5 usesExpiring "h") = some 15 := by
  decide

/-- The boundary from the other side: the token dies at its deadline and not a
tick later, and the reading one tick earlier is the token coming back. -/
theorem a_token_dies_at_its_deadline :
    verify 10 usesExpiring "h" = none ∧ verify 11 usesExpiring "h" = none ∧
      (verify 9 usesExpiring "h").isSome = true := by
  decide

/-- The control for the order of the two refusals: a revoked token is refused by
the marking and not by the clock, so it reads as revoked while it is still well
inside its lifetime — and the same token unmarked comes back. -/
theorem revoking_is_not_the_clock_running_out :
    verify 20 (markRevoked 1 usesExpiring "h") "h" = none ∧
      verify 20 usesExpiring "h" = none ∧
      verify 5 (markRevoked 1 usesExpiring "h") "h" = none ∧
      verify 5 usesExpiring "h" ≠ none := by
  decide

end McpGateway
