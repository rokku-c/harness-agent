/-
  The door's own authentication — `packages/mcp-gateway/src/door-auth.ts`.

  A transport asks an app who is calling, and the app answers with the principal
  it named or with nothing at all. The file's claim is that the question is
  answered from a credential alone: it takes the two stores rather than the whole
  resolving surface, so `trusted` and `claims` — the fields that let a *transport*
  vouch for what it passed through — cannot be set by an HTTP request. The
  headers of such a request are read as one thing, the bearer token.

  **Nothing but the credential is read** — `the_headers_are_read_only_as_a_credential`:
  two requests presenting the same credential are named alike, whatever else they
  carry, so no `x-` header reaches the answer as an identity. Read them and anyone
  who can reach the port is whoever they say:
  `a_door_that_reads_the_claim_headers_lets_a_header_be_the_caller`.

  **A principal the door named was verified, and is on** —
  `a_principal_the_door_named_was_verified`, in four parts: a credential was
  presented, the store knows it, the grammar reads its key, and the directory
  answers yes for the principal. Every part is needed, which is what "verified,
  not asserted" means at the door: a credential the store never saw names nobody,
  a key the grammar cannot read names nobody, and an identity that is switched off
  names nobody (`a_disabled_principal_is_named_by_no_credential`) — while the
  converse holds, so the refusal is not vacuous.

  Idealisation: a credential is the bearer token a request presents, as in
  `Formal/Resolve.lean`, whose scheme-prefix rule is not what this module proves;
  the store answers with the key a token stands for, so the clock and the
  revocation list behind that answer stay `Formal/Token.lean`'s subject. The
  `AuthInfo` a handler reads back is modelled as its three readable fields — the
  hash carried instead of the secret, the client, and the claims; `scopes` is not
  modelled, because the door fills it with nothing and access here is decided by
  mcpset rather than by scope.
-/
import Formal.Resolve

namespace McpGateway

/-- What a request carries, as the door reads it: a name to the value it holds. -/
abbrev HeaderBag := String → Option String

/-- The credential a request presents — `bearerToken`. -/
abbrev Credential := HeaderBag → Option String

/-- `AuthInfo`, in the three parts a handler reads back. -/
structure DoorInfo where
  token : String
  clientId : String
  claims : Principal
deriving DecidableEq, Repr

/-- `principalKey`, for the client a request is named by. -/
def doorKey (p : Principal) : String := p.kind ++ ":" ++ p.id

/-- The directory's answer about one principal, as the door reaches it: the
principal, when the directory is on for it. -/
def admittedBy (registry : Registry) (p : Principal) : Option Principal :=
  if registry p then some p else none

/-- `resolvePrincipal` as this door calls it: a credential, the store, the grammar
and the directory. There is no claim bag and no trust flag to pass. -/
def fromCredential (store : TokenStore) (parse : Parse) (registry : Registry)
    (token : String) : Option Principal :=
  match store token with
  | none => none
  | some key =>
    match parse key with
    | none => none
    | some p => admittedBy registry p

/-- `authenticateRequest`: the door. A request that presents no credential is
nobody, and neither store is asked about it. -/
def doorNames (store : TokenStore) (parse : Parse) (registry : Registry)
    (credential : Credential) (headers : HeaderBag) : Option Principal :=
  match credential headers with
  | none => none
  | some token => fromCredential store parse registry token

/-- The information the transport hands its handlers: the hash a record is listed
by rather than the secret, the client the door named, and the claims read back. -/
def infoFor (hash : String → String) (token : String) (p : Principal) : DoorInfo :=
  { token := hash token, clientId := doorKey p, claims := p }

/-- What a request that presents no credential gets: nobody, without a lookup. -/
theorem a_request_with_no_credential_names_nobody (store : TokenStore) (parse : Parse)
    (registry : Registry) (credential : Credential) (headers : HeaderBag)
    (absent : credential headers = none) :
    doorNames store parse registry credential headers = none := by
  simp [doorNames, absent]

/-- Two requests presenting the same credential are named alike, whatever else
they carry — the door reads the headers for one thing only. -/
theorem the_headers_are_read_only_as_a_credential (store : TokenStore) (parse : Parse)
    (registry : Registry) (credential : Credential) (headers other : HeaderBag)
    (same : credential headers = credential other) :
    doorNames store parse registry credential headers =
      doorNames store parse registry credential other := by
  simp [doorNames, same]

