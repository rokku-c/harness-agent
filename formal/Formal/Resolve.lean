/-
  Turning a request into a principal — `packages/mcp-gateway/src/resolve.ts`.

  Three sources, in strict order: a verified bearer token, a claim bag the
  transport already validated, and raw `x-*` headers from a transport that
  declares itself trusted. The file's header states why the order is strict and
  why a bad token ends the search, and every one of those rules is silent when it
  is read the other way: the caller is admitted, as somebody.

  **A token that does not verify is not a downgrade** —
  `a_token_that_does_not_verify_is_denied_outright`, and the same for a token that
  verifies to a key that does not parse: `a_token_with_no_usable_principal_is_denied_outright`.
  Both hold whatever else the request carries, which is the point — the weaker
  sources are never reached, so a caller cannot send a token it knows is bad and
  be read as a header it forged:
  `falling_through_lets_a_bad_token_downgrade_to_forged_headers`.

  **The first source that answers is the answer** —
  `the_weaker_sources_are_unread_once_a_token_verifies`: with a token present and
  good, the outcome does not depend on the claims, the headers or the trust flag.
  Read the claims first and a caller holding any valid token is whoever it says it
  is: `reading_the_claims_first_lets_a_valid_token_be_rewritten`.

  **Bare headers are read only from a trusted transport** —
  `an_untrusted_transport_cannot_be_read_from_its_headers`, against
  `a_trusted_transport_is_read_from_its_headers`, since a gate that never opened
  would not be a gate. Drop it and anyone who can reach the port is an operator:
  `dropping_the_trust_gate_lets_anyone_forge_a_principal`.

  And the registry is not skippable: `every_admitted_principal_is_active`.

  Idealisation: a bearer header that is absent, empty, or not a bearer scheme is
  the same thing here — `bearer = none` — because the file treats all three as
  "no token presented" and none of them is a token that failed. What a token
  *is*, and how it is spelled, is `identity.ts`'s subject.
-/

namespace McpGateway

/-- A principal: a kind and an id. `parsePrincipalKey` produces one, and what
the kinds are is the authz package's subject. -/
structure Principal where
  kind : String
  id : String
deriving DecidableEq, Repr

/-- Which source the principal came from. -/
inductive Via where
  | token
  | claim
deriving DecidableEq, Repr

/-- What resolution reads: the bearer header if one is present, the claim bag the
transport handed us, whether the transport is trusted, and the `x-*` headers. -/
structure Request where
  bearer : Option String
  claims : Option Principal
  trusted : Bool
  headers : Option Principal
deriving DecidableEq, Repr

/-- The token store: a token to the principal key it stands for. -/
abbrev TokenStore := String → Option String

/-- `parsePrincipalKey`: a key to the principal it names. -/
abbrev Parse := String → Option Principal

/-- `PrincipalRegistry.active`. -/
abbrev Registry := Principal → Bool

/-- The answer for a principal the registry has, or nothing. Every source settles
through this, which is what makes "an admitted principal is active" a fact about
one function rather than about three. -/
def settle (registry : Registry) (via : Via) (p : Principal) : Option (Principal × Via) :=
  if registry p then some (p, via) else none

/-- The weaker two sources, in the order the file reads them: the claim bag if the
transport produced one, else the bare headers, and only from a trusted transport. -/
def weaker (registry : Registry) (r : Request) : Option (Principal × Via) :=
  match r.claims with
  | some p => settle registry Via.claim p
  | none =>
    if r.trusted then (match r.headers with | some p => settle registry Via.claim p | none => none)
    else none

/-- `resolvePrincipal`, with the one rule the proof is about left as a parameter:
`fallThrough` sends a token that fails back into the weaker sources. The file
passes `false`; the controls below pass `true` and are what that rule rules out. -/
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

/-- `resolvePrincipal`. -/
def resolve (store : TokenStore) (parse : Parse) (registry : Registry)
    (r : Request) : Option (Principal × Via) :=
  resolveWith false store parse registry r

/-- The claim bag read before the token — one source order apart from `resolve`. -/
def resolveClaimsFirst (store : TokenStore) (parse : Parse) (registry : Registry)
    (r : Request) : Option (Principal × Via) :=
  match r.claims with
  | some p => settle registry Via.claim p
  | none => resolve store parse registry { r with claims := none }

/-- `resolve` with the trust flag read as "always". -/
def resolveIgnoringTrust (store : TokenStore) (parse : Parse) (registry : Registry)
    (r : Request) : Option (Principal × Via) :=
  resolve store parse registry { r with trusted := true }

/-- A token the store does not know ends the search, whatever the request also
carries — no claims, no headers and no trust flag is consulted. -/
theorem a_token_that_does_not_verify_is_denied_outright (store : TokenStore) (parse : Parse)
    (registry : Registry) (r : Request) (t : String) (bearer : r.bearer = some t)
    (unknown : store t = none) : resolve store parse registry r = none := by
  simp [resolve, resolveWith, bearer, unknown]

