namespace McpGateway

structure Principal where
  kind : String
  id : String
deriving DecidableEq, Repr

inductive Via where
  | token
  | claim
deriving DecidableEq, Repr

structure Request where
  bearer : Option String
  claims : Option Principal
  trusted : Bool
  headers : Option Principal
deriving DecidableEq, Repr

abbrev TokenStore := String → Option String

abbrev Parse := String → Option Principal

abbrev Registry := Principal → Bool

def settle (registry : Registry) (via : Via) (p : Principal) : Option (Principal × Via) :=
  if registry p then some (p, via) else none

def weaker (registry : Registry) (r : Request) : Option (Principal × Via) :=
  match r.claims with
  | some p => settle registry Via.claim p
  | none =>
    if r.trusted then (match r.headers with | some p => settle registry Via.claim p | none => none)
    else none

def resolveWith (fallThrough : Bool) (store : TokenStore) (parse : Parse)
    (registry : Registry) (r : Request) : Option (Principal × Via) :=
  match r.bearer with
  | some t =>
    match store t with
    | none => if fallThrough then weaker registry r else none
    | some key =>
      match parse key with
      | none => if fallThrough then weaker registry r else none
      | some p => settle registry Via.token p
  | none => weaker registry r

def resolve (store : TokenStore) (parse : Parse) (registry : Registry)
    (r : Request) : Option (Principal × Via) :=
  resolveWith false store parse registry r

def resolveClaimsFirst (store : TokenStore) (parse : Parse) (registry : Registry)
    (r : Request) : Option (Principal × Via) :=
  match r.claims with
  | some p => settle registry Via.claim p
  | none => resolve store parse registry { r with claims := none }

def resolveIgnoringTrust (store : TokenStore) (parse : Parse) (registry : Registry)
    (r : Request) : Option (Principal × Via) :=
  resolve store parse registry { r with trusted := true }

theorem a_token_that_does_not_verify_is_denied_outright (store : TokenStore) (parse : Parse)
    (registry : Registry) (r : Request) (t : String) (bearer : r.bearer = some t)
    (unknown : store t = none) : resolve store parse registry r = none := by
  simp [resolve, resolveWith, bearer, unknown]

theorem a_token_with_no_usable_principal_is_denied_outright (store : TokenStore) (parse : Parse)
    (registry : Registry) (r : Request) (t key : String) (bearer : r.bearer = some t)
    (known : store t = some key) (unparsable : parse key = none) :
    resolve store parse registry r = none := by
  simp [resolve, resolveWith, bearer, known, unparsable]

theorem falling_through_lets_a_bad_token_downgrade_to_forged_headers :
    resolveWith true (fun _ => none) (fun _ => none) (fun _ => true)
        { bearer := some "stale", claims := none, trusted := true,
          headers := some { kind := "operator", id := "root" } } =
      some ({ kind := "operator", id := "root" }, Via.claim) ∧
    resolve (fun _ => none) (fun _ => none) (fun _ => true)
        { bearer := some "stale", claims := none, trusted := true,
          headers := some { kind := "operator", id := "root" } } = none := by
  decide

theorem the_weaker_sources_are_unread_once_a_token_verifies (store : TokenStore) (parse : Parse)
    (registry : Registry) (r other : Request) (t key : String) (p : Principal)
    (bearer : r.bearer = some t) (known : store t = some key) (parsed : parse key = some p)
    (sameToken : other.bearer = some t) :
    resolve store parse registry r = resolve store parse registry other := by
  simp [resolve, resolveWith, bearer, sameToken, known, parsed]

theorem reading_the_claims_first_lets_a_valid_token_be_rewritten :
    let low : Principal := { kind := "agent", id := "a1" }
    let high : Principal := { kind := "operator", id := "root" }
    let store : TokenStore := fun s => if s = "good" then some "agent:a1" else none
    let parse : Parse := fun k => if k = "agent:a1" then some low else none
    let r : Request := { bearer := some "good", claims := some high, trusted := false, headers := none }
    resolveClaimsFirst store parse (fun _ => true) r = some (high, Via.claim) ∧
    resolve store parse (fun _ => true) r = some (low, Via.token) := by
  decide

theorem an_untrusted_transport_cannot_be_read_from_its_headers (store : TokenStore)
    (parse : Parse) (registry : Registry) (r : Request) (bearer : r.bearer = none)
    (claims : r.claims = none) (untrusted : r.trusted = false) :
    resolve store parse registry r = none := by
  simp [resolve, resolveWith, weaker, bearer, claims, untrusted]

theorem a_trusted_transport_is_read_from_its_headers (store : TokenStore) (parse : Parse)
    (registry : Registry) (r : Request) (h : Principal) (bearer : r.bearer = none)
    (claims : r.claims = none) (trusted : r.trusted = true) (headers : r.headers = some h)
    (active : registry h = true) : resolve store parse registry r = some (h, Via.claim) := by
  simp [resolve, resolveWith, weaker, settle, bearer, claims, trusted, headers, active]

theorem dropping_the_trust_gate_lets_anyone_forge_a_principal :
    resolveIgnoringTrust (fun _ => none) (fun _ => none) (fun _ => true)
        { bearer := none, claims := none, trusted := false,
          headers := some { kind := "operator", id := "root" } } =
      some ({ kind := "operator", id := "root" }, Via.claim) ∧
    resolve (fun _ => none) (fun _ => none) (fun _ => true)
        { bearer := none, claims := none, trusted := false,
          headers := some { kind := "operator", id := "root" } } = none := by
  decide

theorem settle_is_active (registry : Registry) (via : Via) (given : Principal)
    (p : Principal) (w : Via) (settled : settle registry via given = some (p, w)) :
    registry p = true := by
  by_cases active : registry given = true
  · simp [settle, active, Option.some.injEq, Prod.mk.injEq] at settled
    rcases settled with ⟨rfl, -⟩
    exact active
  · simp [settle, active] at settled

theorem every_admitted_principal_is_active (store : TokenStore) (parse : Parse)
    (registry : Registry) (r : Request) (p : Principal) (via : Via)
    (admitted : resolve store parse registry r = some (p, via)) : registry p = true := by
  obtain ⟨bearer, claims, trusted, headers⟩ := r
  simp only [resolve, resolveWith] at admitted
  cases bearer with
  | none =>
    simp only [weaker] at admitted
    cases claims with
    | some q => simpa using settle_is_active registry Via.claim q p via admitted
    | none =>
      simp only at admitted
      cases trusted with
      | false => simp at admitted
      | true =>
        simp only at admitted
        cases headers with
        | some q => simpa using settle_is_active registry Via.claim q p via admitted
        | none => simp at admitted
  | some t =>
    simp only [weaker] at admitted
    cases h : store t with
    | none => simp [h] at admitted
    | some key =>
      simp only [h] at admitted
      cases h2 : parse key with
      | none => simp [h2] at admitted
      | some q =>
        simp only [h2] at admitted
        exact settle_is_active registry Via.token q p via admitted

end McpGateway
