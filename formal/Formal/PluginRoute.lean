/-
  How a host decides that a request is a plugin's — `effect-host/src/routes.ts`,
  `dispatch.ts`.

  A plugin claims a path one of two ways: it declares `routes`, or its loaded
  plane supplies `canHandle`. The file reads the first *in place of* the second —
  no union, no fallback — so a plugin that does both is answered by its routes
  alone, and a plugin whose routes are an empty list is answered by nothing at
  all. An empty list reads as "no restriction"; it means "no request", the plane
  goes silent, and the dispatcher reports the same 404 a path nobody claims gets.

  **Declaring routes replaces the plane's own claim** —
  `declaring_routes_replaces_what_the_plane_claims`, which says the answer cannot
  be moved by changing what the plane claims. Read as a union instead, the plane
  the file silences comes back: `reading_routes_as_a_union_revives_a_silenced_plane`.

  **An empty list claims nothing, not everything** —
  `an_empty_route_list_claims_nothing`, with the union reading of it as the
  control.

  **The guards come first** — `a_disabled_plane_answers_nothing`,
  `an_unloaded_plane_answers_nothing`: whatever was declared, a plane that is off
  or not built is not consulted.

  **One plane answers** — `the_first_plane_that_answers_answers` over the list in
  the priority order `lifecycle.ordered()` hands it: the first plane that matches
  answers and no later one is asked, so a plane that claims a prefix another
  plane also claims takes the request for both. `nothing_answers_a_request_no_plane_claims`
  is the 404.

  Idealisation: a claim is the path it names, matched exactly, and a plane's own
  claim is one path or none. What `routes.ts` does beyond that — a method pinned
  to a claim, a prefix claim and its trailing-slash trim — decides *whether* a
  claim matches, not *which* of the two mechanisms is consulted, and that is the
  whole subject here. A plane is `enabled`, `loaded`, its claims and its own
  claim; `dispatch` is the plugin loop with node routes and the control endpoints
  already answered above it.
-/

namespace EffectHost

/-- A plugin entry as the dispatcher reads it. `claims` is what it declared
through `routes` and `owns` what its loaded plane supplies; a claim is the path
it names. -/
structure Plane where
  id : String
  priority : Nat
  enabled : Bool
  loaded : Bool
  claims : Option (List String)
  owns : Option String

/-- `matchesPlugin`: a plane that is off or not built is not consulted, and one
that declared routes is judged by those alone. -/
def answers (plane : Plane) (path : String) : Bool :=
  if plane.enabled && plane.loaded then
    match plane.claims with
    | some claims => claims.any fun claim => claim = path
    | none => plane.owns == some path
  else false

/-- Whatever a plane declared, a plane that is off is not consulted. -/
theorem a_disabled_plane_answers_nothing (plane : Plane) (path : String)
    (off : plane.enabled = false) : answers plane path = false := by
  simp [answers, off]

/-- And neither is one that is on but has no loaded plane behind it. -/
theorem an_unloaded_plane_answers_nothing (plane : Plane) (path : String)
    (absent : plane.loaded = false) : answers plane path = false := by
  simp [answers, absent]

/-- The answer cannot be moved by changing what the plane itself claims: the
routes it declared are read in place of that, not beside it. -/
theorem declaring_routes_replaces_what_the_plane_claims (plane : Plane) (claims : List String)
    (declared : plane.claims = some claims) (path : String) (other : Option String) :
    answers plane path = answers { plane with owns := other } path := by
  simp [answers, declared]

/-- And an empty list claims nothing — not everything. The plane goes silent
without an error, and the dispatcher's 404 is the same one an unclaimed path
gets. -/
theorem an_empty_route_list_claims_nothing (plane : Plane) (path : String)
    (empty : plane.claims = some []) (on : plane.enabled = true) (up : plane.loaded = true) :
    answers plane path = false := by
  simp [answers, empty, on, up]

/-- The rule with the union taken out: routes or the plane's own claim, which is
how "a plugin claims a path by route or by `canHandle`" reads if the file's
either/or is missed. -/
def answersUnion (plane : Plane) (path : String) : Bool :=
  if plane.enabled && plane.loaded then
    (match plane.claims with
     | some claims => claims.any fun claim => claim = path
     | none => false) || (plane.owns == some path)
  else false

/-- The control: one plane, declared with no routes and a path of its own. The
file answers nothing for it; the union reading answers its own path, so the two
readings disagree about whether the plane exists at all. -/
theorem reading_routes_as_a_union_revives_a_silenced_plane :
    answers { id := "mirror", priority := 14, enabled := true, loaded := true,
              claims := some [], owns := some "/-/mirror" } "/-/mirror" = false ∧
    answersUnion { id := "mirror", priority := 14, enabled := true, loaded := true,
                   claims := some [], owns := some "/-/mirror" } "/-/mirror" = true := by
  decide

/-- `dispatchRequest`'s plugin loop, over the entries in the priority order
`lifecycle.ordered()` hands it. -/
def dispatch (planes : List Plane) (path : String) : Option String :=
  match planes with
  | [] => none
  | plane :: rest => if answers plane path then some plane.id else dispatch rest path

/-- The first plane that answers answers, and none behind it is asked. -/
theorem the_first_plane_that_answers_answers (plane : Plane) (rest : List Plane) (path : String)
    (here : answers plane path = true) : dispatch (plane :: rest) path = some plane.id := by
  simp [dispatch, here]

/-- Everything behind it is dead to that path, whatever it claims. -/
theorem a_plane_behind_one_that_answers_is_never_consulted (plane : Plane) (rest : List Plane)
    (path : String) (here : answers plane path = true) :
    dispatch (plane :: rest) path = dispatch [plane] path := by
  simp [dispatch, here]

/-- A plane that claims nothing is passed over — including one silenced by an
empty route list, which is how a declared-but-empty plane loses the request to
whatever is behind it. -/
theorem a_plane_that_claims_nothing_is_passed_over (plane : Plane) (rest : List Plane)
    (path : String) (silent : answers plane path = false) : dispatch (plane :: rest) path = dispatch rest path := by
  simp [dispatch, silent]

/-- And the fallback: a path no plane claims is answered by none, which is the
404 the dispatcher reports. -/
theorem nothing_answers_a_request_no_plane_claims (path : String) : dispatch [] path = none := rfl

end EffectHost