/-- And a token that verifies to a key that does not parse is the same: the store
answering is not enough for the request to proceed to a weaker source. -/
theorem a_token_with_no_usable_principal_is_denied_outright (store : TokenStore) (parse : Parse)
    (registry : Registry) (r : Request) (t key : String) (bearer : r.bearer = some t)
    (known : store t = some key) (unparsable : parse key = none) :
    resolve store parse registry r = none := by
  simp [resolve, resolveWith, bearer, known, unparsable]

/-- The control. A caller presents a token it knows is bad — expired, or someone
else's — and forges the headers a trusted transport passes through. Sent back into
the weaker sources the token is not a credential but a step down, and the request
is admitted as the operator the caller named. -/
theorem falling_through_lets_a_bad_token_downgrade_to_forged_headers :
    resolveWith true (fun _ => none) (fun _ => none) (fun _ => true)
        { bearer := some "stale", claims := none, trusted := true,
          headers := some { kind := "operator", id := "root" } } =
      some ({ kind := "operator", id := "root" }, Via.claim) ∧
    resolve (fun _ => none) (fun _ => none) (fun _ => true)
        { bearer := some "stale", claims := none, trusted := true,
          headers := some { kind := "operator", id := "root" } } = none := by
  decide

/-- The first source that answers is the answer: with a token present and good,
the outcome is the token's principal and nothing else in the request is read. -/
theorem the_weaker_sources_are_unread_once_a_token_verifies (store : TokenStore) (parse : Parse)
    (registry : Registry) (r other : Request) (t key : String) (p : Principal)
    (bearer : r.bearer = some t) (known : store t = some key) (parsed : parse key = some p)
    (sameToken : other.bearer = some t) :
    resolve store parse registry r = resolve store parse registry other := by
  simp [resolve, resolveWith, bearer, sameToken, known, parsed]

/-- The control. Read the claim bag first and the same valid token resolves to
whatever the caller claims instead — a low-privilege token becomes an operator,
and the token that was supposed to say who the caller is says nothing. -/
theorem reading_the_claims_first_lets_a_valid_token_be_rewritten :
    let low : Principal := { kind := "agent", id := "a1" }
    let high : Principal := { kind := "operator", id := "root" }
    let store : TokenStore := fun s => if s = "good" then some "agent:a1" else none
    let parse : Parse := fun k => if k = "agent:a1" then some low else none
    let r : Request := { bearer := some "good", claims := some high, trusted := false, headers := none }
    resolveClaimsFirst store parse (fun _ => true) r = some (high, Via.claim) ∧
    resolve store parse (fun _ => true) r = some (low, Via.token) := by
  decide

/-- A transport that does not declare itself trustworthy cannot be read from the
headers it passed through, whatever they say. -/
theorem an_untrusted_transport_cannot_be_read_from_its_headers (store : TokenStore)
    (parse : Parse) (registry : Registry) (r : Request) (bearer : r.bearer = none)
    (claims : r.claims = none) (untrusted : r.trusted = false) :
    resolve store parse registry r = none := by
  simp [resolve, resolveWith, weaker, bearer, claims, untrusted]

/-- The other direction, so the gate is not one that never opens: a trusted
transport's headers do name the principal. -/
theorem a_trusted_transport_is_read_from_its_headers (store : TokenStore) (parse : Parse)
    (registry : Registry) (r : Request) (h : Principal) (bearer : r.bearer = none)
    (claims : r.claims = none) (trusted : r.trusted = true) (headers : r.headers = some h)
    (active : registry h = true) : resolve store parse registry r = some (h, Via.claim) := by
  simp [resolve, resolveWith, weaker, settle, bearer, claims, trusted, headers, active]

/-- The control. Trust read as "the transport exists" rather than "the transport
is trusted", and the same forged headers are believed on a transport that never
claimed to be trustworthy — every caller who can reach the port is an operator. -/
theorem dropping_the_trust_gate_lets_anyone_forge_a_principal :
    resolveIgnoringTrust (fun _ => none) (fun _ => none) (fun _ => true)
        { bearer := none, claims := none, trusted := false,
          headers := some { kind := "operator", id := "root" } } =
      some ({ kind := "operator", id := "root" }, Via.claim) ∧
    resolve (fun _ => none) (fun _ => none) (fun _ => true)
        { bearer := none, claims := none, trusted := false,
          headers := some { kind := "operator", id := "root" } } = none := by
  decide

/-- `settle` admits only a principal the registry has. -/
theorem settle_is_active (registry : Registry) (via : Via) (given : Principal)
    (p : Principal) (w : Via) (settled : settle registry via given = some (p, w)) :
    registry p = true := by
  by_cases active : registry given = true
  · simp [settle, active, Option.some.injEq, Prod.mk.injEq] at settled
    rcases settled with ⟨rfl, -⟩
    exact active
  · simp [settle, active] at settled

/-- The registry is not skippable: whoever is admitted, the registry has them —
which source they came from does not matter, because all three settle the same way. -/
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