/-- A credential the store has never seen names nobody. -/
theorem a_credential_the_store_never_saw_names_nobody (store : TokenStore) (parse : Parse)
    (registry : Registry) (token : String) (unknown : store token = none) :
    fromCredential store parse registry token = none := by
  simp [fromCredential, unknown]

/-- A key the grammar cannot read names nobody: the store answering is not enough. -/
theorem an_unreadable_key_names_nobody (store : TokenStore) (parse : Parse)
    (registry : Registry) (token key : String) (known : store token = some key)
    (unreadable : parse key = none) :
    fromCredential store parse registry token = none := by
  simp [fromCredential, known, unreadable]

/-- An identity the directory is off for names nobody, however good its
credential is. -/
theorem a_disabled_principal_is_named_by_no_credential (store : TokenStore) (parse : Parse)
    (registry : Registry) (token key : String) (p : Principal) (known : store token = some key)
    (parsed : parse key = some p) (off : registry p = false) :
    fromCredential store parse registry token = none := by
  simp [fromCredential, known, parsed, admittedBy, off]

/-- And the converse: a principal the door named was verified end to end. Which
is why the refusals above are the whole of what the door can say — there is no
fifth way to be named. -/
theorem a_principal_the_door_named_was_verified (store : TokenStore) (parse : Parse)
    (registry : Registry) (credential : Credential) (headers : HeaderBag) (p : Principal)
    (named : doorNames store parse registry credential headers = some p) :
    ∃ token key, credential headers = some token ∧ store token = some key ∧
      parse key = some p ∧ registry p = true := by
  have someOf {α : Type} {o : Option α} (nope : o ≠ none) : ∃ a, o = some a := by
    cases o with
    | none => exact absurd rfl nope
    | some a => exact ⟨a, rfl⟩
  by_cases blank : credential headers = none
  · simp [doorNames, blank] at named
  · obtain ⟨token, presented⟩ := someOf blank
    have known : ∃ key, store token = some key ∧ parse key = some p ∧ registry p = true := by
      have step := named
      unfold doorNames fromCredential at step
      simp only [presented] at step
      by_cases absent : store token = none
      · simp [absent] at step
      · obtain ⟨key, holds⟩ := someOf absent
        simp only [holds] at step
        by_cases unreadable : parse key = none
        · simp [unreadable] at step
        · obtain ⟨q, reads⟩ := someOf unreadable
          simp only [reads] at step
          unfold admittedBy at step
          by_cases on : registry q = true
          · simp [on] at step
            have same : q = p := by simpa using step
            subst same
            exact ⟨key, holds, reads, on⟩
          · simp [on] at step
    obtain ⟨key, holds, reads, on⟩ := known
    exact ⟨token, key, presented, holds, reads, on⟩

/-- The control. A door that also reads the claim headers — the shape that
supplying `trusted` to the resolver would give it — names a request that presents
no credential at all, because a header said so. -/
def doorReadingClaims (store : TokenStore) (parse : Parse) (registry : Registry)
    (credential : Credential) (claimed : HeaderBag → Option Principal) (headers : HeaderBag) :
    Option Principal :=
  match credential headers with
  | none => (claimed headers).bind fun p => admittedBy registry p
  | some token => fromCredential store parse registry token

theorem a_door_that_reads_the_claim_headers_lets_a_header_be_the_caller :
    let operator : Principal := { kind := "operator", id := "root" }
    let headers : HeaderBag := fun name =>
      if name = "x-principal-kind" then some "operator"
      else if name = "x-principal-id" then some "root" else none
    let claimed : HeaderBag → Option Principal := fun bag =>
      match bag "x-principal-kind", bag "x-principal-id" with
      | some kind, some id => some { kind := kind, id := id }
      | _, _ => none
    let present : Credential := fun _ => none
    doorReadingClaims (fun _ => none) (fun _ => none) (fun _ => true) present claimed headers =
        some operator ∧
      doorNames (fun _ => none) (fun _ => none) (fun _ => true) present headers = none := by
  decide

/-- What the handlers are handed: the principal's own key and claims, and the
hash the record is listed by rather than the secret a caller presented. A guard
on the shape, not a computation — it is the one place the plaintext could leak
outward. -/
theorem the_handed_information_carries_the_hash_and_the_principal (hash : String → String)
    (token : String) (p : Principal) :
    (infoFor hash token p).clientId = doorKey p ∧ (infoFor hash token p).claims = p ∧
      (infoFor hash token p).token = hash token := ⟨rfl, rfl, rfl⟩

end McpGateway
